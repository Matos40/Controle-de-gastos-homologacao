'use strict';
// Contrato v3 experimental: envelope versionado + tombstones por mes destino.
// Sem integracao, IO, rede ou armazenamento. Reversibilidade via fonte original.
const crypto=require('node:crypto');
const {validateSnapshot}=require('./productionDataContractLab.js');
const {balances}=require('./reversibleFinanceMigrationLab.js');
const {validateMarkers}=require('./installmentDeletionPolicyLab.js');
const {verifyBackup}=require('./backupRecoveryLab.js');
const {isDeepStrictEqual}=require('node:util');
class V3Error extends Error{constructor(code){super(code);this.code=code;this.name='V3Error';}}
const fail=c=>{throw new V3Error(c);};
const own=(o,k)=>Object.prototype.hasOwnProperty.call(o,k);
const object=x=>x!==null&&typeof x==='object'&&!Array.isArray(x);
const month=/^\d{4}-(0[1-9]|1[0-2])$/;
function stable(x){
 if(x===null||typeof x==='string'||typeof x==='boolean')return x;
 if(typeof x==='number'){if(!Number.isFinite(x))fail('invalid_value');return x;}
 if(Array.isArray(x))return x.map(stable);
 if(!object(x))fail('invalid_value');
 const o=Object.create(null);
 for(const k of Object.keys(x).sort()){
  if(['__proto__','constructor','prototype'].includes(k))fail('unsafe_key');
  o[k]=stable(x[k]);
 }
 return o;
}
function canonical(x){const raw=JSON.stringify(stable(x));if(Buffer.byteLength(raw,'utf8')>2*1024*1024)fail('too_large');return raw;}
const clone=x=>JSON.parse(canonical(x));
const digest=x=>crypto.createHash('sha256').update(canonical(x)).digest('hex');
function validateLedger(ledger){
 if(!object(ledger)||Object.keys(ledger).sort().join(',')!=='deletions,months,selectedMonth')fail('invalid_ledger');
 try{validateSnapshot({selectedMonth:ledger.selectedMonth,months:ledger.months});}
 catch{fail('invalid_financial_contract');}
 if(!object(ledger.deletions)||Object.keys(ledger.deletions).length>240)fail('invalid_deletions');
 for(const [ym,keys] of Object.entries(ledger.deletions)){
  if(!month.test(ym))fail('invalid_deletion_month');
  try{validateMarkers(keys);}catch{fail('invalid_markers');}
 }
 for(const [ym,data] of Object.entries(ledger.months)){
  const embedded=data.deletedInstallmentOrigins;
  if(embedded!==undefined){
   try{validateMarkers(embedded);}catch{fail('invalid_markers');}
   const external=ledger.deletions[ym]||[];
   if(!isDeepStrictEqual([...embedded].sort(),[...external].sort()))fail('marker_conflict');
  }
 }
 return clone(ledger);
}
function fromLegacy(snapshot){
 if(!object(snapshot)||Object.keys(snapshot).sort().join(',')!=='months,selectedMonth')fail('invalid_legacy');
 try{validateSnapshot(snapshot);}catch{fail('invalid_financial_contract');}
 const original=clone(snapshot),deletions={};
 for(const [ym,data] of Object.entries(original.months)){
  if(data.deletedInstallmentOrigins!==undefined){
   try{validateMarkers(data.deletedInstallmentOrigins);}catch{fail('invalid_markers');}
   deletions[ym]=[...data.deletedInstallmentOrigins];
  }
 }
 const ledger=validateLedger({...original,deletions});
 return {ledger,original,sourceHash:digest(original)};
}
function createV3(source,{futureDeletions={}}={}){
 const legacy=fromLegacy(source),ledger=legacy.ledger;
 if(!object(futureDeletions))fail('invalid_deletions');
 for(const [ym,keys] of Object.entries(futureDeletions)){
  if(!month.test(ym)||own(ledger.months,ym)||own(ledger.deletions,ym))fail('invalid_future_month');
  try{validateMarkers(keys);}catch{fail('invalid_markers');}
  ledger.deletions[ym]=[...keys];
 }
 const clean=validateLedger(ledger);
 return {format:'raytech-finance-v3-lab',version:3,schema:1,sourceHash:legacy.sourceHash,
  source:legacy.original,ledger:clean,checksum:digest(clean)};
}
function verifyV3(envelope){
 if(!object(envelope)||Object.keys(envelope).sort().join(',')!=='checksum,format,ledger,schema,source,sourceHash,version'||
 envelope.format!=='raytech-finance-v3-lab'||envelope.version!==3||envelope.schema!==1||
 typeof envelope.checksum!=='string'||typeof envelope.sourceHash!=='string')fail('invalid_envelope');
 if(digest(envelope.source)!==envelope.sourceHash)fail('source_tampered');
 const checked=validateLedger(envelope.ledger);
 if(digest(checked)!==envelope.checksum)fail('ledger_tampered');
 const recreated=createV3(envelope.source,{futureDeletions:Object.fromEntries(
 Object.entries(checked.deletions).filter(([ym])=>!own(checked.months,ym)))});
 if(!isDeepStrictEqual(recreated.ledger,checked))fail('untracked_change');
 if(!isDeepStrictEqual(balances(envelope.source),balances(checked)))fail('balance_changed');
 return clone(checked);
}
function rollback(envelope){
 verifyV3(envelope);
 return clone(envelope.source);
}
function importLegacyBackup(backup){
 let snapshot;
 try{snapshot=verifyBackup(backup);}catch{fail('invalid_backup');}
 return createV3(snapshot);
}
function exportLegacy(envelope){
 const ledger=verifyV3(envelope);
 if(Object.keys(ledger.deletions).some(ym=>!own(ledger.months,ym)&&ledger.deletions[ym].length))
  fail('lossy_downgrade');
 return rollback(envelope);
}
module.exports={V3Error,validateLedger,fromLegacy,createV3,verifyV3,rollback,importLegacyBackup,exportLegacy,digest};
