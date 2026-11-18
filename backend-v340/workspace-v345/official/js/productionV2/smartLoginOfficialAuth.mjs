import {initializeApp} from 'firebase/app';
import {getAuth, connectAuthEmulator, onAuthStateChanged, GoogleAuthProvider,
  signInWithPopup, signInWithEmailAndPassword, signOut} from 'firebase/auth';
import {getFirestore, connectFirestoreEmulator, doc, collection, getDocFromServer,
  getDocsFromServer, query, orderBy, limit, onSnapshot, runTransaction, serverTimestamp} from 'firebase/firestore';
import {environment,collectionName} from './config.mjs';
import {DEFAULT_LIMITS} from './v345Usage.mjs';
import {operatorRole} from './smartAdminPolicy.mjs';
import {googleProfileFromToken, adminIdentity} from './googleAdminProfile.mjs';

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
  const profileSyncs = new Map();
  const account = uid => doc(db, collectionName('Accounts'), uid);
  const roleRef = uid => doc(db, collectionName('Roles'), uid);
  const read = async ref => (await getDocFromServer(ref)).data();
  const assertSession = uid => {
    if (currentUid() !== uid) throw Error('SESSION_CHANGED');
  };
  function syncGoogleProfile(uid, current) {
    if (profileSyncs.has(uid)) return;
    const user = auth.currentUser;
    const sync = (async () => {
      const {claims} = await user.getIdTokenResult();
      assertSession(uid);
      if (auth.currentUser !== user || !googleProfileFromToken(claims, current.googleProfile)) return;
      await runTransaction(db, async tx => {
        assertSession(uid);
        const ref = account(uid);
        const fresh = (await tx.get(ref)).data();
        assertSession(uid);
        if (auth.currentUser !== user || fresh?.uid !== uid || fresh.blocked !== false) return;
        const googleProfile = googleProfileFromToken(claims, fresh.googleProfile);
        if (googleProfile) tx.update(ref, {googleProfile});
      });
    })();
    profileSyncs.set(uid, sync);
    void sync.catch(error => console.warn('[Smart Admin] Perfil Google não sincronizado', error.code ?? 'unavailable'))
      .finally(() => profileSyncs.delete(uid));
  }
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
    if (!data && !local) throw Error('HOMOLOGATION_TEST_ACCOUNT_REQUIRED');
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
    if (!local && data.uid === uid && data.blocked === false) syncGoogleProfile(uid, data);
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
    db, currentUid, profile, role, assertSession, invoiceBackendAvailable:local,
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
      async monitor() {assertSession(uid);return local?ai(uid,'workspaceUsageAdmin',{action:'list',after:null}):{unavailable:true};},
      async list() {
        assertSession(uid);
        const page = await getDocsFromServer(query(collection(db, collectionName('Accounts')), limit(100)));
        return Promise.all(page.docs.map(async row => {
          const record = await read(roleRef(row.id));
          const role = operatorRole(record);
          const profile = row.data();
          const base = {...adminIdentity(profile), role, protected: !!record};
          if(!local)return {...base,limits:profile.limits??(role||profile.plan==='premium'?DEFAULT_LIMITS:undefined),usageUnavailable:true,readerEnabled:false};
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
        const page = await getDocsFromServer(query(collection(db, collectionName('Audit')), orderBy('at', 'desc'), limit(100)));
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
          tx.set(doc(db, collectionName('Audit'), id), {actor: uid, target, beforePlan: before.plan,
            afterPlan: patch.plan, beforeBlocked: before.blocked, afterBlocked: patch.blocked, at: serverTimestamp()});
        });
      },
    }),
  };
}
