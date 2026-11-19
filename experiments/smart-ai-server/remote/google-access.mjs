import {Buffer} from 'node:buffer';
import {createPrivateKey, sign} from 'node:crypto';

const tokenUrl = 'https://oauth2.googleapis.com/token';
const scope = 'https://www.googleapis.com/auth/datastore https://www.googleapis.com/auth/identitytoolkit';
const encode = value => Buffer.from(JSON.stringify(value)).toString('base64url');

export function createGoogleAccessToken(projectId, credentialJson) {
  const credential = JSON.parse(credentialJson);
  if (credential.type !== 'service_account' || credential.project_id !== projectId ||
      !/^[a-z][a-z0-9-]{4,28}[a-z0-9]$/.test(projectId) ||
      credential.client_email !== `raytech-ai-worker@${projectId}.iam.gserviceaccount.com`) {
    throw Error('INVALID_EXPERIMENT_CREDENTIAL');
  }
  const privateKey = createPrivateKey(credential.private_key);
  let cached;

  return async (transport, signal) => {
    const now = Math.floor(Date.now() / 1000);
    if (cached?.expiresAt > now + 60) return cached.token;
    const header = encode({alg:'RS256', typ:'JWT', kid:credential.private_key_id});
    const claims = encode({iss:credential.client_email, scope, aud:tokenUrl, iat:now, exp:now + 600});
    const unsigned = header + '.' + claims;
    const assertion = unsigned + '.' + sign('RSA-SHA256', Buffer.from(unsigned), privateKey).toString('base64url');
    const response = await transport(tokenUrl, {
      method:'POST', redirect:'manual', signal,
      body:new URLSearchParams({
        grant_type:'urn:ietf:params:oauth:grant-type:jwt-bearer', assertion,
      }),
    });
    if (!response.ok) throw Error('GOOGLE_UNAVAILABLE');
    const {access_token:token, expires_in:seconds, token_type:type} = await response.json();
    if (type?.toLowerCase() !== 'bearer' || typeof token !== 'string' || token.length < 16 ||
        !Number.isSafeInteger(seconds) || seconds < 1) throw Error('GOOGLE_UNAVAILABLE');
    cached = {token, expiresAt:now + Math.min(seconds, 3600)};
    return token;
  };
}
