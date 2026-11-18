import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {test} from 'node:test';
import {assertFails, assertSucceeds, initializeTestEnvironment} from '@firebase/rules-unit-testing';
import {doc, getDoc, serverTimestamp, setDoc, updateDoc, writeBatch} from 'firebase/firestore';

test('só o próprio Google verificado sincroniza metadados, sem alterar privilégios ou data de criação', async () => {
  const env = await initializeTestEnvironment({projectId: 'demo-raytech-v340', firestore: {
    host: '127.0.0.1', port: 18080, rules: await readFile(new URL('./generated-online.rules', import.meta.url), 'utf8'),
  }});
  try {
    const account = (db, uid) => doc(db, 'raytechHml34741Accounts', uid);
    const claims = {firebase: {sign_in_provider: 'google.com'}, email_verified: true, email: 'fixture@example.test',
      name: 'Google fixture', picture: 'https://lh3.googleusercontent.com/a/example', auth_time: 1700000500};
    const profile = {email: claims.email, name: claims.name, photo: claims.picture, lastLoginSeconds: claims.auth_time};
    const enriched = {...profile, createdAtMs: 1700000000123};
    await env.withSecurityRulesDisabled(async ctx => {
      const db = ctx.firestore();
      for (const uid of ['free', 'blocked', 'owner']) {
        await setDoc(account(db, uid), {uid, name: 'Fixture', plan: 'free', blocked: uid === 'blocked',
          ...(uid === 'free' ? {googleProfile: {...enriched, lastLoginSeconds: claims.auth_time - 1}} : {})});
      }
      await setDoc(doc(db, 'raytechHml34741Roles', 'owner'), {role: 'owner', active: true});
    });
    const free = env.authenticatedContext('free', claims).firestore();
    const owner = env.authenticatedContext('owner', claims).firestore();
    const ref = account(free, 'free');
    await assertSucceeds(updateDoc(ref, {googleProfile: enriched}));
    assert.deepEqual((await getDoc(ref)).data().googleProfile, enriched);
    await assertSucceeds(updateDoc(account(owner, 'owner'), {googleProfile: profile}));
    await assertFails(updateDoc(ref, {googleProfile: enriched}));
    const nextLogin = {...enriched, lastLoginSeconds: claims.auth_time + 1};
    const next = account(env.authenticatedContext('free', {...claims, auth_time: claims.auth_time + 1}).firestore(), 'free');
    for (const patch of [
      {googleProfile: {...profile, lastLoginSeconds: nextLogin.lastLoginSeconds}},
      {googleProfile: {...nextLogin, createdAtMs: enriched.createdAtMs + 1}},
      {googleProfile: {...nextLogin, email: 'forged@example.test'}},
      {googleProfile: {...nextLogin, name: 'Spoofed'}},
      {googleProfile: {...nextLogin, photo: 'https://example.test/photo'}},
      {googleProfile: {...nextLogin, lastLoginSeconds: claims.auth_time + 2}},
      {googleProfile: {...nextLogin, role: 'owner'}},
      {googleProfile: nextLogin, uid: 'other'}, {googleProfile: nextLogin, plan: 'premium'},
      {googleProfile: nextLogin, limits: {minute: 1, day: 1, month: 1}},
      {googleProfile: nextLogin, blocked: true},
    ]) await assertFails(updateDoc(next, patch));
    for (const [uid, token] of [
      ['free', {...claims, auth_time: claims.auth_time - 1}], ['free', {...claims, email_verified: false}],
      ['free', {...claims, firebase: {sign_in_provider: 'password'}}], ['blocked', claims],
    ]) {
      const db = env.authenticatedContext(uid, token).firestore();
      await assertFails(updateDoc(account(db, uid), {googleProfile: uid === 'free' ? enriched : profile}));
    }
    await assertFails(updateDoc(account(owner, 'free'), {googleProfile: enriched}));
    await assertFails(updateDoc(account(owner, 'owner'), {plan: 'premium', googleProfile: profile}));
    const id = '00000000-0000-4000-8000-00000000a001';
    const batch = writeBatch(owner);
    batch.update(account(owner, 'free'), {plan: 'premium', lastAudit: id});
    batch.set(doc(owner, 'raytechHml34741Audit', id), {
      actor: 'owner', target: 'free', beforePlan: 'free', afterPlan: 'premium',
      beforeBlocked: false, afterBlocked: false, at: serverTimestamp(),
    });
    await assertSucceeds(batch.commit());
    assert.deepEqual((await getDoc(ref)).data().googleProfile, enriched);
  } finally {
    await env.cleanup();
  }
});
