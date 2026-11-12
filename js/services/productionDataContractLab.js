'use strict';
// Fase 1: contrato PROPOSTO de dados, sem acesso a rede, storage ou Firebase.
const MONTH=/^\d{4}-(0[1-9]|1[0-2])$/;
const UID=/^[A-Za-z0-9_-]{1,100}$/;
const ID=/^[A-Za-z0-9_-]{1,100}$/;
const FIELDS=['expenses','cardExpenses','extraIncomes'];
class ContractError extends Error{constructor(code){super(code);this.code=code;this.name='ContractError';}}
const fail=c=>{throw new ContractError(c);};
const obj=x=>x!==null&&typeof x==='object'&&!Array.isArray(x)&&
 (Object.getPrototypeOf(x)===Object.prototype||Object.getPrototypeOf(x)===null);
const own=(o,k)=>Object.prototype.hasOwnProperty.call(o,k);
function cents(n){if(typeof n!=='number'||!Number.isFinite(n)||Math.abs(n)>1e12||
 Math.abs(n*100-Math.round(n*100))>1e-6)fail('invalid_money');return Math.round(n*100);}
function validateSnapshot(snapshot){
 if(!obj(snapshot)||!obj(snapshot.months)||typeof snapshot.selectedMonth!=='string'||
 !MONTH.test(snapshot.selectedMonth)||!own(snapshot.months,snapshot.selectedMonth))
 fail('invalid_snapshot');
 const months=Object.keys(snapshot.months);
 if(months.length>240)fail('too_many_months');
 let entries=0;
 for(const ym of months){
  if(!MONTH.test(ym))fail('invalid_month');
  const m=snapshot.months[ym];
  if(!obj(m))fail('invalid_month_data');
  cents(m.salary);
  for(const field of FIELDS){
   if(!Array.isArray(m[field]))fail('invalid_collection');
   const ids=new Set();
   for(const item of m[field]){
    if(++entries>20000)fail('too_many_entries');
    if(!obj(item)||typeof item.id!=='string'||!ID.test(item.id)||
     ids.has(item.id))fail('invalid_entry');
    ids.add(item.id);
    const value=field==='cardExpenses'?item.installmentValue:item.amount;
    cents(value);
   }
  }
 }
 return {months:months.length,entries};
}
function userPath(uid){if(typeof uid!=='string'||!UID.test(uid))fail('invalid_uid');return 'users/'+uid;}
function assertOwner(authenticatedUid,requestedUid){
 if(typeof authenticatedUid!=='string'||!UID.test(authenticatedUid)||
 typeof requestedUid!=='string'||!UID.test(requestedUid)||
 authenticatedUid!==requestedUid)fail('forbidden');
 return userPath(authenticatedUid);
}
function sanitizeSyncPayload(data){
 if(!obj(data)||Object.keys(data).sort().join(',')!=='months,selectedMonth')
 fail('unexpected_fields');
 validateSnapshot(data);
 return JSON.parse(JSON.stringify(data));
}
module.exports={ContractError,cents,validateSnapshot,userPath,assertOwner,sanitizeSyncPayload};
