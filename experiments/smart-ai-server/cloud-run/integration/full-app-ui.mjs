import {creditScenarios} from './credit-scenarios.mjs';
import {bindNativeInvoice} from './native-invoice.mjs';
import {mountSmartAdminAI} from '../ux/smart-admin-ai.mjs';
import {mountAdmin} from '/app/js/productionV2/smartAdminView.mjs';
import {mountSmartLoginView} from '/app/js/productionV2/smartLoginView.mjs';
import {createInvoiceReviewStore} from './review-store.mjs';
import {scripts} from './full-app-scripts.mjs';

const get=id=>document.getElementById(id);
const login=get('smartLogin'),app=get('smartAccountApp'),modal=get('ocrModal'),adminHost=get('smartAdminHost');
const role=document.createElement('select');
role.setAttribute('aria-label','Perfil experimental');
for(const value of ['free','premium','admin','owner'])role.add(new Option(value,value));
login.querySelector('[data-login-enter]').before(role);
const indicator=document.createElement('p');
indicator.textContent='Ambiente isolado · use somente dados fictícios';
role.before(indicator);
const scenario=document.createElement('select');
scenario.setAttribute('aria-label','Cenário experimental');
for(const [value,label] of [['','Padrão · créditos completos, faturamento indisponível'],...Object.entries(creditScenarios).map(([key,value])=>[key,value.label]),
 ['cloud-attention','Sincronização · Atenção'],['unavailable','Serviço indisponível'],
 ['administrative','Suspensão administrativa'],['suspended','Suspensão financeira e reativação'],
 ['cost-0','Faturamento observado: zero'],['cost-15','Consumo 15%'],['cost-25','Consumo 25%'],['cost-50','Consumo 50%'],
 ['cost-75','Consumo 75%'],['cost-100','Consumo 100%'],['cost-125','Consumo 125%']])scenario.add(new Option(label,value));
