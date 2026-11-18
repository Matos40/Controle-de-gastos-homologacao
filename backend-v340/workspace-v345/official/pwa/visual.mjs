export function pwaPresentation(state) {
 const phase=state?.phase;
 const messages={preparing:'Preparando recursos para uso offline…',ready:'Recursos offline preparados. A sessão precisa estar autorizada.', 'update-waiting':'Nova versão preparada. Conclua suas operações, feche todas as janelas e abra novamente.', 'update-failed':'Não foi possível preparar a atualização. A versão ativa permanece disponível.',unavailable:'Preparação offline indisponível neste navegador.'};
 return {status:messages[phase]||messages.preparing,install:!!state?.canInstall&&!state?.standalone,installed:!!state?.standalone,waiting:phase==='update-waiting'};
}
if(typeof window!=='undefined'){
 const by=id=>document.getElementById(id);
 const dialog=by('smartPwaDialog'), status=by('smartPwaStatus'), install=by('smartPwaInstall'), help=by('smartPwaHelp'), notice=by('smartPwaNotice'), check=by('smartPwaCheck'), feedback=by('smartPwaFeedback');
 let dismissed=false, previousPhase='', busy=false;
 const render=state=>{
  const ui=pwaPresentation(state);
  if(previousPhase!==state?.phase){dismissed=false;previousPhase=state?.phase;feedback.textContent='';}
  status.textContent=(ui.installed?'Aplicativo instalado. ':'')+ui.status;
  install.hidden=!ui.install||busy;
  help.hidden=ui.installed;
  notice.hidden=!ui.waiting||dismissed;
  by('smartPwaUpdateText').textContent=ui.waiting?'Salve ou conclua suas operações. Feche todas as janelas do Raytech CG e abra novamente. A atualização não força recarregamento.':state?.phase==='update-failed'?'A versão ativa permanece disponível. Tente verificar novamente quando estiver online.':'Verifique se há uma nova versão.';
  check.disabled=busy||!navigator.onLine||!window.raytechPwa||ui.waiting;
 };
 const refresh=()=>render(window.raytechPwa?.state());
 const open=()=>{refresh();if(!dialog.open)dialog.showModal();};
 by('smartPwaOpen').addEventListener('click',open);
 by('smartPwaNoticeOpen').addEventListener('click',open);
 by('smartPwaClose').addEventListener('click',()=>dialog.close());
 by('smartPwaNoticeLater').addEventListener('click',()=>{dismissed=true;refresh();});
 install.addEventListener('click',async()=>{
  if(busy||!window.raytechPwa)return;
  busy=true;
  try{const result=await window.raytechPwa.install();feedback.textContent=result?.outcome==='accepted'?'Solicitação de instalação aceita.':result?.outcome==='dismissed'?'Instalação adiada.':'Use as instruções do navegador se necessário.';}
  catch{feedback.textContent='Não foi possível abrir o instalador. Consulte as instruções.';}
  finally{busy=false;refresh();}
 });
 check.addEventListener('click',async()=>{
  if(busy||!navigator.onLine||!window.raytechPwa)return;
  busy=true;feedback.textContent='Verificando atualização…';refresh();
  try{const current=await window.raytechPwa.checkUpdate();render(current);feedback.textContent='Verificação solicitada. O estado acima será atualizado pelo navegador.';}
  catch{feedback.textContent='Não foi possível verificar agora. A versão ativa permanece disponível.';}
  finally{busy=false;refresh();}
 });
 window.addEventListener('raytech-pwa-state',event=>render(event.detail));
 window.addEventListener('online',refresh);window.addEventListener('offline',refresh);
 refresh();
}
