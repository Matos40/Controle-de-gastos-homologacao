import {mountIntegration} from './mount.mjs';
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
 const profile=role.value;
 ({token}=await request('login',{profile}));
 for(const file of scripts)await new Promise((resolve,reject)=>{
  const script=document.createElement('script');script.src='./js/'+file;
  script.onload=resolve;script.onerror=reject;document.body.append(script);
 });
 const dialog=modal.firstElementChild;
 const heading=dialog.firstElementChild;
 dialog.replaceChildren(heading);
 const surface=document.createElement('div');dialog.append(surface);
 const apiKey=get('apiKeyModal');
 if(apiKey){
  const surface=apiKey.firstElementChild??apiKey;
  const message=document.createElement('p');message.textContent='Chave API pessoal · demonstração. Nenhuma chave é solicitada ou usada.';
  const close=document.createElement('button');close.textContent='Fechar';close.onclick=()=>apiKey.classList.add('hidden');
  surface.replaceChildren(message,close);
 }
 globalThis.openOcrModal=()=>modal.classList.remove('hidden');
 globalThis.closeOcrModal=()=>{invoiceView.clear();modal.classList.add('hidden');};
 globalThis.openApiKeyModal=()=>{modal.classList.add('hidden');apiKey?.classList.remove('hidden');};
 globalThis.raytechInvoiceState=()=>({visible:true,premium:true,reason:''});
 invoiceView=mountIntegration(surface,{enabled:true,getIdToken,fetcher:fetch,reauthenticate,hideAdmin:true,
  openApiKey:globalThis.openApiKeyModal,
  readCategories:()=>Object.entries(CATEGORIES).map(([id,{label,icon}])=>({id,label:icon+' '+label})),
  simulateConfirmation:async (rows,invoice)=>confirmations.confirm(invoice,rows),
 });
 if(['owner','admin'].includes(profile)){
  const accounts=['free','premium','admin','owner'].map(name=>({uid:'lab-'+name,name:'Perfil fictício '+name,
   role:['admin','owner'].includes(name)?name:'user',plan:name==='premium'?'premium':'free',blocked:false}));
  cleanupAdmin=mountAdmin({api:{role:async()=>profile,list:async()=>accounts,audit:async()=>[],monitor:async()=>({unavailable:true})},
   role:profile,uid:'lab-'+profile});
  const observer=new MutationObserver(()=>{
   if(adminHost.hidden||!adminHost.querySelector('h2')||adminHost.querySelector('[data-smart-admin-ai]'))return;
   const slot=document.createElement('section');slot.dataset.smartAdminAi='';adminHost.append(slot);
   mountSmartAdminAI(slot,{getIdToken,reauthenticate});
  });
  observer.observe(adminHost,{childList:true});
 }
 window.addEventListener('offline',()=>{invoiceView.clear();});
 get('productionCloudLogout').disabled=false;
 get('productionCloudLogout').onclick=signOut;
 const headerLogout=document.createElement('button');headerLogout.className='admin-action';headerLogout.textContent='Sair do laboratório';headerLogout.onclick=signOut;
 app.prepend(headerLogout);
 window.dispatchEvent(new Event('raytech-account-start'));
 app.hidden=false;app.inert=false;loginView.paint({phase:'ready'});
}

void navigator.serviceWorker?.register('/app/sw.js',{scope:'/app/'}).catch(()=>{});
