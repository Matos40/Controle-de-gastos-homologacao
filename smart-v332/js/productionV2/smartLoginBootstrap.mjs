import {mountSmartLoginView} from './smartLoginView.mjs';
import {openSmartLoginAuth} from './smartLoginAuth.mjs';
import {startSmartCloud} from './smartCloudRuntime.mjs';
import {scopedAccountStorage} from './smartLoginStorage.mjs';
const root=document.getElementById('smartLogin'),panel=document.getElementById('smartAccountApp');
let auth,off,generation=0,started=false,active=null,ready=false,stopCloud=()=>{};
const lock=()=>{stopCloud();panel.hidden=true;panel.inert=true;root.hidden=false;};
const view=mountSmartLoginView(root,{signIn:()=>auth.signIn(),signOut:()=>auth.signOut(),onRetry:()=>start()});
async function loadScripts(){for(const path of ["./js/smartAccount/state.js","./js/smartAccount/services/storageService.js","./js/smartAccount/services/geminiService.js","./js/smartAccount/services/excelService.js","./js/smartAccount/ui/renderSummary.js","./js/smartAccount/ui/renderExpenses.js","./js/smartAccount/ui/renderCards.js","./js/smartAccount/ui/renderAnalytics.js","./js/smartAccount/ui/renderHistory.js","./js/smartAccount/app.js","./js/smartAccount/onboarding.js","./js/smartAccount/ui/categoryPicker.js"])await new Promise((resolve,reject)=>{const s=document.createElement('script');s.src=path;s.onload=resolve;s.onerror=reject;document.body.appendChild(s);});}
async function observe(user){
 if(started&&ready&&user?.uid===active&&auth.currentUid()===active)return;
 const token=++generation;lock();
 if(started&&user?.uid!==active){location.reload();return;}
 if(!user){view.paint({phase:'signed-out'});return;}
 if(started){location.reload();return;}
 view.paint({phase:'checking-workspace'});
 try{
 const uid=user.uid;let plan;try{plan=await auth.profile(uid);}catch(e){if(navigator.onLine||localStorage.getItem('raytech-smart-v332:'+uid+':profile-ok')!=='free')throw e;plan='free';}
 if(token!==generation||auth.currentUid()!==uid)return;
 active=uid;window.smartAccountStorage=scopedAccountStorage(window.localStorage,uid,who=>auth.currentUid()===who&&active===who);
 if(plan==='free')window.smartAccountStorage.setItem('profile-ok','free');
 started=true;await loadScripts();
 if(token!==generation||auth.currentUid()!==uid)return;
 const logout=document.getElementById('productionCloudLogout');
 const profile=document.getElementById('productionCloudProfile');
 if(profile){profile.hidden=false;profile.classList.add('flex');}
 document.getElementById('productionCloudName').textContent=user.displayName||'Conta Google';
 const state=document.getElementById('productionCloudConnection');state.textContent='Plano '+(plan==='free'?'Free':plan)+' · armazenamento local';
 logout.disabled=false;logout.addEventListener('click',async()=>{lock();active=null;try{await auth.signOut();}catch{location.reload();}});
 document.getElementById('productionCloudB2').hidden=true;
 document.getElementById('productionCloudHeader').hidden=true;
 document.getElementById('productionCloudState').hidden=true;
 if(new URLSearchParams(location.search).get('workspace')===null||new URLSearchParams(location.search).get('workspace')==='v2-main')stopCloud=startSmartCloud({storage:window.smartAccountStorage,remote:auth.cloud(uid),current:()=>auth.currentUid()===uid&&active===uid,status:s=>{state.textContent='Plano '+(plan==='free'?'Free':plan)+' · '+s;}});
 await stopCloud.prepare?.();if(token!==generation||auth.currentUid()!==uid)return;
 window.dispatchEvent(new Event('raytech-account-start'));document.dispatchEvent(new Event('raytech-account-start'));
 ready=true;panel.hidden=false;panel.inert=false;view.paint({phase:'ready'});
 }catch{lock();active=null;view.paint({phase:'workspace-blocked'});}
}
async function start(){lock();view.paint({phase:'checking'});try{off?.();auth=await openSmartLoginAuth();off=auth.onSession(user=>void observe(user),()=>{generation++;active=null;ready=false;lock();view.paint({phase:'error'});});}catch{view.paint({phase:'error'});}}
void start();
