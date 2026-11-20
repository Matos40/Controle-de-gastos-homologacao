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
 if(get('productionCloudProfile'))get('productionCloudProfile').hidden=false;
 if(get('productionCloudGuest'))get('productionCloudGuest').hidden=true;
 if(get('productionCloudName'))get('productionCloudName').textContent='Perfil fictício '+profile;
 if(get('productionCloudInitial'))get('productionCloudInitial').textContent=profile.slice(0,1).toUpperCase();
 globalThis.raytechInvoiceState=()=>({visible:true,premium:true,reason:''});
 invoiceView=bindNativeInvoice({modal,apiKey:get('apiKeyModal'),getIdToken,
  readCategories:()=>Object.entries(CATEGORIES).map(([id,{label,icon}])=>({id,label:icon+' '+label})),
  confirm:(invoice,rows)=>confirmations.confirm(invoice,rows),
 });
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
    mountSmartAdminAI(slot,{getIdToken,reauthenticate,embedded:true});
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
      line.textContent='Smart AI · '+data.remaining+' créditos disponíveis · '+(data.plan==='premium'?'Premium':'Free')+' · cotas da Chave API separadas';
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
