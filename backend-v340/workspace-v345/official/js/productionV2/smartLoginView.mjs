// Dedicated authentication view; no storage or Firebase dependency.
export function mountSmartLoginView(root,{signIn,signOut,onRetry=()=>{}}){
 const status=root.querySelector('[data-login-status]'), enter=root.querySelector('[data-login-enter]'), exit=root.querySelector('[data-login-exit]'), retry=root.querySelector('[data-login-retry]');
 let pending=false,phase='checking';
 const splash=root.querySelector('[data-pwa-splash]');
 const syncSplash=()=>{if(splash)splash.hidden=!['checking','checking-workspace'].includes(phase);};
 syncSplash();
 const render=()=>{
  enter.hidden=phase!=='signed-out';exit.hidden=phase!=='workspace-blocked';retry.hidden=phase!=='error'&&phase!=='workspace-blocked';
  for(const button of [enter,exit,retry])button.disabled=pending;
 };
 const run=async fn=>{if(pending)return;pending=true;render();try{await fn();}catch{status.textContent='Não foi possível concluir. Verifique sua conexão e tente novamente.';}finally{pending=false;render();}};
 enter.addEventListener('click',()=>void run(signIn));exit.addEventListener('click',()=>void run(signOut));retry.addEventListener('click',()=>void run(onRetry));
 return {paint(state){phase=state.phase;syncSplash();root.hidden=phase==='ready';status.textContent=state.message??(({checking:'Verificando sua sessão…','signed-out':'Entre para acessar suas finanças.','checking-workspace':'Protegendo seus dados…','workspace-blocked':'Este dispositivo precisa de uma vinculação segura antes de abrir os dados.','error':'Não foi possível verificar sua sessão.',ready:''})[phase]??'Acesso indisponível.');render();}};
}
