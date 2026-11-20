import {COLLECTION,validUid,planOf,reserve,finish,monthOf,view} from './quota.mjs';
import {validRequestId} from '../legacy/usage.mjs';
import {reserveBudget,validateBudget} from '../legacy/global-budget.mjs';
import {transition} from '../legacy/outcome.mjs';
const accounts='raytechV345Accounts';
const globalCollection='raytechLabCommercialGlobalV350';
const auditCollection='raytechLabCommercialAuditV350';
const refs=(db,uid,at)=>['global','user_'+uid].map(scope=>db.collection(auditCollection).doc(scope+'_'+monthOf(at)));
export function createCommercialStore(db,{clock=Date.now,budget={day:30,month:60,perAttempt:1}}={}){
 const cap=validateBudget(budget);
 const userRef=uid=>db.collection(COLLECTION).doc(uid);
 const profileRef=uid=>db.collection(accounts).doc(uid);
 const budgetRef=db.collection(globalCollection).doc('budget');
 const configRef=db.collection(globalCollection).doc('config');
 return {
 async reserveUsage({uid,requestId}){
  if(!validUid(uid)||!validRequestId(requestId))return {status:400,error:'INVALID_REQUEST_ID'};
  const user=userRef(uid),attempt=user.collection('attempts').doc(requestId);
  try{return await db.runTransaction(async tx=>{
   const [profile,state,old,global,config]=await tx.getAll(profileRef(uid),user,attempt,budgetRef,configRef);
   const now=clock(),plan=planOf(uid,profile.data(),now);
   if(!plan)return {status:403,error:'ACCESS_DENIED'};
   if(old.exists)return {status:409,error:'DUPLICATE_REQUEST'};
   if(config.data()?.enabled===false)return {status:503,error:'USAGE_UNAVAILABLE'};
   const decision=reserve(state.data(),now,plan,requestId);
   if(decision.status!==200)return decision;
   const globalDecision=reserveBudget(global.data(),now,config.exists?validateBudget(config.data().budget):cap);
   if(globalDecision.status!==200)return globalDecision;
   const ar=refs(db,uid,now),snap=await tx.getAll(...ar);
   const counters=snap.map(x=>transition(x.data(),'reserve'));
   tx.set(user,decision.next);tx.create(attempt,{plan,month:monthOf(now),reservedAt:now,status:'pending'});
   tx.set(budgetRef,globalDecision.next);
   ar.forEach((r,i)=>tx.set(r,counters[i]));
   return {status:200};
  });}catch{return {status:503,error:'USAGE_UNAVAILABLE'};}
 },
 async finishOutcome({uid,requestId,status}){
  if(!validUid(uid)||!validRequestId(requestId))throw Error('INVALID_REQUEST_ID');
  const user=userRef(uid),attempt=user.collection('attempts').doc(requestId);
  return db.runTransaction(async tx=>{
   const [state,old]=await tx.getAll(user,attempt),a=old.data(),now=clock();
   const next=finish(state.data(),a,requestId,status,now);
   if(!next)return;
   const ar=refs(db,uid,a.reservedAt),snap=await tx.getAll(...ar);
   const counters=snap.map(x=>transition(x.data(),status));
   tx.set(user,next);tx.update(attempt,{status,finishedAt:now});
   ar.forEach((r,i)=>tx.set(r,counters[i]));
  });
 },
 async readCredits(uid){
  if(!validUid(uid))throw Error('ACCESS_DENIED');
  return db.runTransaction(async tx=>{
   const [profile,state]=await tx.getAll(profileRef(uid),userRef(uid));
   const now=clock(),plan=planOf(uid,profile.data(),now);
   if(!plan)throw Error('ACCESS_DENIED');
   return {plan,...view(state.data(),now,plan)};
  },{readOnly:true});
 }
 };
}
