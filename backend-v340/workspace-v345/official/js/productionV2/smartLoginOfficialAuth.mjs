import {initializeApp} from 'firebase/app';
import {getAuth, connectAuthEmulator, onAuthStateChanged, GoogleAuthProvider,
  signInWithPopup, signInWithEmailAndPassword, signOut} from 'firebase/auth';
import {getFirestore, connectFirestoreEmulator, doc, collection, getDocFromServer,
  getDocsFromServer, query, orderBy, limit, onSnapshot, runTransaction, serverTimestamp} from 'firebase/firestore';
import {environment} from './config.mjs';
import {DEFAULT_LIMITS, countsInWindow, nextCounts} from './v345Usage.mjs';
import {operatorRole} from './smartAdminPolicy.mjs';

let ready;
export function openSmartLoginAuth() {
  return ready ??= initialize();
}

async function initialize() {
  const {local, firebase} = await environment();
  const app = initializeApp(firebase, 'raytech-v345');
  const auth = getAuth(app);
  const db = getFirestore(app);
  if (local) {
    connectAuthEmulator(auth, 'http://127.0.0.1:19099', {disableWarnings: true});
    connectFirestoreEmulator(db, '127.0.0.1', 18080);
  }
  const currentUid = () => auth.currentUser?.uid ?? null;
  const account = uid => doc(db, 'raytechV345Accounts', uid);
  const usageRef = uid => doc(db, 'raytechV345Usage', uid);
  const roleRef = uid => doc(db, 'raytechV345Roles', uid);
  const read = async ref => (await getDocFromServer(ref)).data();
  const assertSession = uid => {
    if (currentUid() !== uid) throw Error('SESSION_CHANGED');
  };
  const profile = async uid => {
    assertSession(uid);
    let data = await read(account(uid));
    if (!data) {
      const name = (auth.currentUser?.displayName || auth.currentUser?.email || 'Conta de teste').slice(0, 80);
      data = await runTransaction(db, async tx => {
        assertSession(uid);
        const current = (await tx.get(account(uid))).data();
        if (current) return current;
        const initial = {uid, name, plan: 'free', blocked: false};
        tx.set(account(uid), initial);
        return initial;
      });
    }
    assertSession(uid);
    return data;
  };
  const role = async uid => operatorRole(await read(roleRef(uid)));
  const watch = (ref, fn, error) => onSnapshot(ref, {includeMetadataChanges: true}, snapshot => {
    if (!snapshot.metadata.fromCache) fn(snapshot.data());
  }, error);
  return {
    db, currentUid, profile, role, assertSession,
    onSession: (fn, error) => onAuthStateChanged(auth, fn, error),
    signIn: () => {
      if (!local) return signInWithPopup(auth, new GoogleAuthProvider());
      const form = document.getElementById('labCredentials');
      if (!form.reportValidity()) return;
      return signInWithEmailAndPassword(auth, form.elements.email.value, form.elements.password.value);
    },
    signOut: () => signOut(auth),
    watchAccount: (uid, fn, error) => watch(account(uid), fn, error),
    watchRole: (uid, fn, error) => watch(roleRef(uid), value => fn(operatorRole(value)), error),
    async reserveInvoice(uid) {
      assertSession(uid);
      await runTransaction(db, async tx => {
        assertSession(uid);
        const [profile, usage] = await Promise.all([tx.get(account(uid)), tx.get(usageRef(uid))]);
        const counts = nextCounts(usage.data(), profile.data()?.limits ?? DEFAULT_LIMITS);
        assertSession(uid);
        tx.set(usageRef(uid), {at: serverTimestamp(), ...counts});
      });
      assertSession(uid);
    },
    admin: uid => ({
      role: () => { assertSession(uid); return role(uid); },
      async list() {
        assertSession(uid);
        const page = await getDocsFromServer(query(collection(db, 'raytechV345Accounts'), limit(100)));
        return Promise.all(page.docs.map(async row => {
          const record = await read(roleRef(row.id));
          const role = operatorRole(record);
          const profile = row.data();
          const base = {...profile, role, protected: !!record};
          if (!role && profile.plan !== 'premium') return base;
          try {
            return {...base, limits: profile.limits ?? DEFAULT_LIMITS,
              usage: countsInWindow(await read(usageRef(row.id)))};
          } catch { return {...base, limits: undefined, usageUnavailable: true}; }
        }));
      },
      async audit() {
        assertSession(uid);
        const page = await getDocsFromServer(query(collection(db, 'raytechV345Audit'), orderBy('at', 'desc'), limit(100)));
        return page.docs.map(row => row.data());
      },
      change(target, patch) {
        assertSession(uid);
        if (target === uid) throw Error('PROTECTED_ACCOUNT');
        const id = crypto.randomUUID();
        return runTransaction(db, async tx => {
          assertSession(uid);
          const ref = account(target);
          const before = (await tx.get(ref)).data();
          if (!before) throw Error('ACCOUNT_NOT_FOUND');
          tx.update(ref, {plan: patch.plan, blocked: patch.blocked, limits: patch.limits, lastAudit: id});
          tx.set(doc(db, 'raytechV345Audit', id), {actor: uid, target, beforePlan: before.plan,
            afterPlan: patch.plan, beforeBlocked: before.blocked, afterBlocked: patch.blocked, at: serverTimestamp()});
        });
      },
    }),
  };
}