role.after(scenario);
scenario.onchange=()=>{
 const fixture=Object.hasOwn(creditScenarios,scenario.value)?creditScenarios[scenario.value]:null;
 if(fixture)role.value=fixture.profile;
 role.disabled=Boolean(fixture);
};
const storage=new Map();
globalThis.raytechStorage={getItem:key=>storage.get(key)??null,setItem:(key,value)=>storage.set(key,String(value)),removeItem:key=>storage.delete(key)};
let token,invoiceView,cleanupAdmin;
const confirmations=createInvoiceReviewStore();
const getIdToken=async()=>token;
const request=async(action,body={})=>{
 const reply=await fetch('/lab/session',{method:'POST',cache:'no-store',
  headers:{'content-type':'application/json',...(token?{authorization:'Bearer '+token}:{})},body:JSON.stringify({action,...body})});
 if(!reply.ok)throw Error('ACCESS_DENIED');
 return reply.json();
};
const reauthenticate=async()=>{
 if(!confirm('Simular uma nova autenticação do Owner fictício?'))throw Error('REAUTH_REQUIRED');
 const current=token,result=await request('reauthenticate');
 if(token!==current)throw Error('REAUTH_REQUIRED');
 token=result.token;return token;
};
const loginView=mountSmartLoginView(login,{signIn,signOut,onRetry:()=>location.reload()});
loginView.paint({phase:'signed-out'});
let load;
function signOut(){
 void request('logout').catch(()=>{});
 token=undefined;invoiceView?.clear();cleanupAdmin?.();confirmations.clear();storage.clear();
 location.reload();
}
async function signIn(){
 if(load)return;
 load=activate();
 try{await load;}catch{loginView.paint({phase:'workspace-blocked',message:'Não foi possível abrir a cópia experimental.'});}
}
async function activate(){
 const session=await request('login',{profile:role.value,scenario:scenario.value});
 const profile=session.profile;
 token=session.token;
 const privilege=await fetch('/v1/admin/ai',{method:'POST',cache:'no-store',
  headers:{authorization:'Bearer '+token,'content-type':'application/json'},body:'{"action":"overview"}'});
 const adminRole=privilege.ok?(await privilege.json()).role:null;
 for(const file of scripts)await new Promise((resolve,reject)=>{
  const script=document.createElement('script');script.src='./js/'+file;
  script.onload=resolve;script.onerror=reject;document.body.append(script);
 });
 // The role is selected only on the isolated sign-in screen; the server accepts it only for fixture sessions.
 get('smartAdminOpen').hidden=true;
 const headerProfile=app.querySelector('.v345-account');
 if(headerProfile)headerProfile.hidden=!['owner','admin'].includes(adminRole);
 if(get('v345Avatar'))get('v345Avatar').textContent=adminRole==='owner'?'OF':'AF';
 if(get('v345Identity'))get('v345Identity').textContent=(adminRole==='owner'?'Owner':'Admin')+' fictício';
 if(get('v345Logout'))get('v345Logout').onclick=signOut;
 const cloud=get('productionCloudProfile');
 if(cloud){cloud.hidden=false;cloud.classList.add('flex');}
 if(get('productionCloudB2'))get('productionCloudB2').hidden=false;
 if(get('productionCloudPlanLabel'))get('productionCloudPlanLabel').textContent=profile==='premium'?'Premium':'Free';
 if(get('productionCloudPremiumGreeting'))get('productionCloudPremiumGreeting').hidden=profile!=='premium';
 const renderCloud=state=>{
  const label=get('productionCloudConnection');
  label.textContent=state+' · simulação';
  get('productionCloudHeader').setAttribute('aria-label','Nuvem: '+state+' · simulação');
  get('productionCloudLastSync').textContent=state==='Sincronizado'?'Última sincronização: '+new Date().toLocaleTimeString('pt-BR')+' · Nuvem V2 · revisão fictícia 1':'Última sincronização: —';
  const glyph=({Sincronizado:'synced',Sincronizando:'syncing',Offline:'offline',Desconectado:'disconnected','Atenção':'attention'})[state];
  for(const icon of get('productionCloudHeader').querySelectorAll('[data-cloud-glyph]'))icon.style.display=icon.dataset.cloudGlyph===glyph?'':'none';
 };
 renderCloud(navigator.onLine?(scenario.value==='cloud-attention'?'Atenção':'Desconectado'):'Offline');
 const sync=get('productionCloudSyncNow');
 sync.hidden=false;sync.disabled=false;sync.onclick=()=>{
  if(!navigator.onLine){renderCloud('Offline');return;}
  renderCloud('Sincronizando');setTimeout(()=>renderCloud(navigator.onLine?'Sincronizado':'Offline'),350);
 };
 window.addEventListener('offline',()=>renderCloud('Offline'));
 window.addEventListener('online',()=>renderCloud('Desconectado'));
 if(get('productionCloudGuest'))get('productionCloudGuest').hidden=true;
 if(get('productionCloudName'))get('productionCloudName').textContent='Perfil fictício '+profile;
 if(get('productionCloudInitial'))get('productionCloudInitial').textContent=profile.slice(0,1).toUpperCase();
 globalThis.raytechInvoiceState=()=>({visible:true,premium:true,reason:''});
 invoiceView=bindNativeInvoice({modal,getIdToken,
  readCategories:()=>Object.entries(CATEGORIES).map(([id,{label,icon}])=>({id,label:icon+' '+label})),
  confirm:(invoice,rows)=>confirmations.confirm(invoice,rows),
 });
 globalThis.raytechRecoveryBind?.(invoiceView);
 if(['owner','admin'].includes(adminRole)){
  const accounts=['free','premium','admin','owner'].map(name=>({uid:'lab-'+name,name:'Perfil fictício '+name,
   role:['admin','owner'].includes(name)?name:'user',plan:name==='premium'?'premium':'free',blocked:false}));
  cleanupAdmin=mountAdmin({api:{role:async()=>adminRole,list:async()=>accounts,audit:async()=>[],monitor:async()=>({unavailable:true})},
   role:adminRole,uid:'lab-'+profile});
  const observer=new MutationObserver(()=>{
   const monitor=adminHost.querySelector('.v3467-monitor');
   if(monitor&&!monitor.querySelector('[data-smart-admin-ai]')){
    const slot=document.createElement('section');slot.dataset.smartAdminAi='';
    monitor.querySelector('summary').after(slot);
    if(!get('apiKeyModal'))for(const paragraph of monitor.querySelectorAll('p')){
     if(paragraph.textContent==='Consumo e orçamento indisponíveis.')paragraph.remove();
    }
    mountSmartAdminAI(slot,{getIdToken,reauthenticate,embedded:true,neutralBudget:!get('apiKeyModal'),
     unifiedSearch:get('apiKeyModal')?null:adminHost.querySelector('.admin-tools input')});
   }
   for(const detail of adminHost.querySelectorAll('dialog .v3467-ai:not([data-credits-mounted])')){
    detail.dataset.creditsMounted='';
    const uid=detail.closest('dialog').querySelector('.admin-detail-uid code')?.textContent;
    if(!uid)continue;
    const line=document.createElement('p');line.textContent='Créditos Smart AI · Consultando…';detail.append(line);
    void getIdToken().then(value=>fetch('/v1/admin/ai',{method:'POST',cache:'no-store',headers:{authorization:'Bearer '+value,'content-type':'application/json'},
     body:JSON.stringify({action:'credits',uid})})).then(async reply=>{
      if(!reply.ok)throw Error('ACCESS_DENIED');
      const data=await reply.json();
      line.textContent='Smart AI · '+data.remaining+' créditos disponíveis · '+(data.plan==='premium'?'Premium':'Free')+' · cotas legadas separadas';
     }).catch(()=>{line.textContent='Créditos Smart AI indisponíveis.';});
   }
  });
  observer.observe(adminHost,{childList:true,subtree:true});
 }
 get('productionCloudLogout').disabled=false;
 get('productionCloudLogout').onclick=signOut;
 get('incomeBaseHelpToggle')?.addEventListener('click',event=>{
  const help=get('incomeBaseHelp');help.hidden=!help.hidden;
  event.currentTarget.setAttribute('aria-expanded',String(!help.hidden));
 });
 const pwa=get('smartPwaDialog');
 get('smartPwaOpen')?.addEventListener('click',()=>{if(pwa&&!pwa.open)pwa.showModal();});
 get('smartPwaClose')?.addEventListener('click',()=>pwa?.close());
 window.dispatchEvent(new Event('raytech-account-start'));
 app.hidden=false;app.inert=false;loginView.paint({phase:'ready'});
}

void navigator.serviceWorker?.register('/app/sw.js',{scope:'/app/'}).catch(()=>{});
