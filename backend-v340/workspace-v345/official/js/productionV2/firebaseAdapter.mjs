import {requireProductionConfig} from './config.mjs';
import {canTransfer} from './cleanWorkspace.mjs';
import {PRODUCTION_CONFIG} from './config.mjs';
export async function openProductionCloud(config=PRODUCTION_CONFIG){
 requireProductionConfig(config);
 const session=()=>window.raytechLabSession?.(),currentUid=()=>session()?.uid??null;
 const call=async(uid,action,extra={})=>{requireProductionConfig(config);const s=session();if(!s||s.uid!==uid||!canTransfer(config,location.search))throw Error('LAB_SCOPE');const response=await fetch('/api/finance',{method:'POST',headers:{'content-type':'application/json',authorization:'Bearer '+s.token},body:JSON.stringify({workspace:'v2-main',action,...extra}),cache:'no-store'});if(!response.ok||currentUid()!==uid)throw Error('LAB_FINANCE_REJECTED');return response.json();};
 return {currentUid,onSession:fn=>{queueMicrotask(()=>fn(session()??null));return ()=>{};},signIn:()=>{throw Error('USE_LAB_LOGIN');},signOut:()=>window.raytechLabLogout?.(),approved:uid=>call(uid,'approved'),read:uid=>call(uid,'read'),send:(uid,command)=>call(uid,'send',{command}),confirm:(uid,expected)=>call(uid,'confirm',{expected}),sha:async p=>Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(p))),b=>b.toString(16).padStart(2,'0')).join(''),watchHead(uid,notify,error){let stopped=false,last;const tick=async()=>{if(stopped||!navigator.onLine)return;try{const r=await call(uid,'read'),rev=r?.head.revision??0;if(!stopped&&rev!==last){last=rev;notify(rev);}}catch(e){if(!stopped)error?.(e);}};const timer=setInterval(tick,3000);void tick();return ()=>{stopped=true;clearInterval(timer);};}};
}
