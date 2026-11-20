import {mountSmartAI} from '../ux/smart-ai.mjs';
import {mountSmartAdminAI} from '../ux/smart-admin-ai.mjs';
import {mountReview} from './review.mjs';

// Host callbacks are explicit and never receive Gemini secrets or an IAM identity.
export function mountIntegration(root,{enabled,getIdToken,fetcher,reauthenticate,openApiKey,simulateConfirmation,online=()=>navigator.onLine}){
 if(!enabled)return {clear(){}};
 root.innerHTML=`<section class="raytech-ai" aria-label="Importação inteligente de faturas">
 <button type="button" data-smart>Smart AI</button> <button type="button" data-key>Chave API</button>
 <button type="button" data-admin hidden>Smart Admin AI</button>
 <p role="status" data-notice></p></section><div data-panel></div><div data-review-panel></div>`;
 const panel=root.querySelector('[data-panel]'),review=root.querySelector('[data-review-panel]');
 const notice=root.querySelector('[data-notice]'),admin=root.querySelector('[data-admin]');
 let epoch=0,controller=new AbortController();
 const clear=()=>{
  ++epoch;controller.abort();controller=new AbortController();
  panel.replaceChildren();review.replaceChildren();notice.textContent='';admin.hidden=true;
 };
 const begin=()=>{
  clear();
  const current=epoch,signal=controller.signal;
  const guard=fn=>async (...args)=>{
   if(signal.aborted)throw Error('ACCESS_DENIED');
   const value=await fn(...args);
   if(signal.aborted)throw Error('ACCESS_DENIED');
   return value;
  };
  return {getIdToken:guard(getIdToken),reauthenticate:guard(reauthenticate),
   fetcher:guard((path,opts)=>{if(!online())throw Error('OFFLINE');return fetcher(path,{...opts,signal});}),
   active:()=>current===epoch};
 };
 root.querySelector('[data-key]').onclick=()=>{clear();openApiKey();};
 root.querySelector('[data-smart]').onclick=()=>{
  const session=begin();
  const smart=mountSmartAI(panel,{...session,onUpgrade:()=>{notice.textContent='Premium oferece 15 créditos por mês. Assinaturas desativadas neste ensaio.';},
   onReview:data=>{
    if(!session.active())return;
    mountReview(review,data,{confirm:async rows=>{
     if(!session.active())throw Error('ACCESS_DENIED');
     await simulateConfirmation(rows);
    },cancel:message=>{smart.discardReview();notice.textContent=message??'Revisão cancelada.';}});
   }});
  void smart.ready.then(async()=>{
   try{
    const token=await session.getIdToken();if(!token)return;
    const reply=await session.fetcher('/v1/admin/ai',{method:'POST',headers:{authorization:'Bearer '+token,'content-type':'application/json'},body:'{"action":"overview"}'});
    if(session.active()&&reply.ok)admin.hidden=false;
   }catch{}
  });
 };
 admin.onclick=()=>{
  const session=begin();
  admin.hidden=false;
  mountSmartAdminAI(panel,session);
 };
 return {clear};
}
