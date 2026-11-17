// Authentication only. No finance database access or writes.
export async function openSmartLoginAuth({location=globalThis.location,load=()=>import('./smartLoginTestConfig.mjs'),sdk=()=>Promise.all([import('https://www.gstatic.com/firebasejs/11.10.0/firebase-app.js'),import('https://www.gstatic.com/firebasejs/11.10.0/firebase-auth.js')])}={}){
 const {SMART_LOGIN_TEST_CONFIG:f}=await load();
 if(!f||f.projectId!=='raytech-cg-homologacao'||f.authDomain!=='raytech-cg-homologacao.firebaseapp.com'||!f.apiKey||!f.appId||!(['https://raytech-cg-homologacao.firebaseapp.com','https://raytech-cg-homologacao.web.app'].includes(location?.origin)||(location?.origin==='https://matos40.github.io'&&location.pathname.startsWith('/Controle-de-gastos-homologacao/smart-v333/'))))throw Error('SMART_LOGIN_TEST_CONFIG_REQUIRED');
 const [appSdk,authSdk]=await sdk();
 const name='raytech-smart-admin-v333-homologacao';
 const app=appSdk.getApps().find(a=>a.name===name)??appSdk.initializeApp(f,name);
 const auth=authSdk.getAuth(app);
 await authSdk.setPersistence(auth,authSdk.browserLocalPersistence);
 const fire=await import('https://www.gstatic.com/firebasejs/11.10.0/firebase-firestore.js');
 const db=fire.getFirestore(app);
 const {registerFree}=await import('./smartLoginProfiles.mjs');
 const profile=uid=>registerFree({uid,now:()=>fire.serverTimestamp(),transaction:fn=>fire.runTransaction(db,async tx=>{
 const ref=who=>{if(auth.currentUser?.uid!==who)throw Error('ACCOUNT_SESSION_CHANGED');return fire.doc(db,'raytechAccountsV333',who);};
 return fn({read:async who=>{const s=await tx.get(ref(who));return s.exists()?s.data():null;},create:async(who,data)=>tx.set(ref(who),data),touch:async(who,data)=>tx.update(ref(who),data)});
 })});
 const guard=uid=>{if(auth.currentUser?.uid!==uid)throw Error('ACCOUNT_SESSION_CHANGED');};
 const accountRef=uid=>fire.doc(db,'raytechAccountsV333',uid);
 const roleRef=uid=>fire.doc(db,'raytechAdminRolesV333',uid);
 const {operatorRole,accountChange}=await import('./smartAdminPolicy.mjs');
 const role=async uid=>{guard(uid);const s=await fire.getDocFromServer(roleRef(uid));guard(uid);return operatorRole(s.data());};
 const account=async uid=>{guard(uid);const s=await fire.getDocFromServer(accountRef(uid));guard(uid);return s.data();};
 const watchAccount=(uid,fn,error)=>{guard(uid);return fire.onSnapshot(accountRef(uid),s=>{if(auth.currentUser?.uid===uid&&!s.metadata.fromCache)fn(s.data());},error);};
 const watchRole=(uid,fn,error)=>{guard(uid);return fire.onSnapshot(roleRef(uid),s=>{if(auth.currentUser?.uid===uid&&!s.metadata.fromCache)fn(operatorRole(s.data()));},error);};
 const admin=uid=>({role:()=>role(uid),list:async()=>{guard(uid);if(!await role(uid))throw Error('ADMIN_DENIED');const s=await fire.getDocsFromServer(fire.query(fire.collection(db,'raytechAccountsV333'),fire.limit(100)));guard(uid);return s.docs.map(d=>d.data());},audit:async()=>{guard(uid);if(!await role(uid))throw Error('ADMIN_DENIED');const s=await fire.getDocsFromServer(fire.query(fire.collection(db,'raytechAdminAuditV333'),fire.orderBy('at','desc'),fire.limit(100)));guard(uid);return s.docs.map(d=>d.data());},change:async(target,patch)=>{guard(uid);if(!await role(uid))throw Error('ADMIN_DENIED');await fire.runTransaction(db,async tx=>{guard(uid);const ref=accountRef(target),s=await tx.get(ref);const event=accountChange(uid,target,s.data(),patch);const audit=fire.doc(fire.collection(db,'raytechAdminAuditV333'));guard(uid);tx.update(ref,{plan:patch.plan,blocked:patch.blocked,lastAudit:audit.id});tx.set(audit,{...event,at:fire.serverTimestamp()});});}});
 const cloudRef=uid=>{if(auth.currentUser?.uid!==uid)throw Error('ACCOUNT_SESSION_CHANGED');return fire.doc(db,'raytechSmartCloudV333',uid);};
 const cloud=uid=>({read:async()=>{const s=await fire.getDocFromServer(cloudRef(uid));return s.exists()?s.data():null;},write:(expected,next)=>fire.runTransaction(db,async tx=>{const ref=cloudRef(uid),s=await tx.get(ref),actual=s.exists()?s.data():null;if(JSON.stringify(actual&&[actual.revision,actual.payload])!==JSON.stringify(expected&&[expected.revision,expected.payload]))throw Error('CLOUD_RETRY');cloudRef(uid);tx.set(ref,next);}),listen:(fn,error)=>fire.onSnapshot(cloudRef(uid),s=>{if(!s.metadata.fromCache)fn();},error)});
 return Object.freeze({admin,role,account,watchAccount,watchRole,cloud,currentUid:()=>auth.currentUser?.uid??null,profile,onSession:(fn,error)=>authSdk.onAuthStateChanged(auth,fn,error),signIn:()=>authSdk.signInWithPopup(auth,new authSdk.GoogleAuthProvider()),signOut:()=>authSdk.signOut(auth)});
}
