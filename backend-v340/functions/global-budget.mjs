// Laboratory-only conservative reservation in integer micro-BRL; not a provider tariff.
export const BUDGET_COLLECTION='raytechLabGlobalBudgetV3471';
export const LAB_BUDGET=Object.freeze({day:250000,month:1000000,perAttempt:10000});
const valid=n=>Number.isSafeInteger(n)&&n>=0;
export function validateBudget(c){if(!c||Object.keys(c).length!==3||!['day','month','perAttempt'].every(k=>valid(c[k])&&c[k]>0)||c.perAttempt>c.day||c.day>c.month)throw Error('INVALID_BUDGET');return {...c};}
export function budgetView(previous,now,config=LAB_BUDGET){
 const cap=validateBudget(config);
 if(!valid(now))throw Error('INVALID_TIME');
 const iso=new Date(now).toISOString(),periods={day:iso.slice(0,10),month:iso.slice(0,7)};
 if(previous!==undefined&&(!previous||!valid(previous.lastAt)||previous.lastAt>now))throw Error('INVALID_BUDGET_STATE');
 const used={},attempts={};
 for(const k of ['day','month']){
  const old=previous?.[k];
  if(previous!==undefined&&(!old||old.period!==new Date(previous.lastAt).toISOString().slice(0,k==='day'?10:7)||!valid(old.reserved)||!valid(old.attempts)||old.attempts<1||old.reserved<old.attempts))throw Error('INVALID_BUDGET_STATE');
  used[k]=old?.period===periods[k]?old.reserved:0;attempts[k]=old?.period===periods[k]?old.attempts:0;
 }
 if(used.day>used.month||attempts.day>attempts.month)throw Error('INVALID_BUDGET_STATE');
 return {simulated:true,unit:'micro-BRL',periods,used,attempts,limits:{day:cap.day,month:cap.month},perAttempt:cap.perAttempt};
}
export function reserveBudget(previous,now,config=LAB_BUDGET){
 const v=budgetView(previous,now,config),next={lastAt:now};
 for(const k of ['day','month']){
  if(v.used[k]>v.limits[k]-v.perAttempt)return {status:429,error:'GLOBAL_BUDGET_EXCEEDED'};
  if(!Number.isSafeInteger(v.attempts[k]+1))throw Error('INVALID_BUDGET_STATE');
  next[k]={period:v.periods[k],reserved:v.used[k]+v.perAttempt,attempts:v.attempts[k]+1};
 }
 return {status:200,next};
}
