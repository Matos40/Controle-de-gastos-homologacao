import {outcomeRefs,transition} from './outcome.mjs';
import {BUDGET_COLLECTION,validateBudget,reserveBudget} from './global-budget.mjs';
import {decidePremium,ACCOUNT_COLLECTION,ROLE_COLLECTION} from './policy.mjs';
export const USAGE_COLLECTION='raytechLabUsageV342';
export const LIMITS_COLLECTION='raytechLabLimitsV343';
export const DEFAULT_LIMITS=Object.freeze({minute:3,day:20,month:100});
const validUid=uid=>typeof uid==='string'&&/^[A-Za-z0-9_-]{1,128}$/.test(uid);
export const validRequestId=id=>typeof id==='string'&&/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/.test(id);
export function validateLimits(limits){
 if(!limits||Object.keys(limits).length!==3||!['minute','day','month'].every(k=>Number.isSafeInteger(limits[k])&&limits[k]>=1&&limits[k]<=10000)||limits.minute>limits.day||limits.day>limits.month)throw Error('INVALID_LIMITS');
 return {...limits};
}
export function windows(now){
 if(!Number.isSafeInteger(now)||now<0)throw Error('INVALID_TIME');
 const iso=new Date(now).toISOString();
 return {minute:iso.slice(0,16),day:iso.slice(0,10),month:iso.slice(0,7)};
}
export function nextUsage(previous,now,limits=DEFAULT_LIMITS){
 const cap=validateLimits(limits),periods=windows(now),next={lastAt:now};
 if(previous!==undefined&&(!previous||!Number.isSafeInteger(previous.lastAt)||previous.lastAt>now))throw Error('INVALID_STATE');
 for(const k of ['minute','day','month']){
  const old=previous?.[k];
  if(previous!==undefined&&(!old||old.period!==windows(previous.lastAt)[k]||!Number.isSafeInteger(old.count)||old.count<1))throw Error('INVALID_STATE');
  const used=old?.period===periods[k]?old.count:0;
  if(used>=cap[k])return {status:429,error:'QUOTA_EXCEEDED'};
  next[k]={period:periods[k],count:used+1};
 }
 return {status:200,next};
}
// Transactions reserve an attempt, not a successful response. No automatic refund:
// provider failure or uncertain client disconnect may already have incurred cost.
export function createUsageStore(db,{limits=DEFAULT_LIMITS,clock=Date.now,budget=null,trackOutcomes=false}={}){
 const cap=validateLimits(limits),globalCap=budget===null?null:validateBudget(budget);
 return async ({uid,requestId})=>{
  if(!validUid(uid)||!validRequestId(requestId))return {status:400,error:'INVALID_REQUEST_ID'};
  const user=db.collection(USAGE_COLLECTION).doc(uid),request=user.collection('attempts').doc(requestId);
  try{
   return await db.runTransaction(async tx=>{
    const [profile,role,usage,attempt,override]=await tx.getAll(db.collection(ACCOUNT_COLLECTION).doc(uid),db.collection(ROLE_COLLECTION).doc(uid),user,request,db.collection(LIMITS_COLLECTION).doc(uid));
    if(!decidePremium(uid,profile.data(),role.data()))return {status:403,error:'ACCESS_DENIED'};
    if(attempt.exists)return {status:409,error:'DUPLICATE_REQUEST'};
    const now=clock(),decision=nextUsage(usage.data(),now,override.exists?validateLimits(override.data().limits):cap);
    if(decision.status!==200)return decision;
    let globalRef,globalNext;if(globalCap){globalRef=db.collection(BUDGET_COLLECTION).doc('global');const snapshot=await tx.get(globalRef),global=reserveBudget(snapshot.data(),now,globalCap);if(global.status!==200)return global;globalNext=global.next;}
    const refs=trackOutcomes?outcomeRefs(db,uid,now):[],counts=refs.length?await tx.getAll(...refs):[];const updated=counts.map(x=>transition(x.data(),'reserve'));
    if(globalRef)tx.set(globalRef,globalNext);refs.forEach((ref,i)=>tx.set(ref,updated[i]));
    tx.set(user,decision.next);
    tx.create(request,{reservedAt:now,...(trackOutcomes?{status:'pending'}:{})});
    return {status:200};
   });
  }catch{return {status:503,error:'USAGE_UNAVAILABLE'};}
 };
}
