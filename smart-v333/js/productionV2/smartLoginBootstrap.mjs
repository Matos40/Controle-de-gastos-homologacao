import {mountAdmin} from './smartAdminView.mjs';
import {startupMessage} from './smartCloudDiagnostics.mjs';
import {mountSmartLoginView} from './smartLoginView.mjs?v=3321';
import {openSmartLoginAuth} from './smartLoginAuth.mjs';
import {startSmartCloud} from './smartCloudRuntime.mjs?v=3321';
import {scopedAccountStorage} from './smartLoginStorage.mjs';
const root=document.getElementById('smartLogin'),panel=document.getElementById('smartAccountApp');
let auth,off,generation=0,started=false,active=null,ready=false,stopCloud=()=>{},stopAccount=()=>{},stopRole=()=>{},stopAdmin=()=>{};
const lock=()=>{stopCloud();stopAccount();stopRole();stopAdmin();panel.hidden=true;panel.inert=true;root.hidden=false;};
const view=mountSmartLoginView(root,{signIn:()=>auth.signIn(),signOut:()=>auth.signOut(),onRetry:()=>location.reload()});
async function loadScripts(){for(const path of ["./js/smartAccount/state.js","./js/smartAccount/services/storageService.js","./js/smartAccount/services/geminiService.js","./js/smartAccount/services/excelService.js","./js/smartAccount/ui/renderSummary.js","./js/smartAccount/ui/renderExpenses.js","./js/smartAccount/ui/renderCards.js","./js/smartAccount/ui/renderAnalytics.js","./js/smartAccount/ui/renderHistory.js","./js/smartAccount/app.js","./js/smartAccount/onboarding.js","./js/smartAccount/ui/categoryPicker.js"])await new Promise((resolve,reject)=>{const s=document.createElement('script');s.src=path;s.onload=resolve;s.onerror=reject;document.body.appendChild(s);});}
async function observe(user){
 if(started&&ready&&user?.uid===active&&auth.currentUid()===active)return;
 const token=++generation;lock();
 if(started&&user?.uid!==active){location.reload();return;}
 if(!user){view.paint({phase:'signed-out'});return;}
 if(started){location.reload();return;}
 view.paint({phase:'checking-workspace'});
 let stage='profile';
 try{
 const uid=user.uid;let plan=await auth.profile(uid);const role=await auth.role(uid);
 if(token!==generation||auth.currentUid()!==uid)return;
 stage='storage';active=uid;window.smartAccountStorage=scopedAccountStorage(window.localStorage,uid,who=>auth.currentUid()===who&&active===who);
 if(plan==='free')window.smartAccountStorage.setItem('profile-ok','free');
 stage='scripts';started=true;await loadScripts();
 if(token!==generation||auth.currentUid()!==uid)return;
 stage='panel';stopAccount=auth.watchAccount(uid,a=>{if(!a||a.blocked===true){generation++;active=null;lock();view.paint({phase:'workspace-blocked',message:'Conta bloqueada. Entre em contato com o suporte.'});}else if(a.plan!==plan){location.reload();}},()=>{generation++;active=null;lock();view.paint({phase:'error',message:'Não foi possível verificar a autorização da conta.'});});
 if(role){stopAdmin=mountAdmin({api:auth.admin(uid),role,uid});stopRole=auth.watchRole(uid,next=>{if(next!==role)location.reload();},()=>stopAdmin());}
 const logout=document.getElementById('productionCloudLogout');
 const profile=document.getElementById('productionCloudProfile');
 if(profile){profile.hidden=false;profile.classList.add('flex');}
 document.getElementById('productionCloudName').textContent=user.displayName||'Conta Google';
 const state=document.getElementById('productionCloudConnection');state.textContent='Plano '+(plan==='free'?'Free':plan)+' · armazenamento local';
 logout.disabled=false;logout.addEventListener('click',async()=>{lock();active=null;try{await auth.signOut();}catch{location.reload();}});
 document.getElementById('productionCloudB2').hidden=true;
 document.getElementById('productionCloudHeader').hidden=true;
 document.getElementById('productionCloudState').hidden=true;
 stage='cloud';if(new URLSearchParams(location.search).get('workspace')===null||new URLSearchParams(location.search).get('workspace')==='v2-main')stopCloud=startSmartCloud({storage:window.smartAccountStorage,remote:auth.cloud(uid),current:()=>auth.currentUid()===uid&&active===uid,status:s=>{state.textContent='Plano '+(plan==='free'?'Free':plan)+' · '+s;state.style.color=s.includes('Sincronizado')?'#4ade80':s.includes('Offline')?'#94a3b8':s.includes('⚠')?'#fbbf24':'#38bdf8';}});
 await stopCloud.prepare?.();stage='panel-start';if(token!==generation||auth.currentUid()!==uid)return;
 window.dispatchEvent(new Event('raytech-account-start'));document.dispatchEvent(new Event('raytech-account-start'));
 ready=true;panel.hidden=false;panel.inert=false;view.paint({phase:'ready'});
 }catch(error){lock();active=null;console.error('[V33.3 startup]',stage,error);view.paint({phase:'workspace-blocked',message:error?.message==='ACCOUNT_BLOCKED'?'Conta bloqueada. Entre em contato com o suporte.':startupMessage(stage,error)});}
}
async function start(){lock();view.paint({phase:'checking'});try{off?.();auth=await openSmartLoginAuth();off=auth.onSession(user=>void observe(user),()=>{generation++;active=null;ready=false;lock();view.paint({phase:'error'});});}catch{view.paint({phase:'error'});}}
void start();
