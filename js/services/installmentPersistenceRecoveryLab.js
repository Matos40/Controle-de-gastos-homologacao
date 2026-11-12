'use strict';
// Simulador de persistencia atomica em memoria; NAO grava disco nem integra app.
const {createBackup,verifyBackup}=require('./backupRecoveryLab.js');
const {marker,validateMarkers,plan}=require('./installmentDeletionPolicyLab.js');
class PersistenceError extends Error{constructor(code){super(code);this.name='PersistenceError';this.code=code;}}
const fail=code=>{throw new PersistenceError(code);};
const own=(o,k)=>Object.prototype.hasOwnProperty.call(o,k);
const clone=x=>JSON.parse(JSON.stringify(x));
function canonical(x){
 if(Array.isArray(x))return x.map(canonical);
 if(x&&typeof x==='object'){
  const out={};for(const key of Object.keys(x).sort())out[key]=canonical(x[key]);
  return out;
 }
 return x;
}
const same=(a,b)=>JSON.stringify(canonical(a))===JSON.stringify(canonical(b));
const validMonth=x=>/^\d{4}-(0[1-9]|1[0-2])$/.test(x);
function validate(s){
 if(!s||typeof s!=='object'||Array.isArray(s)||!s.months||typeof s.months!=='object'||
 Array.isArray(s.months)||!s.deletions||typeof s.deletions!=='object'||Array.isArray(s.deletions)||
 !validMonth(s.selectedMonth)||!own(s.months,s.selectedMonth))fail('invalid_state');
 for(const [month,keys] of Object.entries(s.deletions)){
  if(!validMonth(month))fail('invalid_month');
  try{validateMarkers(keys);}catch{fail('invalid_markers');}
 }
 for(const [month,data] of Object.entries(s.months)){
  if(!validMonth(month)||!data||typeof data!=='object'||!Array.isArray(data.cardExpenses))fail('invalid_month_data');
 }
 return clone(s);
}
function memoryDisk(initial){
 let bytes=JSON.stringify(validate(initial)),version=0;
 return {
  read(){return {bytes,version};},
  write(next,expectedVersion,{failure}={}){
   if(expectedVersion!==version)fail('revision_conflict');
   if(failure==='before'||failure==='partial'||failure==='after_prepare')fail('write_failed');
   // Um unico swap representa commit atomico. Nao simula disco fisico.
   bytes=next;version++;
   return version;
  }
 };
}
function open(disk){
 const boot=disk.read();
 let state;
 try{state=validate(JSON.parse(boot.bytes));}catch{fail('corrupt_disk');}
 let revision=boot.version;
 function commit(candidate,options={}){
  const clean=validate(candidate),serialized=JSON.stringify(clean);
  const next=disk.write(serialized,revision,options);
  state=clean;revision=next;
  return revision;
 }
 return {
  read(){return clone(state);},
  revision(){return revision;},
  mark(month,origin,number,options={}){
   if(!validMonth(month))fail('invalid_month');
   const key=marker(origin,number);
   const next=clone(state),list=next.deletions[month]||[];
   if(list.includes(key))return {changed:false,revision};
   next.deletions[month]=[...list,key];
   return {changed:true,revision:commit(next,options)};
  },
  recreate(month,previousMonth,options={}){
   if(!validMonth(month)||!validMonth(previousMonth))fail('invalid_month');
   if(own(state.months,month))return {changed:false,revision};
   const previous=state.months[previousMonth];
   if(!previous)fail('missing_previous');
   const markers=state.deletions[month]||[];
   let decisions;
   try{decisions=plan(previous.cardExpenses,month,markers,[]).decisions;}catch{fail('invalid_installments');}
   const next=clone(state);
   next.months[month]={cardExpenses:previous.cardExpenses.filter(c=>c.isInstallment).flatMap(c=>{
    const number=c.currentInstallment+1,origin=c.installmentOriginId;
    return decisions.some(d=>d.origin===origin&&d.number===number&&d.action==='create')?
     [{...c,id:'lab_'+origin+'_'+number,currentInstallment:number,paid:false}]:[];
   })};
   return {changed:true,revision:commit(next,options)};
  },
  backup(){return createBackup(state);},
  restore(envelope,{expectedRevision,allowRollback=false,failure}={}){
   if(expectedRevision!==revision)fail('revision_conflict');
   let incoming;
   try{incoming=validate(verifyBackup(envelope));}catch{fail('invalid_backup');}
   // Impede restauracao silenciosa que apaga tombstones atuais.
   for(const [month,keys] of Object.entries(state.deletions)){
    if(keys.some(key=>!(incoming.deletions[month]||[]).includes(key))&&!allowRollback)
     fail('deletion_rollback_requires_approval');
   }
   if(same(incoming,state))return {changed:false,revision};
   return {changed:true,revision:commit(incoming,{failure})};
  }
 };
}
module.exports={PersistenceError,memoryDisk,open,validate};
