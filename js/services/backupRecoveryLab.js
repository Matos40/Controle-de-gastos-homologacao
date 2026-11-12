'use strict';
// Backup de laboratorio, em memoria. Nao acessa arquivos, navegador ou Firestore.
const crypto=require('node:crypto');
const MAX_BYTES=2*1024*1024;
class BackupLabError extends Error{
 constructor(code){super(code);this.name='BackupLabError';this.code=code;}
}
const fail=code=>{throw new BackupLabError(code);};
const object=x=>x!==null&&typeof x==='object'&&!Array.isArray(x);
const own=(x,k)=>Object.prototype.hasOwnProperty.call(x,k);
function canonical(value,depth=0,seen=new Set(),counter={n:0}){
 if(depth>24||++counter.n>30000)fail('invalid_data');
 if(value===null||typeof value==='boolean'||typeof value==='string')return value;
 if(typeof value==='number'){if(!Number.isFinite(value))fail('invalid_data');return value;}
 if(typeof value!=='object'||seen.has(value))fail('invalid_data');
 seen.add(value);
 let out;
 if(Array.isArray(value)){
  out=value.map(v=>canonical(v,depth+1,seen,counter));
 }else{
  if(!object(value))fail('invalid_data');
  out=Object.create(null);
  for(const k of Object.keys(value).sort()){
   if(['__proto__','prototype','constructor'].includes(k))fail('invalid_data');
   out[k]=canonical(value[k],depth+1,seen,counter);
  }
 }
 seen.delete(value);
 return out;
}
function encode(value){
 const str=JSON.stringify(canonical(value));
 if(Buffer.byteLength(str,'utf8')>MAX_BYTES)fail('backup_too_large');
 return str;
}
function checksum(str){return crypto.createHash('sha256').update(str,'utf8').digest('hex');}
function createBackup(snapshot){
 const payload=JSON.parse(encode(snapshot));
 if(!object(payload)||!object(payload.months)||typeof payload.selectedMonth!=='string'||
  !own(payload.months,payload.selectedMonth))fail('invalid_snapshot');
 const raw=encode(payload);
 return {format:'raytech-finance-lab',version:1,algorithm:'sha256',
  checksum:checksum(raw),payload};
}
function verifyBackup(envelope){
 if(!object(envelope)||Object.keys(envelope).sort().join(',')!==
  'algorithm,checksum,format,payload,version'||envelope.format!=='raytech-finance-lab'||
  envelope.version!==1||envelope.algorithm!=='sha256'||
  typeof envelope.checksum!=='string'||!/^[a-f0-9]{64}$/.test(envelope.checksum))
  fail('invalid_backup');
 const raw=encode(envelope.payload);
 if(checksum(raw)!==envelope.checksum)fail('checksum_mismatch');
 const p=envelope.payload;
 if(!object(p)||!object(p.months)||typeof p.selectedMonth!=='string'||
  !own(p.months,p.selectedMonth))fail('invalid_snapshot');
 return JSON.parse(raw);
}
function parseBackup(text){
 if(typeof text!=='string'||Buffer.byteLength(text,'utf8')>MAX_BYTES+1024)
  fail('backup_too_large');
 let parsed;
 try{parsed=JSON.parse(text);}catch{fail('invalid_json');}
 return verifyBackup(parsed);
}
function createRestoreLab(initialSnapshot){
 let current=JSON.parse(encode(initialSnapshot));
 let revision=0;
 return {
  read(){return JSON.parse(encode(current));},
  revision(){return revision;},
  restore(envelope,{expectedRevision}={}){
   if(expectedRevision!==revision)fail('revision_conflict');
   const next=verifyBackup(envelope);
   // Nenhuma alteracao antes de todas as validacoes.
   current=next;
   revision++;
   return {status:'restored',revision};
  }
 };
}
module.exports={BackupLabError,createBackup,verifyBackup,parseBackup,createRestoreLab};
