import {mergeInitial} from '../productionV2/smartPremiumInitialMerge.mjs';
import {canonical,validatePayload,mergeThreeWay,reviewApplyFields,validId} from '../productionV2/model.mjs';
import {validateV2Head,validateV2Receipt} from '../productionV2/capacity.mjs';
import {prepareLocal} from '../productionV2/preview.mjs';
import {payloadHash} from '../productionV2/initialTransfer.mjs';
import {consumeBudget,withQueueLock,createQueue} from '../productionV2/queue.mjs';
export const DEVICE_KEY='raytech_production_v2_device';
const BACKUP='raytech_production_v2_original:';
const sameData=(a,b)=>canonical(validatePayload(a).months)===canonical(validatePayload(b).months);
const fail=code=>{throw Error(code);};
export function createSyncEngine({cloud,storage,local,uid,isCurrent=()=>true,online=()=>true,hash=payloadHash,id=()=>crypto.randomUUID(),lock=withQueueLock,day=()=>new Date().toISOString().slice(0,10),prepare=prepareLocal,onConflict=()=>{}}){
 const check=()=>{if(!isCurrent()||cloud.currentUid()!==uid)fail('PRODUCTION_SESSION_CHANGED');};
 const read=()=>{const raw=storage.getItem(DEVICE_KEY);if(raw===null)return null;const s=JSON.parse(raw);if(!s||s.format!==1||s.uid!==uid)fail('PRODUCTION_DEVICE_BOUND');return s;};
 const write=s=>{check();const raw=JSON.stringify(s);storage.setItem(DEVICE_KEY,raw);if(storage.getItem(DEVICE_KEY)!==raw)fail('PRODUCTION_CHECKPOINT_WRITE');};
 const checkedLocal=()=>{const raw=local.read(),p=prepare(raw);if(!p.compatible)fail('PRODUCTION_LOCAL_INCOMPATIBLE');return {raw,payload:p.payload};};
 const verified=async data=>{if(data===null)return null;const h=validateV2Head(data.head),r=validateV2Receipt(data.receipt);if(h.revision!==r.revision||h.lastOperationId!==r.operationId||h.hash!==r.hash||await hash(h.payload)!==h.hash)fail('PRODUCTION_INTEGRITY');check();return {head:h,receipt:r};};
 const expected=async q=>validateV2Receipt({operationId:q.id,revision:q.expectedRevision+1,parentId:q.parentId,hash:await hash(q.payload)});
 function backup(raw){const key=BACKUP+uid;if(storage.getItem(key)===null){storage.setItem(key,raw);if(storage.getItem(key)!==raw)fail('PRODUCTION_BACKUP');}}
 const run=fn=>lock('device_binding',async()=>{check();return fn();});
 async function recoverApply(s,{reconcile=false,decision=null}={}){if(!s.apply)return s;let j=s.apply;await verified(j.base);validatePayload(j.before);validatePayload(j.target);const raw=local.read();if(raw!==j.target){
  if(raw!==j.before){
   if(!reconcile)fail('PRODUCTION_RECOVERY_REQUIRED');
   validatePayload(raw);
   // The interrupted apply was a transaction from before to target. Preserve subsequent independent local changes.
   // Do not use this path for a user-reviewed restore or initial adoption.
   if(!s.base)fail('PRODUCTION_RECOVERY_REQUIRED');
   await continuity(s.base,j.base);
   const remote=await verified(await cloud.read(uid));await continuity(j.base,remote);
   if(decision&&(canonical(decision.checkpoint)!==canonical(s)||decision.local!==raw||canonical(decision.remote)!==canonical(remote)))fail('PRODUCTION_REVIEW_CHANGED');
   const m=decision?reviewApplyFields(j.before,raw,j.target,decision.choices):sameData(raw,j.target)?{payload:raw}:sameData(raw,j.before)?{payload:j.target}:sameData(j.before,j.target)?{payload:raw}:mergeThreeWay(j.before,raw,j.target);
   if(!m.payload)fail('PRODUCTION_RECOVERY_CONFLICT');
   const target=selection(raw,m.payload);validatePayload(target);
   check();if(local.read()!==raw)fail('PRODUCTION_LOCAL_CHANGED');
   // Write and verify a separate immutable recovery record before replacing the pending journal.
   const record=JSON.stringify({checkpoint:s,local:raw,target});
   const key='raytech_apply_recovery_v1:'+uid+':'+await hash(record);
   check();if(local.read()!==raw)fail('PRODUCTION_LOCAL_CHANGED');
   const stored=storage.getItem(key);if(stored!==null&&stored!==record)fail('PRODUCTION_RECOVERY_ARCHIVE');
   if(stored===null)storage.setItem(key,record);
   if(storage.getItem(key)!==record)fail('PRODUCTION_RECOVERY_ARCHIVE');
   j={before:raw,target,base:j.base};s={...s,apply:j};write(s);
  }
  check();if(local.read()!==raw)fail('PRODUCTION_LOCAL_CHANGED');
  if(raw!==j.target&&!local.apply(raw,j.target))fail('PRODUCTION_LOCAL_BUSY');
 }check();if(local.read()!==j.target)fail('PRODUCTION_LOCAL_CHANGED');s={...s,base:j.base,apply:null};write(s);return s;}
 const selection=(before,target)=>{const a=validatePayload(before),b=validatePayload(target);if(Object.hasOwn(b.months,a.selectedMonth))b.selectedMonth=a.selectedMonth;return JSON.stringify(b);};
 async function applyLocal(s,raw,target,base){target=selection(raw,target);validatePayload(target);if(local.read()!==raw)fail('PRODUCTION_LOCAL_CHANGED');backup(raw);s={...s,apply:{before:raw,target,base}};write(s);return recoverApply(s);}
 async function continuity(base,remote){if(!base)return;if(!remote||remote.head.revision<base.head.revision)fail('PRODUCTION_REVISION_ROLLBACK');
  if(remote.head.revision===base.head.revision){if(canonical(remote)!==canonical(base))fail('PRODUCTION_REVISION_DIVERGENCE');}
  else if(!await cloud.confirm(uid,base.receipt))fail('PRODUCTION_RECEIPT_DIVERGENCE');check();}
 async function bind({adopt=false,plan,preserveBoth=false}={}){return run(async()=>{if(read())fail('PRODUCTION_ALREADY_BOUND');if(createQueue(storage,uid).read().length)fail('PRODUCTION_LEGACY_PENDING');if(!online())fail('PRODUCTION_OFFLINE');
  const current=checkedLocal(),remote=await verified(await cloud.read(uid));check();if(local.read()!==current.raw)fail('PRODUCTION_LOCAL_CHANGED');
  if(!plan||plan.local!==current.raw||canonical(plan.remote)!==canonical(remote)||adopt!==(remote!==null))fail('PRODUCTION_BIND_CHANGED');
  if(remote&&!sameData(current.payload,remote.head.payload)&&!adopt)fail('PRODUCTION_ADOPTION_REQUIRED');
  const target=remote&&preserveBoth?mergeInitial(current.raw,remote.head.payload):remote?.head.payload;
  backup(current.raw);let s={format:1,uid,base:null,pending:null,apply:null};
  if(remote&&!sameData(current.payload,remote.head.payload)){s.apply={before:current.raw,target:selection(current.raw,target),base:remote};write(s);s=await recoverApply(s);}
  else {s.base=remote;write(s);}
  return {revision:s.base?.head.revision??0,bound:true};
 });}
 async function tick(){return run(async()=>{let s=read();if(!s)return {status:'unbound'};if(s.base)await verified(s.base);if(!online())return {status:'offline',pending:!!s.pending||!!s.apply||!s.base||!sameData(checkedLocal().payload,s.base.head.payload)};
  if(s.apply)s=await recoverApply(s,{reconcile:true});
  let remote=await verified(await cloud.read(uid));check();await continuity(s.base,remote);
  if(s.pending){
   const q=s.pending;validatePayload(q.payload);if(!validId(q.id)||q.expectedRevision!==(s.base?.head.revision??0)||q.parentId!==(s.base?.head.lastOperationId??''))fail('PRODUCTION_PENDING_CORRUPT');
   const receipt=await expected(q);check();
   let done=await cloud.confirm(uid,receipt);check();
   if(!done&&(remote?.head.revision??0)===q.expectedRevision&&(remote?.head.lastOperationId??'')===q.parentId){
    consumeBudget(storage,uid,day());check();await cloud.send(uid,q);check();done=await cloud.confirm(uid,receipt);check();if(!done)fail('PRODUCTION_CONFIRMATION');
   }
   if(done){const head=validateV2Head({marker:'raytech-financial-production-v2',revision:receipt.revision,lastOperationId:q.id,payload:q.payload,hash:receipt.hash});s={...s,base:{head,receipt},pending:null};write(s);remote=await verified(await cloud.read(uid));await continuity(s.base,remote);}
   else { // Remote advanced with no receipt for this operation; it can no longer commit at its original revision.
    if(!remote||remote.head.revision<=q.expectedRevision)fail('PRODUCTION_CONFIRMATION');s={...s,pending:null};write(s);
   }
  }
  const current=checkedLocal(),base=s.base;
  if(!base&&remote)fail('PRODUCTION_DESTINATION_EXISTS');
  if(remote&&base&&remote.head.revision!==base.head.revision){
   let target=remote.head.payload;
   if(!sameData(current.payload,base.head.payload)){
    const merge=mergeThreeWay(base.head.payload,current.payload,remote.head.payload);
    if(!merge.payload){onConflict({base,local:current.raw,remote,count:merge.conflicts.length});return {status:'conflict',count:merge.conflicts.length,revision:remote.head.revision};}
    target=merge.payload;
   }
   if(!sameData(current.payload,target)){s=await applyLocal(s,current.raw,target,remote);return {status:'updated',revision:remote.head.revision};}
   s={...s,base:remote};write(s);
  }
  const next=checkedLocal();
  if(s.base&&sameData(next.payload,s.base.head.payload))return {status:'synced',revision:s.base.head.revision};
  const q={id:id(),expectedRevision:s.base?.head.revision??0,parentId:s.base?.head.lastOperationId??'',payload:next.payload};s={...s,pending:q};write(s);
  // Keep the durable intent until server receipt confirmation; next tick recovers on interruption.
  const receipt=await expected(q);check();consumeBudget(storage,uid,day());check();await cloud.send(uid,q);check();if(!await cloud.confirm(uid,receipt))fail('PRODUCTION_CONFIRMATION');check();
  s={...s,base:{head:validateV2Head({marker:'raytech-financial-production-v2',revision:receipt.revision,lastOperationId:q.id,payload:q.payload,hash:receipt.hash}),receipt},pending:null};write(s);
  return {status:'synced',revision:receipt.revision};
 });}
 async function review({snapshot,target}){return run(async()=>{const s=read();if(!s||s.pending)fail('PRODUCTION_REVIEW_PENDING');validatePayload(target);const selected=selection(snapshot.local,target),remote=await verified(await cloud.read(uid));await continuity(s.base,remote);
  if(s.apply){const j=s.apply;if(j.before!==snapshot.local||j.target!==selected||canonical(j.base)!==canonical(snapshot.remote)||canonical(s.base)!==canonical(snapshot.base))fail('PRODUCTION_REVIEW_PENDING');await continuity(j.base,remote);return recoverApply(s);}
  if(canonical(s.base)===canonical(snapshot.remote)&&local.read()===selected&&snapshot.local!==selected)return s; // previous reviewed apply committed before clearing review
  if(!remote||canonical(remote)!==canonical(snapshot.remote)||local.read()!==snapshot.local||canonical(s.base)!==canonical(snapshot.base))fail('PRODUCTION_REVIEW_CHANGED');return applyLocal(s,snapshot.local,target,remote);});}
 async function inspectApply(){return run(async()=>{const s=read();if(!s?.base||!s.apply||s.pending)fail('PRODUCTION_RECOVERY_REQUIRED');const raw=local.read(),j=s.apply;await verified(s.base);await verified(j.base);await continuity(s.base,j.base);const remote=await verified(await cloud.read(uid));await continuity(j.base,remote);if(local.read()!==raw)fail('PRODUCTION_LOCAL_CHANGED');const m=reviewApplyFields(j.before,raw,j.target);return {checkpoint:s,local:raw,remote,fields:m.fields,blocked:m.blocked};});}
 async function resolveApply(decision){return run(async()=>{const s=read();if(!s?.apply||s.pending||!s.base||canonical(decision.checkpoint)!==canonical(s)||decision.local!==local.read())fail('PRODUCTION_REVIEW_CHANGED');const m=reviewApplyFields(s.apply.before,decision.local,s.apply.target,decision.choices);if(!m.payload||m.fields.some(f=>!Object.hasOwn(decision.choices,f.path)))fail('PRODUCTION_RECOVERY_CONFLICT');return recoverApply(s,{reconcile:true,decision});});}
 return {bind,tick,review,inspect:read,inspectApply,resolveApply};
}
