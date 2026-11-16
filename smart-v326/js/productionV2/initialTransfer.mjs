import {validatePayload} from './model.mjs';
import {createQueue,withQueueLock,consumeBudget} from './queue.mjs';
import {validateV2Receipt} from './capacity.mjs';
export async function payloadHash(payload){return Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(payload))),b=>b.toString(16).padStart(2,'0')).join('');}
// Initial local-to-cloud transfer only; no automatic upload, restore or overwrite.
export async function seedCloud({cloud,storage,uid,payload,makeId=()=>crypto.randomUUID(),sha=payloadHash,lock=withQueueLock,day=()=>new Date().toISOString().slice(0,10),isCurrent=()=>true}){
 const check=()=>{if(!isCurrent()||cloud.currentUid()!==uid)throw Error('PRODUCTION_SESSION_CHANGED');};
 check();validatePayload(payload);
 return lock(uid,async()=>{
  check();const queue=createQueue(storage,uid);let rows=queue.read();
  if(rows.length>1||rows.some(q=>q.expectedRevision!==0||q.parentId!==''||q.payload!==payload))throw Error('PRODUCTION_PENDING_DIFFERENT');
  const remote=await cloud.read(uid);check();
  if(remote&&!rows.length)throw Error('PRODUCTION_DESTINATION_EXISTS');
  if(!rows.length){queue.append(null,payload,makeId());rows=queue.read();}
  const q=rows[0],expected=validateV2Receipt({operationId:q.id,revision:1,parentId:'',hash:await sha(q.payload)});check();
  if(remote){
   if(!await cloud.confirm(uid,expected))throw Error('PRODUCTION_DESTINATION_EXISTS');
  }else{
   consumeBudget(storage,uid,day());check();
   const result=await cloud.send(uid,q);check();
   if(result.receipt.operationId!==expected.operationId||result.receipt.hash!==expected.hash||result.receipt.revision!==1||result.receipt.parentId!=='')throw Error('PRODUCTION_CONFIRMATION');
   if(!await cloud.confirm(uid,expected))throw Error('PRODUCTION_CONFIRMATION');
  }
  check();await queue.acknowledge(expected,sha);check();return {revision:1,operationId:q.id};
 });
}
