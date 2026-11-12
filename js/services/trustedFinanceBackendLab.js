'use strict';
/* Node-only, Firebase Admin SDK. A identidade vem de verificador injetado;
 * teste usa verificador ficticio, NUNCA usar como autenticacao de producao. */
const crypto=require('node:crypto');
const {makeV2,checkV2}=require('./versionedBoundaryBridgeLab.js');
const {reconcile}=require('./offlineRevisionQueueLab.js');
const {digestOperation}=require('./remoteIdempotencyLab.js');
const sha=x=>crypto.createHash('sha256').update(JSON.stringify(x)).digest('hex');
const uidOk=x=>typeof x==='string'&&/^[A-Za-z0-9_-]{1,100}$/.test(x);
function paths(db,uid){
 if(!uidOk(uid))throw Error('UID invalido.');
 const root='users/'+uid+'/trustedFinanceLab/control';
 return {head:db.doc(root+'/state/head'),
  revisions:db.collection(root+'/revisions'),receipts:db.collection(root+'/receipts')};
}
function verifyFactory(db,verifyToken){
 if(typeof verifyToken!=='function')throw Error('Verificador de token obrigatorio.');
 async function identity(token){
  const result=await verifyToken(token);
  if(!result||!uidOk(result.uid))throw Error('Nao autorizado.');
  return result.uid;
 }
 async function auditTx(tx,p){
  const headSnap=await tx.get(p.head);
  if(!headSnap.exists)return {head:null,history:[]};
  const head=headSnap.data();
  const all=await tx.get(p.revisions.orderBy('number'));
  const docs=all.docs.map(d=>({id:d.id,...d.data()}));
  if(!Number.isSafeInteger(head.number)||head.number<1||docs.length!==head.number)
   throw Error('Cadeia incompleta.');
  let parent='';
  for(let i=0;i<docs.length;i++){
   const d=docs[i],number=i+1;
   if(d.id!==String(number)||d.number!==number||d.version!==2||
    d.parent!==parent||d.checksum!==sha(d.shared))
    throw Error('Cadeia adulterada.');
   checkV2({version:2,schema:1,shared:d.shared,checksum:d.checksum});
   parent=d.checksum;
  }
  if(head.version!==2||head.number!==docs.length||
   head.checksum!==parent||head.parent!==docs.at(-1).parent)
   throw Error('Head adulterado.');
  return {head,history:docs};
 }
 async function initialize(token,snapshot){
  const uid=await identity(token),p=paths(db,uid),envelope=makeV2(snapshot);
  return db.runTransaction(async tx=>{
   const h=await tx.get(p.head);
   if(h.exists)return {status:'already_initialized'};
   const revision=p.revisions.doc('1');
   if((await tx.get(revision)).exists)throw Error('Revisao orfa.');
   tx.create(revision,{version:2,number:1,parent:'',checksum:envelope.checksum,shared:envelope.shared});
   tx.create(p.head,{version:2,number:1,parent:'',checksum:envelope.checksum});
   return {status:'initialized',number:1};
  });
 }
 async function submit(token,op){
  const uid=await identity(token),p=paths(db,uid),hash=digestOperation(op);
  return db.runTransaction(async tx=>{
   const receipt=p.receipts.doc(op.key),existing=await tx.get(receipt);
   if(existing.exists){
    const r=existing.data();
    return r.operationHash===hash?{status:'duplicate',number:r.number}:
     {status:'key_conflict'};
   }
   const chain=await auditTx(tx,p);
   if(!chain.head)return {status:'missing_remote'};
   const latest=chain.history.at(-1);
   const {importVersioned}=require('./versionedBoundaryBridgeLab.js');
   const current=importVersioned({version:2,schema:1,shared:latest.shared,checksum:latest.checksum},
    {selectedMonth:Object.keys(latest.shared.months).sort()[0]}).snapshot;
   const result=reconcile(current,op);
   if(result.status==='conflict')return {status:'conflict'};
   let number=chain.head.number,checksum=chain.head.checksum;
   if(result.status==='merged'){
    const envelope=makeV2(result.snapshot);
    if(envelope.checksum!==checksum){
     number++;const old=checksum;checksum=envelope.checksum;
     tx.create(p.revisions.doc(String(number)),{version:2,number,parent:old,checksum,shared:envelope.shared});
     tx.update(p.head,{version:2,number,parent:old,checksum});
    }
   }
   tx.create(receipt,{version:1,key:op.key,operationHash:hash,number,checksum});
   return {status:'committed',number};
  });
 }
 async function audit(token){
  const uid=await identity(token),p=paths(db,uid);
  return db.runTransaction(async tx=>{
   const chain=await auditTx(tx,p);
   const receipts=await tx.get(p.receipts);
   const byNumber=new Map(chain.history.map(x=>[x.number,x.checksum]));
   for(const doc of receipts.docs){
    const r=doc.data();
    if(doc.id!==r.key||r.version!==1||
     !/^[a-f0-9]{64}$/.test(r.operationHash)||
     byNumber.get(r.number)!==r.checksum)throw Error('Recibo adulterado.');
   }
   return {status:'audited',revisions:chain.history.length,receipts:receipts.size};
  });
 }
 return {initialize,submit,audit};
}
module.exports={verifyFactory,paths};
