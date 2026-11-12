'use strict';
// I05: simulacao em memoria da API localStorage, sem browser ou disco.
const {isDeepStrictEqual}=require('node:util');
const {validateLedger,createV3,verifyV3}=require('./versionedFinanceTombstonesV3Lab.js');
const {createAuthenticatedBackup,verifyAuthenticatedBackup}=require('./authenticatedFinanceBackupLab.js');
class StorageLabError extends Error{constructor(code){super(code);this.code=code;this.name='StorageLabError';}}
const fail=code=>{throw new StorageLabError(code);};
const clone=x=>JSON.parse(JSON.stringify(x));
const own=(x,k)=>Object.prototype.hasOwnProperty.call(x,k);
function valid(x){try{return validateLedger(x);}catch{fail('invalid_ledger');}}
function simulatedLocalStorage(){
 const data=new Map();let failure=null;
 return {
  getItem(k){return data.has(k)?data.get(k):null;},
  setItem(k,v){if(failure){const f=failure;failure=null;throw Error('simulated_'+f);}data.set(String(k),String(v));},
  removeItem(k){data.delete(k);},
  injectFailure(f){if(!['quota','interrupted','unavailable'].includes(f))fail('invalid_failure');failure=f;},
  corrupt(k,v){data.set(String(k),String(v));},
  keys(){return [...data.keys()];}
 };
}
function boot(storage,initial,{slot='raytech_i05_lab'}={}){
 if(!storage||typeof storage.getItem!=='function'||typeof storage.setItem!=='function')fail('invalid_storage');
 if(!/^[a-z0-9_]{1,64}$/.test(slot))fail('invalid_slot');
 const active=slot+':active',staging=slot+':staging';
 let raw;
 try{raw=storage.getItem(active);}catch{fail('read_failed');}
 let state,revision;
 if(raw===null){state=valid(initial);revision=0;}
 else {
  let parsed;
  try{parsed=JSON.parse(raw);}catch{fail('corrupt_storage');}
  if(!parsed||Object.keys(parsed).sort().join(',')!=='ledger,revision'||!Number.isSafeInteger(parsed.revision)||parsed.revision<0)fail('corrupt_storage');
  state=valid(parsed.ledger);revision=parsed.revision;
 }
 function commit(next,expectedRevision){
  if(expectedRevision!==revision)fail('revision_conflict');
  // Detecta perda de tombstones antes da validacao cruzada V3,
  // que tambem rejeitaria a alteracao, mas com erro menos especifico.
  if(next&&next.deletions&&typeof next.deletions==='object'&&!Array.isArray(next.deletions)){
   for(const [ym,keys] of Object.entries(state.deletions)){
    if(keys.some(k=>!Array.isArray(next.deletions[ym])||!next.deletions[ym].includes(k)))
     fail('deletion_loss_requires_review');
   }
  }
  const clean=valid(next);
  if(isDeepStrictEqual(state,clean))return {changed:false,revision};
  const record=JSON.stringify({ledger:clean,revision:revision+1});
  try{storage.setItem(staging,record);storage.setItem(active,record);}
  catch{fail('write_failed');}
  state=clean;revision++;
  try{storage.removeItem(staging);}catch{}
  return {changed:true,revision};
 }
 return {
  read(){return clone(state);},revision(){return revision;},commit,
  backup({key,keyId='lab-key'}={}){
   const source={selectedMonth:state.selectedMonth,months:state.months};
   const futureDeletions=Object.fromEntries(Object.entries(state.deletions).filter(([ym])=>!own(state.months,ym)));
   const v3=createV3(source,{futureDeletions});
   if(!isDeepStrictEqual(v3.ledger,state))fail('unrepresentable_ledger');
   return createAuthenticatedBackup(v3,{key,keyId,kind:'v3'});
  },
  restore(envelope,{resolveKey,expectedRevision}={}){
   if(expectedRevision!==revision)fail('revision_conflict');
   let payload,ledger;
   try{payload=verifyAuthenticatedBackup(envelope,{resolveKey});}
   catch(e){fail(e.code==='authentication_failed'?'authentication_failed':'invalid_backup');}
   if(payload.kind!=='v3')fail('unsupported_kind');
   try{ledger=verifyV3(payload.finance);}catch{fail('invalid_backup');}
   return commit(ledger,expectedRevision);
  }
 };
}
module.exports={StorageLabError,simulatedLocalStorage,boot};
