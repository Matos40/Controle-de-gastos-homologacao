'use strict';
// I06: politica deterministica proposta, sem escrita, DOM ou integracao.
const {validateSnapshot}=require('./productionDataContractLab.js');
const {validateMarkers,marker}=require('./installmentDeletionPolicyLab.js');
const {isDeepStrictEqual}=require('node:util');
class MonthPolicyError extends Error{constructor(code){super(code);this.code=code;this.name='MonthPolicyError';}}
const fail=c=>{throw new MonthPolicyError(c);};
const clone=x=>JSON.parse(JSON.stringify(x));
const own=(o,k)=>Object.prototype.hasOwnProperty.call(o,k);
const month=/^\d{4}-(0[1-9]|1[0-2])$/;
function previous(ym){if(!month.test(ym))fail('invalid_month');const [y,m]=ym.split('-').map(Number);return m===1?(y-1)+'-12':y+'-'+String(m-1).padStart(2,'0');}
function normalizedTitle(t){return typeof t==='string'?t.trim().toLocaleLowerCase('pt-BR'):'';}
function stableId(prefix,key){return prefix+'_'+Buffer.from(key,'utf8').toString('hex').slice(0,90);}
function propose(snapshot,target,{futureDeletions={},mode='automatic'}={}){
 if(!['automatic','manual'].includes(mode))fail('invalid_mode');
 try{validateSnapshot(snapshot);}catch{fail('invalid_snapshot');}
 if(!month.test(target))fail('invalid_month');
 if(!futureDeletions||typeof futureDeletions!=='object'||Array.isArray(futureDeletions))fail('invalid_deletions');
 for(const [ym,keys] of Object.entries(futureDeletions)){
  if(!month.test(ym)||own(snapshot.months,ym))fail('invalid_future_month');
  try{validateMarkers(keys);}catch{fail('invalid_markers');}
 }
 const before=clone(snapshot),source=before.months[previous(target)];
 if(!source)fail('missing_previous_month');
 const existed=own(before.months,target);
 const destination=existed?clone(before.months[target]):{
  salary:source.salary,budgetLimit:source.budgetLimit||0,extraIncomes:[],
  expenses:[],cardExpenses:[],deletedInstallmentOrigins:[],closed:false,closedAt:null
 };
 if(destination.closed===true)fail('closed_month_requires_review');
 const keys=existed?(destination.deletedInstallmentOrigins||[]):(futureDeletions[target]||[]);
 try{validateMarkers(keys);}catch{fail('invalid_markers');}
 destination.deletedInstallmentOrigins=[...keys];
 const decisions=[],manualReview=[];
 const expenseTitles=new Set(destination.expenses.filter(x=>x.type==='fixed').map(x=>normalizedTitle(x.title)));
 for(const item of source.expenses.filter(x=>x.type==='fixed')){
  const title=normalizedTitle(item.title);
  if(!title){manualReview.push({type:'fixed',id:item.id,reason:'missing_title'});continue;}
  const duplicates=source.expenses.filter(x=>x.type==='fixed'&&normalizedTitle(x.title)===title);
  if(duplicates.length>1){manualReview.push({type:'fixed',id:item.id,reason:'ambiguous_fixed_title'});continue;}
  if(expenseTitles.has(title)){decisions.push({type:'fixed',id:item.id,action:'preserve_existing'});continue;}
  const id=stableId('fixed',target+':'+item.id);
  if(destination.expenses.some(x=>x.id===id)){manualReview.push({type:'fixed',id:item.id,reason:'id_collision'});continue;}
  destination.expenses.push({...item,id,date:target+'-01',paid:false});
  expenseTitles.add(title);
  decisions.push({type:'fixed',id:item.id,action:'create'});
 }
 const seen=new Set();
 for(const card of source.cardExpenses.filter(x=>x.isInstallment)){
  if(!Number.isSafeInteger(card.installments)||card.installments<2||
     !Number.isSafeInteger(card.currentInstallment)||card.currentInstallment<1||
     card.currentInstallment>card.installments){
   manualReview.push({type:'card',id:card.id,reason:'invalid_sequence'});continue;
  }
  if(card.currentInstallment===card.installments)continue;
  if(typeof card.installmentOriginId!=='string'||!card.installmentOriginId.trim()||
     card.installmentOriginId.includes(':')||card.installmentOriginId.includes('/')){
   manualReview.push({type:'card',id:card.id,reason:'unproven_origin'});continue;
  }
  const number=card.currentInstallment+1,key=marker(card.installmentOriginId,number);
  if(seen.has(key)){manualReview.push({type:'card',id:card.id,reason:'duplicate_source'});continue;}
  seen.add(key);
  if(keys.includes(key)){decisions.push({type:'card',id:card.id,key,action:'skip_deleted'});continue;}
  const matches=destination.cardExpenses.filter(x=>x.isInstallment&&
   x.installmentOriginId===card.installmentOriginId&&x.currentInstallment===number);
  if(matches.length>1){manualReview.push({type:'card',id:card.id,reason:'duplicate_target'});continue;}
  if(matches.length===1){decisions.push({type:'card',id:card.id,key,action:'preserve_existing'});continue;}
  const ambiguous=destination.cardExpenses.some(x=>x.isInstallment&&
   !x.installmentOriginId&&x.currentInstallment===number&&
   normalizedTitle(x.title)===normalizedTitle(card.title));
  if(ambiguous){manualReview.push({type:'card',id:card.id,reason:'ambiguous_target'});continue;}
  const id=stableId('card',target+':'+key);
  if(destination.cardExpenses.some(x=>x.id===id)){manualReview.push({type:'card',id:card.id,reason:'id_collision'});continue;}
  destination.cardExpenses.push({...card,id,currentInstallment:number,date:target+'-01',paid:false});
  decisions.push({type:'card',id:card.id,key,action:'create'});
 }
 // Politica fail-closed: nenhuma alteracao proposta enquanto houver ambiguidade.
 if(manualReview.length)return {status:'MANUAL_REVIEW_REQUIRED',target,decisions,manualReview,
  proposed:null,original:before};
 const proposed=clone(before);
 proposed.months[target]=destination;
 if(!isDeepStrictEqual(before,snapshot))fail('mutation_detected');
 return {status:'READY_IN_LAB',target,decisions,manualReview:[],proposed,original:before,
  changed:!isDeepStrictEqual(proposed,before)};
}
function compareModes(snapshot,target,options={}){
 const a=propose(snapshot,target,{...options,mode:'automatic'});
 const b=propose(snapshot,target,{...options,mode:'manual'});
 if(a.status!==b.status||!isDeepStrictEqual(a.proposed,b.proposed)||!isDeepStrictEqual(a.decisions,b.decisions))
  fail('mode_divergence');
 return {status:a.status,equivalent:true,automatic:a,manual:b};
}
module.exports={MonthPolicyError,previous,propose,compareModes};
