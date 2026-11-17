import {syncOnce} from './smartCloud.mjs';
import {MAIN_KEY,MAIN_INITIALIZED_KEY} from './cleanWorkspace.mjs';
const checkpoint='smart-cloud-checkpoint-v332';
export function startSmartCloud({storage,remote,current,status}){
 let stopped=false,busy=false,pending=false,timer=null,off=()=>{};
 const alive=()=>!stopped&&current();
 const local=()=>storage.getItem(MAIN_KEY);
 const base=()=>JSON.parse(storage.getItem(checkpoint)||'null');
 const ack=head=>storage.setItem(checkpoint,JSON.stringify(head));
 const schedule=(ms=350)=>{if(!alive())return;clearTimeout(timer);timer=setTimeout(run,ms);};
 async function run(){
  if(!alive())return;
  if(busy){pending=true;return;}
  if(!navigator.onLine){status('☁ Offline');return;}
  if(window.productionCleanWorkspaceReady!==true){schedule(1500);return;}
  busy=true;status('↻ Sincronizando');
  try{
   const result=await syncOnce({local,base,read:remote.read,write:remote.write,current:alive,ack,
    apply:(expected,payload)=>alive()&&globalThis.productionV2ApplyLocal(expected,payload)});
   if(!alive())return;
   status(result==='synced'?'☁ Sincronizado':result==='conflict'?'⚠ Conflito: dados preservados':result==='retry'?'↻ Sincronização pendente':'☁ Aguardando');
   if(result==='retry')schedule(2000);
  }catch(e){if(alive()){status(navigator.onLine?'⚠ Sincronização pendente':'☁ Offline');schedule(15000);}}
  finally{busy=false;if(pending){pending=false;schedule();}}
 }
 // Fresh device must read before the application creates its blank database.
 async function prepare(){
  if(!alive()||!navigator.onLine||storage.getItem(MAIN_KEY)!==null||storage.getItem(MAIN_INITIALIZED_KEY)!==null)return;
  const head=await remote.read();
  if(!alive()||storage.getItem(MAIN_KEY)!==null||storage.getItem(MAIN_INITIALIZED_KEY)!==null)return;
  if(head){const {validatePayload}=await import('./model.mjs');validatePayload(head.payload);if(!Number.isSafeInteger(head.revision)||head.revision<1)throw Error('CLOUD_REVISION');if(!alive())return;storage.setItem(MAIN_KEY,head.payload);storage.setItem(MAIN_INITIALIZED_KEY,'1');ack(head);}
 }
 const trigger=()=>schedule();
 const offline=()=>{if(alive())status('☁ Offline');};
 window.addEventListener('raytech-finance-saved',trigger);window.addEventListener('online',trigger);window.addEventListener('offline',offline);
 try{off=remote.listen(trigger,()=>{if(alive())status('⚠ Nuvem indisponível');});}catch{}
 const stop=()=>{stopped=true;clearTimeout(timer);off();window.removeEventListener('raytech-finance-saved',trigger);window.removeEventListener('online',trigger);window.removeEventListener('offline',offline);};
 stop.prepare=prepare;schedule();return stop;
}
