import {OFFLINE_GRANT_PREFIX} from './smartLoginOfficialIdentity.mjs';

export const OFFLINE_VALIDITY_MS = 24 * 60 * 60 * 1000;
const key = uid => {
  if (typeof uid !== 'string' || !/^[A-Za-z0-9_-]{1,128}$/.test(uid)) throw Error('OFFLINE_AUTH_REQUIRED');
  return OFFLINE_GRANT_PREFIX + uid;
};
export function verifyOfflineAccess(storage, uid, now = Date.now()) {
  const grant = JSON.parse(storage.getItem(key(uid)));
  if (grant?.format !== 2 || grant.uid !== uid || !Number.isSafeInteger(grant.verifiedAt)
      || now < grant.verifiedAt || now - grant.verifiedAt >= OFFLINE_VALIDITY_MS) {
    throw Error('OFFLINE_AUTH_REQUIRED');
  }
  return grant.verifiedAt + OFFLINE_VALIDITY_MS;
}
export function recordOfflineAccess(storage, uid, verifiedAt = Date.now()) {
  storage.setItem(key(uid), JSON.stringify({format:2,uid,verifiedAt}));
}
