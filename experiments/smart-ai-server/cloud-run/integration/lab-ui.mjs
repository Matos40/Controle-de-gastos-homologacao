import {mountIntegration} from './mount.mjs';

const get=id=>document.getElementById(id);
const workspace=get('workspace'),profile=get('profile'),status=get('session-status');
const signIn=get('sign-in'),signOut=get('sign-out');
let token,view;
const session=async(action,body={},current=token)=>{
 const response=await fetch('/lab/session',{method:'POST',cache:'no-store',
  headers:{'content-type':'application/json',...(current?{authorization:'Bearer '+current}:{})},
  body:JSON.stringify({action,...body})});
 if(!response.ok)throw Error('SESSION_UNAVAILABLE');
 return response.json();
};
signIn.onclick=async()=>{
 signIn.disabled=true;
 try{
  ({token}=await session('login',{profile:profile.value}));
  profile.disabled=true;signIn.hidden=true;signOut.hidden=false;status.textContent='Sessão fictícia ativa.';
  view=mountIntegration(workspace,{enabled:true,getIdToken:async()=>token,fetcher:(path,opts)=>fetch(path,opts),
   openApiKey:()=>get('api-key').showModal(),simulateConfirmation:async()=>{},
   reauthenticate:async()=>{
    if(!window.confirm('Simular um novo login do Owner fictício?'))throw Error('REAUTH_REQUIRED');
    const current=token;
    const refreshed=await session('reauthenticate');
    if(!current||current!==token){void session('logout',{},refreshed.token).catch(()=>{});throw Error('REAUTH_REQUIRED');}
    token=refreshed.token;
    return token;
   }});
 }catch{status.textContent='Não foi possível iniciar a sessão fictícia.';}
 finally{signIn.disabled=false;}
};
signOut.onclick=()=>{
 const current=token;token=undefined;
 view?.clear();view=undefined;workspace.replaceChildren();
 get('api-key').close();
 profile.disabled=false;signIn.hidden=false;signOut.hidden=true;status.textContent='Sessão encerrada.';
 void session('logout',{},current).catch(()=>{});
};
