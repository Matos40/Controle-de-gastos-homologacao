import {validatePayload} from './model.mjs';
// One document per authenticated account. No automatic last-write-wins.
export function decide(local,base,remote){
 if(local!==null)validatePayload(local);
 if(remote!==null){if(!Number.isSafeInteger(remote.revision)||remote.revision<1)throw Error('CLOUD_REVISION');validatePayload(remote.payload);}
 if(base!==null){if(!Number.isSafeInteger(base.revision)||base.revision<1)throw Error('BASE_REVISION');validatePayload(base.payload);}
 if(remote===null)return base!==null?{kind:'conflict'}:local===null?{kind:'idle'}:{kind:'push',revision:0};
 if(base!==null&&(remote.revision<base.revision||(remote.revision===base.revision&&remote.payload!==base.payload)))return {kind:'conflict'};
 if(local===remote.payload)return {kind:'ack'};
 if(local===null&&base===null)return {kind:'pull'};
 if(base===null)return {kind:'conflict'};
 if(remote.revision<base.revision||(remote.revision===base.revision&&remote.payload!==base.payload))return {kind:'conflict'};
 if(local===base.payload)return {kind:'pull'};
 if(remote.payload===base.payload)return {kind:'push',revision:remote.revision};
 return {kind:'conflict'};
}
export async function syncOnce({local,base,read,write,apply,ack,current}){
 if(!current())throw Error('SESSION_CHANGED');
 const value=local(),checkpoint=base(),remote=await read();
 if(!current()||local()!==value) return 'retry';
 const d=decide(value,checkpoint,remote);
 if(d.kind==='push'){
  const next={revision:d.revision+1,payload:value};
  await write(remote,next);
  if(!current())return 'revoked';
  ack(next);return local()===value?'synced':'retry';
 }
 if(d.kind==='pull'){
  if(!current()||!apply(value,remote.payload))return 'retry';
  ack(remote);return 'synced';
 }
 if(d.kind==='ack'){ack(remote);return 'synced';}
 return d.kind;
}
