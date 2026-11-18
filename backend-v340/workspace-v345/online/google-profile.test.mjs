import assert from 'node:assert/strict';
import {test} from 'node:test';
import {adminIdentity, googleProfileFromAdmin, googleProfileFromToken} from '../official/js/productionV2/googleAdminProfile.mjs';

const claims = {firebase: {sign_in_provider: 'google.com'}, email_verified: true,
  name: 'Pessoa Google', email: 'fixture@example.test', picture: 'https://lh3.googleusercontent.com/a/photo',
  auth_time: 1700000500};
const record = {providerUserInfo: [{providerId: 'google.com', displayName: claims.name, photoUrl: claims.picture}],
  email: claims.email, emailVerified: true, createdAt: '1700000000123', lastLoginAt: '1700000500456'};

test('Google profile uses verified claims and deduplicates writes across reload and token refresh', () => {
  const next = googleProfileFromToken(claims);
  assert.deepEqual(next, {name: claims.name, email: claims.email, photo: claims.picture, lastLoginSeconds: claims.auth_time});
  assert.equal(googleProfileFromToken({...claims, iat: claims.auth_time + 20}, next), null);
  assert.equal(googleProfileFromToken({...claims, auth_time: claims.auth_time - 1}, next), null);
  assert.equal(googleProfileFromToken({...claims, email_verified: false}), null);
  assert.equal(googleProfileFromToken({...claims, firebase: {sign_in_provider: 'password'}}), null);
  assert.equal(googleProfileFromToken({...claims, picture: 'https://lh3.googleusercontent.com.example.test/a'}).photo, '');
});

test('administrative backfill preserves trusted creation, newer login and all account privileges', () => {
  const googleProfile = googleProfileFromAdmin(record);
  assert.equal(googleProfile.createdAtMs, 1700000000123);
  assert.equal(googleProfileFromAdmin(record, googleProfile), null);
  assert.equal(googleProfileFromAdmin({...record, providerUserInfo: []}), null);
  const newer = googleProfileFromToken({...claims, auth_time: claims.auth_time + 60}, googleProfile);
  assert.equal(newer.createdAtMs, googleProfile.createdAtMs);
  assert.equal(googleProfileFromAdmin(record, newer), null);
  const account = {uid: 'fixture', plan: 'premium', blocked: false, role: 'owner', limits: {minute: 3}, googleProfile};
  const rendered = adminIdentity(account);
  for (const key of ['uid', 'plan', 'blocked', 'role', 'limits']) assert.deepEqual(rendered[key], account[key]);
  assert.equal(rendered.createdAt.getTime(), 1700000000123);
  assert.equal(rendered.lastAccess.getTime(), claims.auth_time * 1000);
});
