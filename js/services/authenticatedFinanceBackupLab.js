'use strict';
// I03: HMAC-SHA256 autentica envelope de laboratorio. Chave fornecida externamente.
const crypto=require('node:crypto');
const {validateSnapshot}=require('./productionDataContractLab.js');
const {verifyBackup}=require('./backupRecoveryLab.js');
const {createV3,verifyV3}=require('./versionedFinanceTombstonesV3Lab.js');
const {isDeepStrictEqual}=require('node:util');
class AuthBackupError extends Error{constructor(code){super(code);this.code=code;this.name='AuthBackupError';}}
const fail=code=>{throw new AuthBackupError(code);};
const own=(o,k)=>Object.prototype.hasOwnProperty.call(o,k);
const object=x=>x!==null&&typeof x==='object'&&!Array.isArray(x);
function canonical(x,depth=0,seen=new Set()){
 if(depth>32)fail('invalid_data');
 if(x===null||typeof x==='string'||typeof x==='boolean')return x;
 if(typeof x==='number'){if(!Number.isFinite(x))fail('invalid_data');return x;}
 if(!object(x)&&!Array.isArray(x))fail('invalid_data');
 if(seen.has(x))fail('invalid_data');
 seen.add(x);
 let out;
 if(Array.isArray(x))out=x.map(v=>canonical(v,depth+1,seen));
 else {out=Object.create(null);for(const k of Object.keys(x).sort()){
  if(['__proto__','prototype','constructor'].includes(k))fail('unsafe_key');
  out[k]=canonical(x[k],depth+1,seen);
 }}
 seen.delete(x);return out;
}
function encode(x){const raw=JSON.stringify(canonical(x));if(Buffer.byteLength(raw,'utf8')>2*1024*1024)fail('too_large');return raw;}
const clone=x=>JSON.parse(encode(x));
function keyCheck(key){if(!Buffer.isBuffer(key)||key.length<32)fail('invalid_key');}
function idCheck(keyId){if(typeof keyId!=='string'||!/^[A-Za-z0-9_-]{1,64}$/.test(keyId))fail('invalid_key_id');}
function mac(data,key){return crypto.createHmac('sha256',key).update('raytech-finance-auth-backup-v1\0').update(encode(data)).digest('hex');}
const forbidden=new Set(['apiKey','geminiApiKey','pin','pinHash','STORAGE_GEMINI_KEY','STORAGE_PIN_KEY','gemini_user_api_key','controle_gastos_pin_lock']);
function scanSensitive(value){if(Array.isArray(value)){value.forEach(scanSensitive);return;}if(!object(value))return;for(const [k,v] of Object.entries(value)){if(forbidden.has(k))fail('sensitive_field');scanSensitive(v);}}
function validatePayload(payload){
 scanSensitive(payload);
 if(!object(payload)||Object.keys(payload).sort().join(',')!=='finance,kind')fail('invalid_payload');
 if(payload.kind==='snapshot'){try{validateSnapshot(payload.finance);}catch{fail('invalid_finance');}}
 else if(payload.kind==='v3'){try{verifyV3(payload.finance);}catch{fail('invalid_finance');}}
 else fail('unsupported_kind');
 return clone(payload);
}
function createAuthenticatedBackup(finance,{key,keyId='lab-key',kind='snapshot'}={}){
 keyCheck(key);idCheck(keyId);
 const payload=validatePayload({kind,finance});
 const signed={format:'raytech-auth-backup-lab',version:1,algorithm:'HMAC-SHA256',keyId,payload};
 return {...signed,tag:mac(signed,key)};
}
function verifyAuthenticatedBackup(envelope,{resolveKey}={}){
 if(!object(envelope)||Object.keys(envelope).sort().join(',')!=='algorithm,format,keyId,payload,tag,version'||
 envelope.format!=='raytech-auth-backup-lab'||envelope.version!==1||
 envelope.algorithm!=='HMAC-SHA256'||typeof envelope.tag!=='string'||!/^[a-f0-9]{64}$/.test(envelope.tag))fail('invalid_envelope');
 idCheck(envelope.keyId);
 if(typeof resolveKey!=='function')fail('missing_key_resolver');
 const key=resolveKey(envelope.keyId);
 keyCheck(key);
 const signed={format:envelope.format,version:envelope.version,algorithm:envelope.algorithm,keyId:envelope.keyId,payload:envelope.payload};
 const expected=Buffer.from(mac(signed,key),'hex'),provided=Buffer.from(envelope.tag,'hex');
 if(!crypto.timingSafeEqual(expected,provided))fail('authentication_failed');
 return validatePayload(envelope.payload);
}
function importLegacyUntrusted(envelope,{explicitConsent=false}={}){
 if(explicitConsent!==true)fail('legacy_requires_consent');
 let snapshot;
 try{snapshot=verifyBackup(envelope);validateSnapshot(snapshot);}catch{fail('invalid_legacy');}
 return {trust:'UNAUTHENTICATED_LEGACY',snapshot:clone(snapshot),mayRestore:false};
}
function authenticateLegacy(envelope,{key,keyId='lab-key',explicitConsent=false}={}){
 const legacy=importLegacyUntrusted(envelope,{explicitConsent});
 return createAuthenticatedBackup(legacy.snapshot,{key,keyId});
}
function createRestoreSession(initial){
 let current=clone(initial),revision=0;
 validateSnapshot(current);
 return {read(){return clone(current);},revision(){return revision;},
 restore(envelope,{resolveKey,expectedRevision}={}){
  if(expectedRevision!==revision)fail('revision_conflict');
  const payload=verifyAuthenticatedBackup(envelope,{resolveKey});
  if(payload.kind!=='snapshot')fail('unsupported_restore_kind');
  const next=clone(payload.finance);
  current=next;revision++;
  return {revision,status:'restored'};
 },
 rollback(original,expectedRevision){
  if(expectedRevision!==revision)fail('revision_conflict');
  validateSnapshot(original);current=clone(original);revision++;
  return {revision,status:'rolled_back'};
 }};
}
module.exports={AuthBackupError,createAuthenticatedBackup,verifyAuthenticatedBackup,importLegacyUntrusted,authenticateLegacy,createRestoreSession};
