'use strict';
// I04: auditoria de completude, exclusivamente memoria e snapshots sinteticos.
const {isDeepStrictEqual}=require('node:util');
const {validateSnapshot}=require('./productionDataContractLab.js');
const {balances}=require('./reversibleFinanceMigrationLab.js');
const {fingerprint}=require('./financeIntegrityE2ELab.js');
const {verifyV3}=require('./versionedFinanceTombstonesV3Lab.js');
const {verifyAuthenticatedBackup}=require('./authenticatedFinanceBackupLab.js');
class CompletenessError extends Error{constructor(code){super(code);this.name='CompletenessError';this.code=code;}}
const fail=code=>{throw new CompletenessError(code);};
const own=(x,k)=>Object.prototype.hasOwnProperty.call(x,k);
const obj=x=>x!==null&&typeof x==='object'&&!Array.isArray(x);
const clone=x=>JSON.parse(JSON.stringify(x));
const month=/^\d{4}-(0[1-9]|1[0-2])$/;
function inventory(snapshot){
 try{validateSnapshot(snapshot);}catch{fail('invalid_financial_contract');}
 const months=Object.keys(snapshot.months).sort();
 const totals={months:months.length,expenses:0,cardExpenses:0,extraIncomes:0,investments:0,installments:0,markers:0};
 const detail={};
 for(const ym of months){
  const m=snapshot.months[ym];
  const counts={expenses:m.expenses.length,cardExpenses:m.cardExpenses.length,extraIncomes:m.extraIncomes.length,
   investments:m.expenses.filter(x=>x.category==='investimentos').length,
   installments:m.cardExpenses.filter(x=>x.isInstallment).length,
   markers:(m.deletedInstallmentOrigins||[]).length};
  for(const [k,v] of Object.entries(counts))totals[k]+=v;
  detail[ym]={...counts,salary:m.salary,netBalance:balances(snapshot)[ym]};
 }
 return {selectedMonth:snapshot.selectedMonth,months,totals,detail};
}
function requireEvidence(original,recovered,{originalDeletions={},recoveredDeletions={}}={}){
 const left=inventory(original),right=inventory(recovered);
 if(!isDeepStrictEqual(left,right))fail('inventory_mismatch');
 if(!isDeepStrictEqual(fingerprint(original),fingerprint(recovered)))fail('financial_fingerprint_mismatch');
 if(!isDeepStrictEqual(balances(original),balances(recovered)))fail('balance_mismatch');
 // Fingerprints nao cobrem todos os campos; exigir equivalencia estrutural integral.
 if(!isDeepStrictEqual(original,recovered))fail('silent_field_loss');
 if(!isDeepStrictEqual(originalDeletions,recoveredDeletions))fail('deletion_ledger_mismatch');
 return {status:'COMPLETE_SYNTHETIC_ROUNDTRIP',inventory:left,balances:balances(original)};
}
function auditAuthenticatedSnapshot(envelope,reference,{resolveKey}={}){
 let payload;
 try{payload=verifyAuthenticatedBackup(envelope,{resolveKey});}
 catch(e){fail(e.code==='authentication_failed'?'authentication_failed':'invalid_authenticated_backup');}
 if(payload.kind!=='snapshot')fail('unsupported_backup_kind');
 return requireEvidence(reference,payload.finance);
}
function auditAuthenticatedV3(envelope,reference,{resolveKey,futureDeletions={}}={}){
 let payload,ledger;
 try{payload=verifyAuthenticatedBackup(envelope,{resolveKey});}
 catch(e){fail(e.code==='authentication_failed'?'authentication_failed':'invalid_authenticated_backup');}
 if(payload.kind!=='v3')fail('unsupported_backup_kind');
 try{ledger=verifyV3(payload.finance);}catch{fail('invalid_v3');}
 const expected={...clone(reference),deletions:{}};
 for(const [ym,m] of Object.entries(reference.months)){
  if(own(m,'deletedInstallmentOrigins'))expected.deletions[ym]=clone(m.deletedInstallmentOrigins);
 }
 for(const [ym,markers] of Object.entries(futureDeletions)){
  if(!month.test(ym)||own(reference.months,ym)||own(expected.deletions,ym))fail('invalid_future_month');
  expected.deletions[ym]=clone(markers);
 }
 requireEvidence(reference,{selectedMonth:ledger.selectedMonth,months:ledger.months},{originalDeletions:expected.deletions,recoveredDeletions:ledger.deletions});
 return {status:'COMPLETE_SYNTHETIC_V3',inventory:inventory(reference),futureMonths:Object.keys(futureDeletions).sort()};
}
function simulateRecovery(initial,envelope,reference,{resolveKey,expectedRevision=0}={}){
 if(expectedRevision!==0)fail('revision_conflict');
 const original=clone(initial);
 const audit=auditAuthenticatedSnapshot(envelope,reference,{resolveKey});
 return {status:'SIMULATED_ONLY',before:original,after:clone(reference),rollback:()=>clone(original),audit};
}
module.exports={CompletenessError,inventory,requireEvidence,auditAuthenticatedSnapshot,auditAuthenticatedV3,simulateRecovery};
