import {createHash} from 'node:crypto';
import {getApps,initializeApp} from 'firebase-admin/app';
import {getAuth} from 'firebase-admin/auth';
import {getFirestore} from 'firebase-admin/firestore';
import {assertLocalEmulators,PROJECT} from './emulator-guard.mjs';
import {ACCOUNT_COLLECTION,ROLE_COLLECTION} from './policy.mjs';
import {commitV2,validateV2Head,validateV2Receipt} from '../workspace-v345/official/js/productionV2/capacity.mjs';
import {canonical} from '../workspace-v345/official/js/productionV2/model.mjs';
export const COLLECTION='raytechLabFinanceV345';
export const hash=p=>createHash('sha256').update(p).digest('hex');
export const scopedId=(uid,workspace)=>{if(!/^[A-Za-z0-9_-]{1,128}$/.test(uid)||!['v2-main','v2-clean','legacy'].includes(workspace))throw Error('INVALID_SCOPE');return uid+':'+workspace;};
export async function financeRequest({token,body}){
 assertLocalEmulators();
 const app=getApps()[0]??initializeApp({projectId:PROJECT});
 if(app.options.projectId!==PROJECT)throw Error('PROJECT_MISMATCH');
 const {uid}=await getAuth(app).verifyIdToken(token,true),db=getFirestore(app);
 const {workspace,action,command,expected}=body??{},id=scopedId(uid,workspace);
 if(workspace!=='v2-main')throw Error('SYNC_MAIN_ONLY');
 const ref=db.collection(COLLECTION).doc(id),receipt=op=>{if(!/^[A-Za-z0-9_-]{1,128}$/.test(op))throw Error('INVALID_OPERATION');return ref.collection('receipts').doc(op);};
 const authorized=async tx=>{const [a,r]=await tx.getAll(db.collection(ACCOUNT_COLLECTION).doc(uid),db.collection(ROLE_COLLECTION).doc(uid));const account=a.data(),role=r.data();if(account?.uid!==uid||account.blocked!==false||!(account.plan==='premium'||role?.active===true&&['admin','owner'].includes(role.role)))throw Error('ACCESS_DENIED');};
 if(action==='approved')return db.runTransaction(async tx=>{await authorized(tx);return {writeEnabled:true};});
 if(action==='send')return commitV2({currentUid:()=>uid,sha:async p=>hash(p),transaction:fn=>db.runTransaction(async tx=>{await authorized(tx);return fn({getHead:async()=> (await tx.get(ref)).data()??null,getReceipt:async(_,op)=>(await tx.get(receipt(op))).data()??null,setHead:(_,v)=>tx.set(ref,v),setReceipt:(_,op,v)=>tx.create(receipt(op),v)});})},uid,command);
 if(action==='read')return db.runTransaction(async tx=>{await authorized(tx);const s=await tx.get(ref);if(!s.exists)return null;const head=validateV2Head(s.data()),r=validateV2Receipt((await tx.get(receipt(head.lastOperationId))).data());if(r.hash!==head.hash||r.revision!==head.revision||r.operationId!==head.lastOperationId||hash(head.payload)!==head.hash)throw Error('INTEGRITY');return {head,receipt:r};});
 if(action==='confirm')return db.runTransaction(async tx=>{await authorized(tx);validateV2Receipt(expected);const s=await tx.get(receipt(expected.operationId));return s.exists&&canonical(s.data())===canonical(expected);});
 throw Error('INVALID_ACTION');
}
