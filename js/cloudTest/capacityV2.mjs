import {validatePayload,validId,canonical,validateRoute} from './model.mjs?v=v2hotfix1';
export function validateV2Head(h){if(!h||Object.keys(h).sort().join("|")!=="hash|lastOperationId|marker|payload|revision"||h.marker!=="raytech-financial-test-v2"||!Number.isSafeInteger(h.revision)||h.revision<1||!validId(h.lastOperationId)||typeof h.hash!=="string"||!/^[0-9a-f]{64}$/.test(h.hash))throw Error("V2_HEAD");validatePayload(h.payload);return h;}
export function validateV2Receipt(r){if(!r||Object.keys(r).sort().join("|")!=="hash|operationId|parentId|revision"||!validId(r.operationId)||!Number.isSafeInteger(r.revision)||r.revision<1||!(r.revision===1?r.parentId==="":validId(r.parentId))||r.parentId===r.operationId||typeof r.hash!=="string"||!/^[0-9a-f]{64}$/.test(r.hash))throw Error("V2_RECEIPT");return r;}
export function transitionV2(head,receipt,q,hash){if(head)validateV2Head(head);if(!q||!validId(q.id)||!Number.isSafeInteger(q.expectedRevision)||q.expectedRevision<0||q.expectedRevision>=Number.MAX_SAFE_INTEGER||!(q.expectedRevision===0?q.parentId==="":validId(q.parentId))||q.parentId===q.id||typeof hash!=="string"||!/^[0-9a-f]{64}$/.test(hash))throw Error("V2_COMMAND");validatePayload(q.payload);const nextReceipt=validateV2Receipt({operationId:q.id,revision:q.expectedRevision+1,parentId:q.parentId,hash});if(receipt){validateV2Receipt(receipt);if(!head||receipt.revision>head.revision||canonical(receipt)!==canonical(nextReceipt))throw Error("V2_ID_REUSE");return {head,receipt,replay:true};}if((head?.revision??0)!==q.expectedRevision||(head?.lastOperationId??"")!==q.parentId)throw Error("V2_CONFLICT");return {head:validateV2Head({marker:"raytech-financial-test-v2",revision:nextReceipt.revision,lastOperationId:q.id,payload:q.payload,hash}),receipt:nextReceipt,replay:false};}
export async function commitV2(api,uid,q){if(!/^[A-Za-z0-9_-]{1,128}$/.test(uid)||api.currentUid()!==uid)throw Error("V2_UID");const hash=await api.sha(q.payload);return api.transaction(async tx=>{if(api.currentUid()!==uid)throw Error("V2_UID");const head=await tx.getHead(uid),receipt=await tx.getReceipt(uid,q.id);if(api.currentUid()!==uid)throw Error("V2_UID");if(head&&await api.sha(head.payload)!==head.hash)throw Error("V2_HASH");const next=transitionV2(head,receipt,q,hash);if(api.currentUid()!==uid)throw Error("V2_UID");if(!next.replay){tx.setHead(uid,next.head);tx.setReceipt(uid,q.id,next.receipt);}return next;});}

/* Confirmation is read-only; a transient missing snapshot never repeats a write.
   An advanced or divergent head requires the existing explicit recovery path. */
export async function confirmMigrationV2({expected,source,sha,isCurrent,read,delay}){
 const ensureCurrent=()=>{if(!isCurrent())throw Error('SESSION_CHANGED');};
 for(let attempt=0;attempt<3;attempt++){
  ensureCurrent();
  const {route,head,receipt}=await read();
  ensureCurrent();
  if(route&&canonical(validateRoute(route,source))!==canonical(expected.route))throw Error('ROUTE_DIVERGENCE');
  if(head){
   validateV2Head(head);
   if(canonical(head)!==canonical(expected.head))throw Error('SEED_DIVERGENCE');
   if(await sha(head.payload)!==head.hash)throw Error('V2_HASH');
   ensureCurrent();
  }
  if(receipt&&canonical(validateV2Receipt(receipt))!==canonical({operationId:expected.route.seed,revision:1,parentId:'',hash:expected.route.hash}))throw Error('SEED_RECEIPT');
  if(route&&head&&receipt){validateRoute(route,source,head);return head;}
  if(attempt<2)await delay(attempt===0?250:750);
 }
 throw Error('MIGRATION_UNCONFIRMED');
}
