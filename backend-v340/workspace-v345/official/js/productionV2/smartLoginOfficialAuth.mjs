import {initializeApp} from 'firebase/app';
import {getAuth, connectAuthEmulator, onAuthStateChanged, GoogleAuthProvider,
  signInWithPopup, signInWithEmailAndPassword, signOut} from 'firebase/auth';
import {getFirestore, connectFirestoreEmulator, doc, collection, getDocFromServer,
  getDocsFromServer, query, orderBy, limit, onSnapshot, runTransaction, serverTimestamp} from 'firebase/firestore';
import {environment} from './config.mjs';
import {DEFAULT_LIMITS} from './v345Usage.mjs';
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
  const roleRef = uid => doc(db, 'raytechV345Roles', uid);
  const read = async ref => (await getDocFromServer(ref)).data();
  const assertSession = uid => {
    if (currentUid() !== uid) throw Error('SESSION_CHANGED');
  };
  const ai=async(uid,endpoint,body,id)=>{
    assertSession(uid);
    if(!local||location.origin!=='http://127.0.0.1:15003'||!navigator.onLine)throw Error('AI_UNAVAILABLE');
    const token=await auth.currentUser.getIdToken();assertSession(uid);
    const res=await fetch('/api/'+endpoint,{method:'POST',headers:{authorization:'Bearer '+token,'content-type':'application/json',...(id?{'x-request-id':id}:{})},body:JSON.stringify(body),cache:'no-store',redirect:'error',signal:AbortSignal.timeout(35000)});
    const result=await res.json();assertSession(uid);if(!res.ok)throw Error(result.error||'ACCESS_DENIED');return result;
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
  const watch = (ref, fn, error, unavailable) => {
    let sawServer = false;
    return onSnapshot(ref, {includeMetadataChanges: true}, snapshot => {
      if (snapshot.metadata.fromCache) {
        if (sawServer) unavailable?.();
        return;
      }
      sawServer = true;
      fn(snapshot.data());
    }, error);
  };
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
    watchAccount: (uid, fn, error, unavailable) => watch(account(uid), fn, error, unavailable),
    watchRole: (uid, fn, error, unavailable) => watch(roleRef(uid), value => fn(operatorRole(value)), error, unavailable),
    async extractInvoice(uid) {
      return ai(uid,'workspaceExtractInvoice',{feature:'invoice-ai',mimeType:'application/pdf',data:btoa('%PDF-1.4\n% synthetic workspace\n%%EOF\n')},crypto.randomUUID());
    },
    async authorizeInvoice(uid) {
      const out=await ai(uid,'workspaceAuthorizeInvoice',{feature:'invoice-ai'});if(out.allowed!==true)throw Error('ACCESS_DENIED');
    },
    admin: uid => ({
      role: () => { assertSession(uid); return role(uid); },
      async monitor() {return ai(uid,'workspaceUsageAdmin',{action:'list',after:null});},
      async list() {
        assertSession(uid);
        const page = await getDocsFromServer(query(collection(db, 'raytechV345Accounts'), limit(100)));
        return Promise.all(page.docs.map(async row => {
          const record = await read(roleRef(row.id));
          const role = operatorRole(record);
          const profile = row.data();
          const base = {...profile, role, protected: !!record};
          // Free profiles can retain configured limits and historical consumption after downgrade.
          // Never pass limits without usage to the view. Ask the authorized backend for every account.
          try {
            const {row:metrics}=await ai(uid,'workspaceUsageAdmin',{action:'get',uid:row.id});
            return {...base, limits:metrics.limits,usage:metrics.used,outcome:metrics.outcome,readerEnabled:!profile.blocked&&(!!role||profile.plan==='premium')};
          } catch { return {...base, limits: undefined, usage: undefined, usageUnavailable: true}; }
        }));
      },
      async audit() {
        assertSession(uid);
        const page = await getDocsFromServer(query(collection(db, 'raytechV345Audit'), orderBy('at', 'desc'), limit(100)));
        const events=page.docs.map(row => row.data());
        assertSession(uid); return events;
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
