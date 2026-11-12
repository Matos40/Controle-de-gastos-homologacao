'use strict';
const crypto=require('node:crypto');
const {paths}=require('./trustedFinanceBackendLab.js');
const {digestOperation}=require('./remoteIdempotencyLab.js');
function ensureEmulators(){
 if(process.env.FIRESTORE_EMULATOR_HOST!=='127.0.0.1:8093'||
    process.env.FIREBASE_AUTH_EMULATOR_HOST!=='127.0.0.1:9099')
  throw Error('Auditoria exige emuladores locais 8093/9099.');
}
function inspectEnvironment(env=process.env){
 const risks=[];
 if(env.GOOGLE_APPLICATION_CREDENTIALS)risks.push('GOOGLE_APPLICATION_CREDENTIALS configurada: revisar origem e isolamento.');
 if(env.GCLOUD_PROJECT&&!env.GCLOUD_PROJECT.startsWith('demo-'))risks.push('GCLOUD_PROJECT nao demonstrativo.');
 if(env.GOOGLE_CLOUD_PROJECT&&!env.GOOGLE_CLOUD_PROJECT.startsWith('demo-'))risks.push('GOOGLE_CLOUD_PROJECT nao demonstrativo.');
 return risks;
}
async function auditReceipts(db,uid){
 const p=paths(db,uid);
 const [head,revisions,receipts]=await Promise.all([
  p.head.get(),p.revisions.orderBy('number').get(),p.receipts.get()]);
 if(!head.exists)throw Error('Head ausente.');
 const h=head.data(),docs=revisions.docs;
 if(!Number.isSafeInteger(h.number)||h.number!==docs.length||!docs.length)
  throw Error('Historico incompleto.');
 let previous='';
 const checksums=new Map();
 const {checkV2}=require('./versionedBoundaryBridgeLab.js');
 for(let i=0;i<docs.length;i++){
  const d=docs[i].data(),number=i+1;
  if(docs[i].id!==String(number)||d.number!==number||d.parent!==previous||d.version!==2)
   throw Error('Cadeia inconsistente.');
  checkV2({version:2,schema:1,shared:d.shared,checksum:d.checksum});
  previous=d.checksum;checksums.set(number,previous);
 }
 if(h.checksum!==previous||h.parent!==docs.at(-1).data().parent)throw Error('Head inconsistente.');
 for(const doc of receipts.docs){
  const r=doc.data();
  if(doc.id!==r.key||r.version!==1||
   !/^[a-f0-9]{64}$/.test(r.operationHash)||
   checksums.get(r.number)!==r.checksum)
   throw Error('Recibo inconsistente.');
 }
 return {status:'audited',revisions:docs.length,receipts:receipts.size};
}
function verifyReceiptForOperation(receipt,operation){
 return !!receipt&&receipt.key===operation.key&&
  receipt.operationHash===digestOperation(operation);
}
module.exports={ensureEmulators,inspectEnvironment,auditReceipts,verifyReceiptForOperation};
