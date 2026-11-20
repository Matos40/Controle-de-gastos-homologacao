import {COLLECTION,validUid,planOf,reserve,finish,monthOf,view} from './quota.mjs';
import {validRequestId} from '../legacy/usage.mjs';
import {reserveBudget,validateBudget} from '../legacy/global-budget.mjs';
import {transition} from '../legacy/outcome.mjs';
import {prepareMetrics,ADMIN_METRICS} from './admin-metrics.mjs';
import {financeRef,financeState,financeView} from './finance-guard.mjs';
export const RECOVERY_GRACE_MS=120000;
export const COMMERCIAL_ACCOUNTS='raytechV345Accounts';
export const COMMERCIAL_GLOBAL='raytechLabCommercialGlobalV350';
export const LAB_CAP={day:30,month:60,perAttempt:1};
const auditCollection='raytechLabCommercialAuditV350';
const refs=(db,uid,at)=>['global','user_'+uid].map(scope=>db.collection(auditCollection).doc(scope+'_'+monthOf(at)));
export function createCommercialStore(db,{clock=Date.now,budget=LAB_CAP,requireFinance=false}={}){
 const cap=validateBudget(budget);
 const userRef=uid=>db.collection(COLLECTION).doc(uid);
 const profileRef=uid=>db.collection(COMMERCIAL_ACCOUNTS).doc(uid);
 const budgetRef=db.collection(COMMERCIAL_GLOBAL).doc('budget');
 const configRef=db.collection(COMMERCIAL_GLOBAL).doc('config');
 const writeMetrics=(tx,rows)=>rows.forEach(({ref,value})=>tx.set(ref,value));
 async function recoverExpired(uid){
  if(!validUid(uid))throw Error('INVALID_UID');
  const user=userRef(uid);
  return db.runTransaction(async tx=>{
   const [state]=await tx.getAll(user),s=state.data();
   if(!s?.pending)return false;
   if(!validRequestId(s.pending))throw Error('INVALID_STATE');
   const attempt=user.collection('attempts').doc(s.pending);
   const [old]=await tx.getAll(attempt),a=old.data(),now=clock();
   if(!a||a.status!=='pending'||!Number.isSafeInteger(a.reservedAt)||a.reservedAt>now)throw Error('INVALID_STATE');
   if(now-a.reservedAt<RECOVERY_GRACE_MS)return false;
   const next=finish(s,a,s.pending,'failed',now);
   const ar=refs(db,uid,a.reservedAt),snap=await tx.getAll(...ar);
   const counters=snap.map(x=>transition(x.data(),'failed'));
   const metrics=a.adminMetrics===1?await prepareMetrics(tx,db,a.reservedAt,a.plan,'failed'):[];
   tx.set(user,next);tx.update(attempt,{status:'failed',finishedAt:now,recovery:'expired-undelivered'});
   ar.forEach((r,i)=>tx.set(r,counters[i]));
   writeMetrics(tx,metrics);
   return true;
  });
 }
 return {
 recoverExpired,
 async reserveUsage({uid,requestId}){
  if(!validUid(uid)||!validRequestId(requestId))return {status:400,error:'INVALID_REQUEST_ID'};
  const user=userRef(uid),attempt=user.collection('attempts').doc(requestId);
  try{await recoverExpired(uid);return await db.runTransaction(async tx=>{
   const [profile,state,old,global,config,finance]=await tx.getAll(profileRef(uid),user,attempt,budgetRef,configRef,financeRef(db));
   const now=clock(),plan=planOf(uid,profile.data(),now);
   if(!plan)return {status:403,error:'ACCESS_DENIED'};
   if(old.exists)return {status:409,error:'DUPLICATE_REQUEST'};
   const protection=financeView(financeState(finance.data()),now);
   if(protection.suspended||(requireFinance&&protection.observedCents===null)||config.data()?.enabled===false)
    return {status:503,error:requireFinance&&protection.suspended?'FINANCE_SUSPENDED':'USAGE_UNAVAILABLE'};
   const decision=reserve(state.data(),now,plan,requestId);
   if(decision.status!==200)return decision;
   const configuredBudget=config.data()?.budget;
   const globalDecision=reserveBudget(global.data(),now,configuredBudget===undefined?cap:validateBudget(configuredBudget));
   if(globalDecision.status!==200)return globalDecision;
   const ar=refs(db,uid,now),snap=await tx.getAll(...ar);
   const counters=snap.map(x=>transition(x.data(),'reserve'));
   const marker=db.collection(ADMIN_METRICS).doc('conversion_'+uid);
   const usage=db.collection(ADMIN_METRICS).doc('user_'+uid+'_'+monthOf(now));
   const conversionCandidate=plan==='premium'&&(state.data()?.free??0)>0;
   const [monthlyUser,conversionMark]=await tx.getAll(usage,...(conversionCandidate?[marker]:[]));
   const conversion=conversionCandidate&&!conversionMark.exists;
   const metrics=await prepareMetrics(tx,db,now,plan,'reserve',{newUser:!monthlyUser.exists,conversion});
   tx.set(user,decision.next);tx.create(attempt,{plan,month:monthOf(now),reservedAt:now,status:'pending',adminMetrics:1});
   tx.set(budgetRef,globalDecision.next);
   ar.forEach((r,i)=>tx.set(r,counters[i]));
   if(!monthlyUser.exists)tx.create(usage,{firstAt:now});
   if(conversion)tx.create(marker,{firstAt:now});
   writeMetrics(tx,metrics);
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
   const metrics=a.adminMetrics===1?await prepareMetrics(tx,db,a.reservedAt,a.plan,status):[];
   tx.set(user,next);tx.update(attempt,{status,finishedAt:now});
   ar.forEach((r,i)=>tx.set(r,counters[i]));
   writeMetrics(tx,metrics);
  });
 },
 async readCredits(uid,transaction){
  if(!validUid(uid))throw Error('ACCESS_DENIED');
  const read=async tx=>{
   const [profile,state,config,finance]=await tx.getAll(profileRef(uid),userRef(uid),
    ...(requireFinance?[configRef,financeRef(db)]:[]));
   const now=clock(),plan=planOf(uid,profile.data(),now);
   if(!plan)return null;
   const quota=state.data();
   const balance=view(quota,now,plan);
   if(requireFinance){
    const protection=financeView(financeState(finance.data()),now);
    balance.operational=protection.suspended?'suspended':config.data()?.enabled===false?'administrative':
     protection.observedCents===null?'unavailable':'available';
   }
   if(!balance.busy)return {plan,...balance};
   if(!validRequestId(quota.pending))throw Error('INVALID_STATE');
   const [pending]=await tx.getAll(userRef(uid).collection('attempts').doc(quota.pending));
   const attempt=pending.data();
   if(attempt?.status!=='pending'||!Number.isSafeInteger(attempt.reservedAt)||attempt.reservedAt>now)throw Error('INVALID_STATE');
   const busy=now-attempt.reservedAt<RECOVERY_GRACE_MS;
   const held=busy&&attempt.plan===plan&&(plan==='free'||attempt.month===balance.month);
   return {plan,...balance,remaining:balance.remaining+(held?0:1),busy};
  };
  return transaction?read(transaction):db.runTransaction(read,{readOnly:true});
 }
 };
}
