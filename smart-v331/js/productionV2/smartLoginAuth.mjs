// Authentication only. No finance database access or writes.
export async function openSmartLoginAuth({location=globalThis.location,load=()=>import('./smartLoginTestConfig.mjs'),sdk=()=>Promise.all([import('https://www.gstatic.com/firebasejs/11.10.0/firebase-app.js'),import('https://www.gstatic.com/firebasejs/11.10.0/firebase-auth.js')])}={}){
 const {SMART_LOGIN_TEST_CONFIG:f}=await load();
 if(!f||f.projectId!=='raytech-cg-homologacao'||f.authDomain!=='raytech-cg-homologacao.firebaseapp.com'||!f.apiKey||!f.appId||!(['https://raytech-cg-homologacao.firebaseapp.com','https://raytech-cg-homologacao.web.app'].includes(location?.origin)||(location?.origin==='https://matos40.github.io'&&location.pathname.startsWith('/Controle-de-gastos-homologacao/smart-v331/'))))throw Error('SMART_LOGIN_TEST_CONFIG_REQUIRED');
 const [appSdk,authSdk]=await sdk();
 const name='raytech-smart-login-homologacao';
 const app=appSdk.getApps().find(a=>a.name===name)??appSdk.initializeApp(f,name);
 const auth=authSdk.getAuth(app);
 await authSdk.setPersistence(auth,authSdk.browserLocalPersistence);
 const fire=await import('https://www.gstatic.com/firebasejs/11.10.0/firebase-firestore.js');
 const db=fire.getFirestore(app);
 const {registerFree}=await import('./smartLoginProfiles.mjs');
 const profile=uid=>registerFree({uid,now:()=>fire.serverTimestamp(),transaction:fn=>fire.runTransaction(db,async tx=>{
 const ref=who=>{if(auth.currentUser?.uid!==who)throw Error('ACCOUNT_SESSION_CHANGED');return fire.doc(db,'raytechSmartLoginProfilesV331',who);};
 return fn({read:async who=>{const s=await tx.get(ref(who));return s.exists()?s.data():null;},create:async(who,data)=>tx.set(ref(who),data),touch:async(who,data)=>tx.update(ref(who),data)});
 })});
 return Object.freeze({currentUid:()=>auth.currentUser?.uid??null,profile,onSession:(fn,error)=>authSdk.onAuthStateChanged(auth,fn,error),signIn:()=>authSdk.signInWithPopup(auth,new authSdk.GoogleAuthProvider()),signOut:()=>authSdk.signOut(auth)});
}
