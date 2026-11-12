'use strict';
// I02: reconciliacao conservadora de parcelas legadas. Nunca atribui origem inferida.
const {validateSnapshot}=require('./productionDataContractLab.js');
const {balances}=require('./reversibleFinanceMigrationLab.js');
const {validateMarkers,marker}=require('./installmentDeletionPolicyLab.js');
const {isDeepStrictEqual}=require('node:util');
class LegacyReconcileError extends Error{constructor(code){super(code);this.code=code;}}
const fail=c=>{throw new LegacyReconcileError(c);};
const clone=x=>JSON.parse(JSON.stringify(x));
const own=(o,k)=>Object.prototype.hasOwnProperty.call(o,k);
const ym=/^\d{4}-(0[1-9]|1[0-2])$/;
function nextMonth(m){const [y,n]=m.split('-').map(Number);return n===12?(y+1)+'-01':y+'-'+String(n+1).padStart(2,'0');}
function signature(c){return JSON.stringify([c.title,c.installments,c.installmentValue,c.totalAmount??null,c.category??null]);}
function reconcile(snapshot,{futureDeletions={}}={}){
 try{validateSnapshot(snapshot);}catch{fail('invalid_snapshot');}
 if(!futureDeletions||typeof futureDeletions!=='object'||Array.isArray(futureDeletions))fail('invalid_deletions');
 const before=clone(snapshot),months=Object.keys(before.months).sort(),report=[],blocked=[];
 const deletions={};
 for(const m of months){const keys=before.months[m].deletedInstallmentOrigins||[];try{validateMarkers(keys);}catch{fail('invalid_markers');}deletions[m]=[...keys];}
 for(const [m,keys] of Object.entries(futureDeletions)){
  if(!ym.test(m)||own(before.months,m))fail('invalid_future_month');
  try{validateMarkers(keys);}catch{fail('invalid_markers');}
  deletions[m]=[...keys];
 }
 const seen=new Map();
 for(const m of months)for(const card of before.months[m].cardExpenses){
  if(!card.isInstallment)continue;
  if(!Number.isSafeInteger(card.installments)||card.installments<2||
    !Number.isSafeInteger(card.currentInstallment)||card.currentInstallment<1||
    card.currentInstallment>card.installments)fail('invalid_sequence');
  if(card.installmentOriginId!==undefined&&
    (typeof card.installmentOriginId!=='string'||!card.installmentOriginId.trim()||
    card.installmentOriginId.includes(':')||card.installmentOriginId.includes('/')))fail('invalid_origin');
  const id=m+':'+card.id,group=signature(card);
  const entry={month:m,id:card.id,installment:card.currentInstallment,total:card.installments,
   status:card.installmentOriginId?'explicit_origin':'requires_review',reason:null};
  if(card.installmentOriginId){
   const key=card.installmentOriginId+':'+card.currentInstallment;
   if(seen.has(m+':'+key)){entry.status='requires_review';entry.reason='duplicate_explicit_origin';}
   seen.set(m+':'+key,true);
  }else{
   const next=nextMonth(m);
   const candidates=(before.months[next]?.cardExpenses||[]).filter(x=>x.isInstallment&&
    x.currentInstallment===card.currentInstallment+1&&signature(x)===group);
   const peers=before.months[m].cardExpenses.filter(x=>x.isInstallment&&
    x.currentInstallment===card.currentInstallment&&signature(x)===group);
   entry.reason=peers.length>1||candidates.length>1?'ambiguous_match':'missing_proven_origin';
  }
  report.push(entry);
  if(entry.status==='requires_review')blocked.push(id);
 }
 const result={status:blocked.length?'MANUAL_REVIEW_REQUIRED':'NO_LEGACY_AMBIGUITY',
  report,blocked,deletions,original:before,balances:balances(before)};
 if(!isDeepStrictEqual(snapshot,before))fail('mutation_detected');
 return result;
}
function safePlan(snapshot,sourceMonth,{futureDeletions={}}={}){
 const audit=reconcile(snapshot,{futureDeletions});
 if(!ym.test(sourceMonth)||!own(snapshot.months,sourceMonth))fail('invalid_source_month');
 const target=nextMonth(sourceMonth);
 const sources=snapshot.months[sourceMonth].cardExpenses.filter(x=>x.isInstallment&&x.currentInstallment<x.installments);
 const decisions=[];
 for(const c of sources){
  if(!c.installmentOriginId){decisions.push({id:c.id,action:'manual_review',reason:'missing_proven_origin'});continue;}
  const key=marker(c.installmentOriginId,c.currentInstallment+1);
  const all=snapshot.months[sourceMonth].cardExpenses.filter(x=>x.isInstallment&&x.installmentOriginId===c.installmentOriginId&&x.currentInstallment===c.currentInstallment);
  const existing=(snapshot.months[target]?.cardExpenses||[]).filter(x=>x.isInstallment&&x.installmentOriginId===c.installmentOriginId&&x.currentInstallment===c.currentInstallment+1);
  let action='create';
  if(all.length!==1||existing.length>1)action='manual_review';
  else if((audit.deletions[target]||[]).includes(key))action='skip_deleted';
  else if(existing.length===1)action='skip_existing';
  decisions.push({id:c.id,key,action});
 }
 return {target,decisions,created:decisions.filter(x=>x.action==='create').length,
  original:audit.original,balances:audit.balances,blocked:audit.blocked};
}
module.exports={LegacyReconcileError,reconcile,safePlan,nextMonth};
