import {cloudEntitlement} from './smartPremiumPolicy.mjs';
import {mountSmartLoginView} from './smartLoginView.mjs';
import {mountAdmin} from './smartAdminView.mjs';
import {openSmartLoginAuth} from './smartLoginOfficialAuth.mjs';
import {resolveWorkspaceIdentity,scopedStorage,OWNER_KEY,ORIGINAL_KEYS,resolveOfflineIdentity,cacheOfflineGrant,revokeOfflineGrant} from './smartLoginOfficialIdentity.mjs';
const root=document.getElementById('smartLogin'),panel=document.getElementById('smartAccountApp'),raw=window.localStorage;
let auth,active=null,generation=0,started=false,stopAccount=()=>{},stopRole=()=>{},stopAdmin=()=>{};
let aiGrant=false;
Object.defineProperty(window,'raytechCanUseInvoiceAI',{value:()=>aiGrant&&!!active&&auth?.currentUid()===active&&!window.raytechSessionRevoked&&navigator.onLine!==false});
const notifyAI=()=>window.dispatchEvent(new Event('raytech-ai-entitlement-changed'));
const lock=()=>{aiGrant=false;active=null;notifyAI();window.raytechSessionRevoked=true;window.productionCleanWorkspaceReady=false;panel.hidden=true;panel.inert=true;root.hidden=false;stopAccount();stopRole();stopAdmin();};
const view=mountSmartLoginView(root,{signIn:()=>auth.signIn(),signOut:()=>auth.signOut(),onRetry:()=>location.reload()});
const scripts=["./js/state.js","./js/services/storageService.js","./js/services/geminiService.js","./js/services/excelService.js","./js/ui/renderSummary.js","./js/ui/renderExpenses.js","./js/ui/renderCards.js","./js/ui/renderAnalytics.js","./js/ui/renderHistory.js","./js/app.js","./js/onboarding.js","./js/ui/categoryPicker.js"];
async function loadScripts(){for(const path of scripts)await new Promise((resolve,reject)=>{const s=document.createElement('script');s.src=path;s.onload=resolve;s.onerror=reject;document.body.appendChild(s);});}
async function observe(user){
 if(started&&active&&active===user?.uid)return;
 const token=++generation;lock();
 if(started){location.reload();return;}
 if(!user){view.paint({phase:'signed-out'});return;}
 view.paint({phase:'checking-workspace'});
 try{
 const uid=user.uid,offlineStartup=navigator.onLine===false;let role=null,access=null,accountPlan=null;
 if(!offlineStartup){try{accountPlan=await auth.profile(uid);role=await auth.role(uid);access=await auth.access(uid);}catch(error){try{revokeOfflineGrant(raw,uid);}catch{}throw error;}}
 if(token!==generation||auth.currentUid()!==uid)return;
 const checkpoint=raw.getItem('raytech_cg_v2_main_sync_v1:raytech_production_v2_device');
 const checkpointUid=checkpoint===null?null:JSON.parse(checkpoint).uid;
 const storedOwnerUid=raw.getItem(OWNER_KEY),hasOriginalData=ORIGINAL_KEYS.some(k=>raw.getItem(k)!==null);
 const verifiedOwnerUid=(checkpointUid===uid&&access?.enabled===true)||(role==='owner'&&access?.enabled===true&&(!checkpointUid||checkpointUid===uid))?uid:null;
 const identity=offlineStartup?resolveOfflineIdentity(raw,uid,{storedOwnerUid,checkpointUid,hasOriginalData}):resolveWorkspaceIdentity({uid,verifiedOwnerUid,storedOwnerUid,checkpointUid,hasOriginalData});
 if(identity.original&&!storedOwnerUid){if(!checkpointUid&&!window.confirm('Vincular os bancos originais deste dispositivo à sua conta Google? Nenhum dado será copiado.'))throw Error('OWNER_CONFIRMATION_REQUIRED');if(raw.getItem(OWNER_KEY)!==null)throw Error('OWNER_BINDING_CHANGED');raw.setItem(OWNER_KEY,uid);}
 if(!offlineStartup){try{cacheOfflineGrant(raw,identity);}catch{console.warn('[V33.4] local offline grant unavailable');}}
 if(offlineStartup){window.addEventListener('online',()=>{if(active===uid){generation++;lock();location.reload();}},{once:true,capture:true});if(navigator.onLine){location.reload();return;}}
 const entitlement=cloudEntitlement({plan:accountPlan,role,access,verified:!offlineStartup});window.raytechCloudEntitlement=entitlement;
 aiGrant=!offlineStartup&&(accountPlan==='premium'||['owner','admin'].includes(role));
 active=uid;window.raytechSessionRevoked=false;window.raytechStorage=scopedStorage(raw,identity,who=>active===who&&auth.currentUid()===who);
 started=true;await loadScripts();if(token!==generation||active!==uid)return;
 await import('./preview.mjs');await import('./cloudPanel.mjs');
 if(token!==generation||active!==uid)return;
 if(!offlineStartup)stopAccount=auth.watchAccount(uid,a=>{if(!a||a.blocked===true){try{revokeOfflineGrant(raw,uid);}catch{}generation++;lock();view.paint({phase:'workspace-blocked',message:'Conta bloqueada. Entre em contato com o suporte.'});}else if(a.plan!==accountPlan){aiGrant=a.plan==='premium'||['owner','admin'].includes(role);notifyAI();window.raytechCloudEntitlement=cloudEntitlement({plan:a.plan,role,access});window.dispatchEvent(new Event('raytech-plan-changed'));accountPlan=a.plan;}},()=>{try{revokeOfflineGrant(raw,uid);}catch{}generation++;lock();view.paint({phase:'error'});});
 const logout=document.getElementById('productionCloudLogout');
 const signOut=async event=>{event?.stopImmediatePropagation();try{revokeOfflineGrant(raw,uid);}catch{}generation++;lock();try{await auth.signOut();location.reload();}catch{view.paint({phase:'workspace-blocked',message:'Não foi possível encerrar a sessão. Tente novamente.'});}};
 logout?.addEventListener('click',signOut,{capture:true});
 // An upper logout control exists only for a verified administrative role.
 if(!offlineStartup&&['owner','admin'].includes(role)){
   const exit=document.createElement('button');exit.type='button';exit.id='smartOfficialLogout';exit.className='admin-action';exit.textContent='Sair da conta';exit.addEventListener('click',signOut);panel.prepend(exit);
   stopAdmin=mountAdmin({api:auth.admin(uid),role,uid});
   const removeAdmin=()=>{exit.remove();stopAdmin();aiGrant=accountPlan==='premium';notifyAI();};
   stopRole=auth.watchRole(uid,next=>{if(next!==role){removeAdmin();try{revokeOfflineGrant(raw,uid);}catch{}lock();location.reload();}},removeAdmin);
 }
 window.dispatchEvent(new Event('raytech-account-start'));document.dispatchEvent(new Event('raytech-account-start'));
 if(token!==generation||active!==uid)return;
 panel.hidden=false;panel.inert=false;view.paint({phase:'ready'});notifyAI();
 }catch(e){lock();console.error('[V33.4]',e);view.paint({phase:'workspace-blocked',message:'Acesso protegido. Verifique a conexão, autorização e vínculo da conta. Nenhum banco foi apagado.'});}
}
try{auth=await openSmartLoginAuth();auth.onSession(user=>void observe(user),()=>{lock();view.paint({phase:'error'});});}catch{view.paint({phase:'error'});}
