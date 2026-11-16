import {validatePayload,validId,canonical} from './model.mjs';
import {validateV2Head,validateV2Receipt,transitionV2} from './capacity.mjs';
// Staged queue API. No side effects on import. The UI must acquire the per-UID Web Lock before modifying it.
export function queueKey(uid){if(typeof uid!=='string'||!/^[A-Za-z0-9_-]{1,128}$/.test(uid))throw Error('PRODUCTION_UID');return 'hml_smart326_raytech_production_v2_queue:'+uid;}
export function createQueue(storage,uid){
 const key=queueKey(uid);
 function read(){const raw=storage.getItem(key);if(raw===null)return [];const x=JSON.parse(raw);if(!Array.isArray(x)||x.length>64)throw Error('PRODUCTION_QUEUE');for(let i=0;i<x.length;i++){const q=x[i];if(!validId(q.id)||!Number.isSafeInteger(q.expectedRevision)||q.expectedRevision<0||!(q.expectedRevision===0?q.parentId==='':validId(q.parentId))||q.parentId===q.id)throw Error('PRODUCTION_QUEUE');validatePayload(q.payload);if(i&&(q.expectedRevision!==x[i-1].expectedRevision+1||q.parentId!==x[i-1].id))throw Error('PRODUCTION_QUEUE_CHAIN');}if(new Set(x.map(q=>q.id)).size!==x.length)throw Error('PRODUCTION_QUEUE_DUP');return x;}
 function persist(rows){const encoded=JSON.stringify(rows);if(encoded.length>1250000||rows.length>64)throw Error('PRODUCTION_QUEUE_CAPACITY');storage.setItem(key,encoded);}
 return {
  read,
  append(head,payload,id){validatePayload(payload);if(!validId(id))throw Error('PRODUCTION_ID');if(head)validateV2Head(head);const rows=read(),tail=rows.at(-1);
   if(rows.some(q=>q.id===id)||head?.lastOperationId===id)throw Error('PRODUCTION_ID_REUSE');
   if(rows.length&&((head?.revision??0)!==rows[0].expectedRevision||(head?.lastOperationId??'')!==rows[0].parentId))throw Error('PRODUCTION_BASE_CHANGED');
   const q={id,expectedRevision:tail?tail.expectedRevision+1:head?.revision??0,parentId:tail?.id??head?.lastOperationId??'',payload};persist([...rows,q]);return q;},
  async acknowledge(receipt,sha){validateV2Receipt(receipt);const rows=read(),q=rows[0];if(!q||receipt.operationId!==q.id||receipt.revision!==q.expectedRevision+1||receipt.parentId!==q.parentId||receipt.hash!==await sha(q.payload))throw Error('PRODUCTION_ACK');
   if(canonical(read())!==canonical(rows))throw Error('PRODUCTION_QUEUE_CHANGED');persist(rows.slice(1));},
  export(){return JSON.stringify({format:'raytech-production-v2-pending',uid,operations:read()});}
 };
}
export async function withQueueLock(uid,fn,locks=globalThis.navigator?.locks){if(!locks?.request)throw Error('PRODUCTION_LOCK_UNAVAILABLE');return locks.request(queueKey(uid),{mode:'exclusive'},fn);}
export function consumeBudget(storage,uid,day){queueKey(uid);if(!/^\d{4}-\d{2}-\d{2}$/.test(day))throw Error('PRODUCTION_DAY');const key='raytech_production_v2_budget:'+uid;const prev=JSON.parse(storage.getItem(key)??'null'),used=prev?.day===day?prev.used:0;if(!Number.isInteger(used)||used<0||used>=300)throw Error('PRODUCTION_BUDGET');storage.setItem(key,JSON.stringify({day,used:used+1}));return used+1;}
