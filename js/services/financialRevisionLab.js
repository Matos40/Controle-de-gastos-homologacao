'use strict';
/* Laboratorio Node-only: controle otimista de revisoes, sem producao.
 * Head autoritativo por usuario; revisoes imutaveis. Sem merge automatico.
 */
const assert=require('node:assert/strict');
const {makeV2,checkV2,importVersioned}=require('./versionedBoundaryBridgeLab.js');
const UID=/^[a-zA-Z0-9_-]{1,100}$/;
function user(uid){if(typeof uid!=='string'||!UID.test(uid))throw Error('UID invalido.');}
function refs(db,uid){user(uid);const root='users/'+uid+'/financeRevisionLab';return {
 head:db.doc(root+'/control/state/head'),revisions:db.collection(root+'/control/revisions')};}
function prepare(source){const envelope=source&&source.version===2?source:makeV2(source);
 checkV2(envelope);return envelope;}
function record(envelope,number,parent){
 return {version:2,number,parent,checksum:envelope.checksum,shared:envelope.shared};
}
function validateRecord(v){
 if(!v||v.version!==2||!Number.isSafeInteger(v.number)||v.number<1||
  typeof v.parent!=='string'||!v.shared)throw Error('Revisao invalida.');
 checkV2({version:2,schema:1,shared:v.shared,checksum:v.checksum});
}
async function current(db,uid,preferences){
 const r=refs(db,uid),head=await r.head.get();
 if(!head.exists)return {status:'empty',number:0,checksum:null};
 const h=head.data();
 if(h.version!==2||!Number.isSafeInteger(h.number)||h.number<1||
  !/^[a-f0-9]{64}$/.test(h.checksum))throw Error('Head invalido.');
 const snap=await r.revisions.doc(String(h.number)).get();
 if(!snap.exists)throw Error('Revisao apontada ausente.');
 const v=snap.data();validateRecord(v);
 if(v.number!==h.number||v.checksum!==h.checksum)throw Error('Head e revisao divergentes.');
 const assembled=importVersioned({version:2,schema:1,shared:v.shared,checksum:v.checksum},preferences);
 return {status:'ready',number:h.number,checksum:h.checksum,...assembled};
}
async function publish(db,uid,source,base){
 const envelope=prepare(source);
 if(!base||!Number.isSafeInteger(base.number)||base.number<0||
  (base.number===0?base.checksum!==null:!/^[a-f0-9]{64}$/.test(base.checksum)))
  throw Error('Base de revisao invalida.');
 const r=refs(db,uid);
 try{return await db.runTransaction(async tx=>{
  const snap=await tx.get(r.head);
  const old=snap.exists?snap.data():null;
  if(old&&(!Number.isSafeInteger(old.number)||old.number<1||
   !/^[a-f0-9]{64}$/.test(old.checksum)))throw Error('Head invalido.');
  const actual=old?{number:old.number,checksum:old.checksum}:{number:0,checksum:null};
  if(old&&old.checksum===envelope.checksum)
   return {status:'unchanged',number:old.number,checksum:old.checksum};
  if(actual.number!==base.number||actual.checksum!==base.checksum)
   return {status:'conflict',expected:base,actual};
  const number=actual.number+1;
  const target=r.revisions.doc(String(number));
  const existing=await tx.get(target);
  if(existing.exists)throw Error('Numero de revisao ja utilizado.');
  const value=record(envelope,number,actual.checksum||'');
  tx.set(target,value);
  tx.set(r.head,{version:2,number,checksum:envelope.checksum,
   parent:actual.checksum||''});
  return {status:'published',number,checksum:envelope.checksum};
 });
 }catch(error){
  // Uma corrida pode produzir PERMISSION_DENIED nas regras de incremento
  // antes de o SDK refazer a transacao. Confirmar divergencia no head
  // antes de classificar como conflito; nunca mascarar negacao real.
  if(error?.code!=='permission-denied')throw error;
  const latest=await r.head.get();
  const value=latest.exists?latest.data():null;
  const actual=value?{number:value.number,checksum:value.checksum}:{number:0,checksum:null};
  if(actual.number!==base.number||actual.checksum!==base.checksum)
   return {status:'conflict',expected:base,actual};
  throw error;
 }
}
async function recover(db,uid,preferences){
 const c=await current(db,uid,preferences);
 if(c.status==='empty')return c;
 return {status:'recovered',number:c.number,checksum:c.checksum,
  snapshot:c.snapshot,viewPreferences:c.viewPreferences};
}
async function history(db,uid){
 const r=refs(db,uid),snap=await r.revisions.get();
 const values=snap.docs.map(d=>{const v=d.data();validateRecord(v);
  if(d.id!==String(v.number))throw Error('ID de revisao invalido.');
  return {number:v.number,parent:v.parent,checksum:v.checksum};});
 values.sort((a,b)=>a.number-b.number);
 for(let i=0;i<values.length;i++){
  if(values[i].number!==i+1||
   values[i].parent!==(i?values[i-1].checksum:''))
   throw Error('Historico inconsistente.');
 }
 const head=await r.head.get();
 if(values.length&&(!head.exists||head.data().number!==values.length||
  head.data().checksum!==values.at(-1).checksum))throw Error('Head nao corresponde ao historico.');
 if(!values.length&&head.exists)throw Error('Head sem revisoes.');
 return values;
}
module.exports={prepare,refs,publish,current,recover,history};
