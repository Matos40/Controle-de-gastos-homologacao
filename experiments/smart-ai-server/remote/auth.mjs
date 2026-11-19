import {Buffer} from 'node:buffer';
import {X509Certificate, verify} from 'node:crypto';

const certificateUrl =
  'https://www.googleapis.com/robot/v1/metadata/x509/securetoken@system.gserviceaccount.com';
const accountUrl = 'https://identitytoolkit.googleapis.com/v1/projects/';
const tokenPart = /^[A-Za-z0-9_-]+$/;

function parsePart(value) {
  if (!tokenPart.test(value)) throw Error('INVALID_TOKEN');
  return JSON.parse(Buffer.from(value, 'base64url').toString('utf8'));
}

export function createFirebaseVerifier(projectId) {
  let certificates = new Map();
  let expiresAt = 0;

  async function publicKey(kid, transport, signal) {
    if (Date.now() >= expiresAt) {
      const response = await transport(certificateUrl, {redirect:'manual', signal});
      if (!response.ok) throw Error('AUTH_UNAVAILABLE');
      const keys = await response.json();
      const maxAge = Number(response.headers.get('cache-control')?.match(/\bmax-age=(\d+)/)?.[1] ?? 0);
      certificates = new Map(Object.entries(keys).map(([id, pem]) =>
        [id, new X509Certificate(pem).publicKey]));
      expiresAt = Date.now() + Math.min(maxAge, 3600) * 1000;
    }
    return certificates.get(kid);
  }

  return async (token, getAccessToken, transport, signal) => {
    if (typeof token !== 'string' || token.length > 8192) throw Error('INVALID_TOKEN');
    const [header, payload, signature, extra] = token.split('.');
    if (!header || !payload || !signature || extra !== undefined || !tokenPart.test(signature)) {
      throw Error('INVALID_TOKEN');
    }
    const {alg, kid} = parsePart(header);
    const claims = parsePart(payload);
    const now = Math.floor(Date.now() / 1000);
    const uid = claims.sub;
    if (alg !== 'RS256' || typeof kid !== 'string' || !/^[a-zA-Z0-9_-]{1,128}$/.test(kid)
        || claims.aud !== projectId || claims.iss !== 'https://securetoken.google.com/' + projectId
        || typeof uid !== 'string' || !/^[A-Za-z0-9_-]{1,128}$/.test(uid)
        || !Number.isSafeInteger(claims.exp) || claims.exp <= now
        || !Number.isSafeInteger(claims.iat) || claims.iat > now
        || !Number.isSafeInteger(claims.auth_time) || claims.auth_time > claims.iat
        || claims.auth_time < 1) throw Error('INVALID_TOKEN');
    const key = await publicKey(kid, transport, signal);
    if (!key || !verify('RSA-SHA256', Buffer.from(header + '.' + payload), key,
      Buffer.from(signature, 'base64url'))) throw Error('INVALID_TOKEN');

    const accessToken = await getAccessToken();
    const response = await transport(accountUrl + projectId + '/accounts:lookup', {
      method:'POST', redirect:'manual', signal,
      headers:{authorization:'Bearer ' + accessToken, 'content-type':'application/json'},
      body:JSON.stringify({localId:[uid]}),
    });
    if (!response.ok) throw Error('AUTH_UNAVAILABLE');
    const {users} = await response.json();
    const account = Array.isArray(users) && users.length === 1 ? users[0] : null;
    const validSince = Number(account?.validSince);
    if (!account || account.localId !== uid || account.disabled === true
        || !Number.isSafeInteger(validSince) || validSince < 0 || claims.auth_time < validSince) {
      throw Error('INVALID_TOKEN');
    }
    return {uid};
  };
}
