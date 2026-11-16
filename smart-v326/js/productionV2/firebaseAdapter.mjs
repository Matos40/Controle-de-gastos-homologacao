import {PRODUCTION_CONFIG,requireProductionConfig} from './config.mjs';
import {commitV2,validateV2Head,validateV2Receipt} from './capacity.mjs';
import {canonical} from './model.mjs';
import {canTransfer} from './cleanWorkspace.mjs';
const sha=async p=>Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(p))),b=>b.toString(16).padStart(2,'0')).join('');
export async function openProductionCloud(config=PRODUCTION_CONFIG){
 const f=requireProductionConfig(config,globalThis.location);
 const [appSdk,authSdk,fire]=await Promise.all([
  import('https://www.gstatic.com/firebasejs/11.10.0/firebase-app.js'),
  import('https://www.gstatic.com/firebasejs/11.10.0/firebase-auth.js'),
  import('https://www.gstatic.com/firebasejs/11.10.0/firebase-firestore.js')
 ]);
 const app=appSdk.initializeApp(f,'raytech-production-v2'),auth=authSdk.getAuth(app),db=fire.getFirestore(app);
 const currentUid=()=>auth.currentUser?.uid??null,verifyUid=uid=>{if(!/^[A-Za-z0-9_-]{1,128}$/.test(uid)||currentUid()!==uid)throw Error('PRODUCTION_UID');};
 const headRef=uid=>fire.doc(db,'raytechSmart326FinanceV1',uid);
 const receiptRef=(uid,op)=>fire.doc(db,'raytechSmart326FinanceV1',uid,'receipts',op);
 async function approved(uid,{write=false}={}){verifyUid(uid);const access=await fire.getDocFromServer(fire.doc(db,'raytechSmart326AccessV1',uid));verifyUid(uid);if(!access.exists()||access.data().enabled!==true)throw Error('PRODUCTION_NOT_APPROVED');if(write&&access.data().writeEnabled!==true)throw Error('PRODUCTION_WRITE_NOT_APPROVED');return {writeEnabled:access.data().writeEnabled===true};}
 const api={currentUid,sha,transaction:fn=>fire.runTransaction(db,tx=>fn({
  getHead:async uid=>{verifyUid(uid);const a=await tx.get(headRef(uid));return a.exists()?a.data():null;},
  getReceipt:async(uid,op)=>{verifyUid(uid);const a=await tx.get(receiptRef(uid,op));return a.exists()?a.data():null;},
  setHead:(uid,x)=>{verifyUid(uid);tx.set(headRef(uid),x);},
  setReceipt:(uid,op,x)=>{verifyUid(uid);tx.set(receiptRef(uid,op),x);}
 }),{maxAttempts:3})};
 return {
  currentUid, onSession:fn=>authSdk.onAuthStateChanged(auth,fn),
  signIn:()=>authSdk.signInWithPopup(auth,new authSdk.GoogleAuthProvider()),
  signOut:()=>authSdk.signOut(auth),approved,
  watchHead(uid,notify,onError){verifyUid(uid);if(!canTransfer(config,globalThis.location?.search??''))throw Error('PRODUCTION_TRANSFER_DISABLED');if(typeof fire.onSnapshot!=='function')return ()=>{};let count=0,off=null,closed=false;const stop=()=>{closed=true;off?.();};off=fire.onSnapshot(headRef(uid),{includeMetadataChanges:true},snap=>{if(closed||currentUid()!==uid||snap.metadata?.fromCache||snap.metadata?.hasPendingWrites)return;if(++count>12){stop();onError?.(Error('PRODUCTION_LISTENER_WINDOW'));return;}const data=snap.exists()?snap.data():null;notify(data?.revision??0);},onError);if(closed)off();return stop;},
  async read(uid){await approved(uid);const result=await fire.runTransaction(db,async tx=>{
    verifyUid(uid);const s=await tx.get(headRef(uid));if(!s.exists())return null;
    const head=validateV2Head(s.data()),r=await tx.get(receiptRef(uid,head.lastOperationId));
    if(!r.exists())throw Error('PRODUCTION_RECEIPT_MISSING');
    const receipt=validateV2Receipt(r.data());
    if(receipt.operationId!==head.lastOperationId||receipt.revision!==head.revision||receipt.hash!==head.hash||await sha(head.payload)!==head.hash)throw Error('PRODUCTION_INTEGRITY');
    verifyUid(uid);return {head,receipt};
   },{maxAttempts:3});verifyUid(uid);return result;},
  async send(uid,command){if(!canTransfer(config,globalThis.location?.search??''))throw Error('PRODUCTION_TRANSFER_DISABLED');await approved(uid,{write:true});return commitV2(api,uid,command);},
  async confirm(uid,expected){await approved(uid);const s=await fire.getDocFromServer(receiptRef(uid,expected.operationId));verifyUid(uid);if(!s.exists())return false;return canonical(validateV2Receipt(s.data()))===canonical(expected);}
 };
}
