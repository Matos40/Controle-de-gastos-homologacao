'use strict';
// Laboratorio isolado: recibo e revisao gravados na mesma transacao.
const crypto=require('node:crypto');
const rev=require('./financialRevisionLab.js');
const {reconcile}=require('./offlineRevisionQueueLab.js');
const {makeV2}=require('./versionedBoundaryBridgeLab.js');
const stable=v=>JSON.stringify(v);
const hash=v=>crypto.createHash('sha256').update(stable(v)).digest('hex');
function valid(op){
 if(!op||typeof op.key!=='string'||!/^[a-zA-Z0-9_-]{1,80}$/.test(op.key)||
  !/^\d{4}-(0[1-9]|1[0-2])$/.test(op.ym)||
  !['salary','expenses','cardExpenses','extraIncomes'].includes(op.type)||
  !Object.prototype.hasOwnProperty.call(op,'expected')||
  !Object.prototype.hasOwnProperty.call(op,'value')||
  (op.type!=='salary'&&(typeof op.id!=='string'||!op.id||op.id.includes('/'))))
  throw Error('Operacao invalida.');
}
function receiptRef(db,uid,key){
 if(!/^[a-zA-Z0-9_-]{1,100}$/.test(uid)||!/^[a-zA-Z0-9_-]{1,80}$/.test(key))
  throw Error('Identificador invalido.');
 return db.doc('users/'+uid+'/financeRevisionLab/control/receipts/'+key);
}
function digestOperation(op){valid(op);return hash({
  ym:op.ym,type:op.type,id:op.type==='salary'?null:op.id,
  expected:op.expected,value:op.value
 });}
async function submit(db,uid,op,preferences){
 const operationHash=digestOperation(op);
 const refs=rev.refs(db,uid),receipt=receiptRef(db,uid,op.key);
 try{
 return await db.runTransaction(async tx=>{
  // Todas as leituras antes das gravacoes.
  const existing=await tx.get(receipt);
  if(existing.exists){
   const v=existing.data();
   if(v.operationHash!==operationHash)return {status:'key_conflict'};
   return {status:'duplicate',number:v.number,checksum:v.checksum};
  }
  const head=await tx.get(refs.head);
  if(!head.exists)return {status:'missing_remote'};
  const h=head.data();
  const prior=await tx.get(refs.revisions.doc(String(h.number)));
  if(!prior.exists||prior.data().checksum!==h.checksum)throw Error('Head inconsistente.');
  const current=rev.prepare({version:2,schema:1,shared:prior.data().shared,checksum:h.checksum});
  const reconstructed=require('./versionedBoundaryBridgeLab.js').importVersioned(current,preferences).snapshot;
  const result=reconcile(reconstructed,op);
  if(result.status==='conflict')return {status:'conflict'};
  // Mesmo se valor ja aplicado, emitir recibo, sem revisao adicional.
  let number=h.number,checksum=h.checksum;
  if(result.status==='merged'){
   const envelope=makeV2(result.snapshot);
   if(envelope.checksum!==h.checksum){
    number=h.number+1;checksum=envelope.checksum;
    const target=refs.revisions.doc(String(number));
    const priorTarget=await tx.get(target);
    if(priorTarget.exists)throw Error('Revisao ja ocupada.');
    tx.set(target,{version:2,number,parent:h.checksum,checksum,shared:envelope.shared});
    tx.set(refs.head,{version:2,number,parent:h.checksum,checksum});
   }
  }
  tx.set(receipt,{version:1,key:op.key,operationHash,number,checksum});
  return {status:'committed',number,checksum};
 });
 }catch(error){
  // Uma transacao concorrente pode ser negada pelas regras; releitura
  // do recibo permite reconhecer commit anterior sem mascarar outros erros.
  if(error?.code!=='permission-denied')throw error;
  const existing=await receipt.get();
  if(existing.exists){
   const v=existing.data();
   return v.operationHash===operationHash?
    {status:'duplicate',number:v.number,checksum:v.checksum}:
    {status:'key_conflict'};
  }
  throw error;
 }
}
async function audit(db,uid){
 const refs=rev.refs(db,uid);
 const history=await rev.history(db,uid);
 const snap=await db.collection('users/'+uid+'/financeRevisionLab/control/receipts').get();
 const byNumber=new Map(history.map(x=>[x.number,x.checksum]));
 const keys=new Set();
 for(const doc of snap.docs){
  const v=doc.data();
  if(keys.has(v.key)||doc.id!==v.key||v.version!==1||
   !/^[a-f0-9]{64}$/.test(v.operationHash)||
   byNumber.get(v.number)!==v.checksum)throw Error('Recibo inconsistente.');
  keys.add(v.key);
 }
 return {revisions:history.length,receipts:keys.size,status:'audited'};
}
module.exports={submit,audit,receiptRef,digestOperation};
