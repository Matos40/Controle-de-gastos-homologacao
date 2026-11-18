import {PRODUCTION_CONFIG} from './config.mjs';
import {databaseKey,scopeSyncStorage,canTransfer,syncPrefix} from './cleanWorkspace.mjs';
import {createProductionSyncSession,LIMITS,RECOVERY_KEY,REVIEW_KEY} from '../experimentalSync/session.mjs';
import {DEVICE_KEY} from '../experimentalSync/engine.mjs';
import {createEventRuntime,syncFailure} from './eventRuntime.mjs';
import {payloadHash} from './initialTransfer.mjs';
import {withQueueLock} from './queue.mjs';
import {decodeJsonFile} from '../experimentalSync/backupFiles.mjs';
export function bindCloudPanel(doc,storage,{config=PRODUCTION_CONFIG,open=async()=>{const m=await import('./firebaseAdapter.mjs');return m.openProductionCloud();},confirm=message=>globalThis.confirm(message),win=globalThis.window}={}){
 const el=id=>doc.getElementById(id),status=el('productionCloudStatus'),connect=el('productionCloudConnect'),login=el('productionCloudLogin'),inspect=el('productionCloudInspect'),seed=el('productionCloudSeed'),logout=el('productionCloudLogout'),refresh=el('productionCloudRefresh'),adopt=el('productionCloudAdopt'),pauseBtn=el('productionCloudPause'),resumeBtn=el('productionCloudResume');
 if(!status||!connect||!login||!inspect||!seed||!logout)return;
 const search=win?.location?.search??'',dbKey=databaseKey(search),syncStorage=scopeSyncStorage(storage,search),canSync=canTransfer(config,search);
 const b2=el('productionCloudB2'),planBox=el('productionCloudPlan'),reviewBox=el('productionCloudReview'),historyBox=el('productionCloudHistory'),backupBtn=el('productionCloudBackup'),stageBtn=el('productionCloudStage'),reviewBtn=el('productionCloudResolve'),updateBtn=el('productionCloudUpdateReview'),historyBtn=el('productionCloudShowHistory'),historyExport=el('productionCloudExportHistory'),diagnosticBtn=el('productionCloudDiagnostic');
 const extra=[pauseBtn,resumeBtn,backupBtn,stageBtn,reviewBtn,updateBtn,historyBtn,historyExport,diagnosticBtn];
 if(b2)b2.hidden=!canSync;
 const technical=el('productionCloudTechnical'),setupPanel=el('productionCloudSetup'),advanced=el('productionCloudAdvanced'),header=el('productionCloudHeader');
 if(technical)technical.hidden=!canSync;if(header)header.hidden=!canSync;
 const previewStatus=el('productionV2PreviewStatus');if(canSync&&previewStatus)previewStatus.textContent='Verificação de compatibilidade somente neste dispositivo.';
 if(dbKey===null){for(const button of [connect,login,inspect,seed,logout,refresh,adopt,...extra])if(button)button.disabled=true;status.textContent='Endereço de banco inválido.';return;}
 const applyBox=el('productionCloudApplyReview'),applyOpen=el('productionCloudApplyOpen'),applyFields=el('productionCloudApplyFields'),applyConfirm=el('productionCloudApplyConfirm'),applyBackup=el('productionCloudApplyBackup'),applyResolve=el('productionCloudApplyResolve');let applyReview=null,applyFingerprint=null;
 const clearApply=()=>{applyReview=null;applyFingerprint=null;if(applyFields)applyFields.textContent='';if(applyConfirm)applyConfirm.checked=false;if(applyBackup)applyBackup.checked=false;};
 const CONNECTION_KEY='auto-connect-v1',LAST_KEY='last-sync-v1';
 const maintenance=new URLSearchParams(search).get('maintenance')==='1';
 if(advanced)advanced.hidden=!maintenance;status.hidden=false;
 let displayedReview=null,displayedConflict=null;
 const reviewDetails=el('productionCloudReviewDetails'),reviewHome=reviewDetails?.parentElement,reviewOpen=el('productionCloudReviewOpen'),retry=el('productionCloudRetry'),manualSync=el('productionCloudSyncNow');
 const connection=()=>{const stored=syncStorage.getItem(CONNECTION_KEY);if(stored!==null)return stored==='signed-out'?null:stored;try{const p=JSON.parse(syncStorage.getItem('experimental-sync-policy-v1')),c=JSON.parse(syncStorage.getItem(DEVICE_KEY));return p?.uid&&p.uid===c?.uid&&['active','paused'].includes(p.state)?p.uid:null;}catch{return null;}};
 const online=()=>win?.navigator?.onLine!==false&&!win?.raytechOnlineAuthorizationPending;
 let unsubscribe=null,watchGeneration=0,watchStarting=false,watchFailed=false,watchTerminal=false,watchFailures=0,watchRetryTimer=null,watchRevision=null,unifiedLogin=false,reviewExpanded=false,profile=null,syncing=false,attention=false,recovering=false,verifiedSync=false,restoring=false,cloud=null,uid=null,busy=false,generation=0,session=null,runtime=null,plan=null,bound=false,review=null,invalid=false,writeAllowed=false,storageChanged=false;
 const unlocked=()=>!el('pinLockOverlay')||el('pinLockOverlay').classList.contains('hidden');
 const entitlement=()=>win?.raytechCloudEntitlement??{eligible:true,writeEnabled:true};
 const premium=()=>entitlement().eligible===true&&entitlement().writeEnabled===true;
 const ready=()=>!win?.raytechSessionRevoked&&!storageChanged&&win?.productionCleanWorkspaceReady===true&&unlocked();
 const say=message=>{status.textContent=message;};
 const result=r=>{recovering=false;verifiedSync=r.status==='synced'&&!session?.hasLocalChanges();attention=false;const labels={synced:verifiedSync?'Sincronizado':'Aguardando envio das alterações locais',updated:'Alterações recebidas. Conferindo sincronização',empty:'Conectado. Aguardando lançamentos ou valores',paused:'Pausado',offline:'Sem internet',conflict:'Conflito: revisão necessária',idle:'Aguardando',throttled:'Aguardando próxima consulta'};if(verifiedSync&&uid){try{syncStorage.setItem(LAST_KEY,JSON.stringify({uid,at:new Date().toISOString()}));}catch{}}say('Nuvem V2 · '+(labels[r.status]??r.status)+(r.revision?' · revisão '+r.revision:''));};
 const reportFailure=({kind,persistent=false})=>{
  verifiedSync=false;if(kind!=='offline')attention=persistent;recovering=kind==='transient';
  if(kind==='offline')say('Sem internet. As alterações serão sincronizadas quando a conexão voltar.');
  else if(kind==='budget')say('Reserva diária esgotada. Os dados locais foram preservados.');
  else if(kind==='transient')say(persistent?'A nuvem segue indisponível. As tentativas automáticas continuam.':'Nuvem temporariamente indisponível. Reconectando automaticamente.');
  else say('A sincronização requer atenção. Os dados e as alterações pendentes foram preservados.');
 };
 const error=e=>{
  const failure=syncFailure(e,online());
  if(runtime&&bound&&session?.state().persisted==='active')runtime.fail(e);
  else reportFailure({...failure,persistent:failure.kind==='persistent'});
 };
 const disable=(e,v)=>{if(e)e.disabled=!!v;};
 function stopWatch(){watchGeneration++;watchStarting=false;watchRevision=null;unsubscribe?.();unsubscribe=null;}
 function clearWatchRetry(){
  if(watchRetryTimer!==null)win.clearTimeout(watchRetryTimer);
  watchRetryTimer=null;
 }
 function watchError(e,token){
  if(token!==watchGeneration)return;
  stopWatch();watchFailed=true;verifiedSync=false;
  const failure=syncFailure(e,online());
  watchTerminal=failure.kind==='persistent';
  if(failure.kind==='transient'){
    const ms=Math.min(300000,(failure.code==='resource-exhausted'?60000:2000)*2**Math.min(watchFailures++,8));
    clearWatchRetry();
    watchRetryTimer=win.setTimeout(()=>{watchRetryTimer=null;watchFailed=false;paint();},ms);
  }
  runtime?.fail(e);
  paint();
 }
 function watchState(){
  const allowed=canSync&&uid&&session&&bound&&writeAllowed&&!review&&!invalid&&ready()&&online()
    &&doc.visibilityState!=='hidden'&&session.state().active;
  if(!allowed){if(unsubscribe||watchStarting)stopWatch();return;}
  if(unsubscribe||watchStarting||watchFailed||!cloud?.watchHead||busy||restoring||syncing||session.state().busy)return;
  watchStarting=true;
  const token=++watchGeneration,who=uid;
  void session.reserveListener().then(ok=>{
    if(token!==watchGeneration||who!==uid)return;
    watchStarting=false;
    if(!ok)return;
    unsubscribe=cloud.watchHead(who,revision=>{
      if(token!==watchGeneration||who!==uid||watchRevision===revision)return;
      watchRevision=revision;
      if(revision===null){verifiedSync=false;paint();return;}
      watchFailures=0;
      let base;
      try{base=JSON.parse(syncStorage.getItem(DEVICE_KEY))?.base?.head?.revision??0;}catch{return;}
      if(revision!==base||!verifiedSync){verifiedSync=false;runtime?.signal();paint();}
    },e=>watchError(e,token));
  }).catch(e=>watchError(e,token));
 }
 function paint(){
  if(applyOpen){applyOpen.hidden=!canSync||!uid||!applyFingerprint||!!review||invalid;applyOpen.disabled=busy||!online()||!ready()||!!session?.state().active;}
  if(applyBox)applyBox.hidden=!applyReview||!uid||!ready();
  if(applyResolve)applyResolve.disabled=busy||!online()||!ready()||!applyReview||!!applyReview?.blocked?.length;
  connect.disabled=busy||!!cloud||!config.enabled;login.disabled=busy||!cloud||!!uid;inspect.hidden=!canSync||!premium()||!uid||(bound&&writeAllowed);inspect.disabled=busy||!premium()||!uid||!ready()||!online();logout.disabled=busy||!uid;
  let st={active:false,busy:false};try{if(session)st=session.state();}catch{invalid=true;}
  const indicator=el('productionCloudConnection'),last=el('productionCloudLastSync');const waiting=!!st.budgetWaiting;const renewal=waiting?new Date(Date.parse(st.budgetDay+'T00:00:00Z')+86400000).toLocaleString('pt-BR'):'';
  if(indicator)indicator.textContent=!premium()?'Google conectado · '+(entitlement().plan==='free'?'Free · dados locais':'dados locais'):!online()?'Sem internet — dados locais preservados':!unlocked()?'Bloqueado pelo PIN':!uid?'Desconectado':invalid||review?'Revisão necessária':st.active?'Conectado · automático':bound?'Conectado · pausado':'Conectado · aguardando vínculo';
  if(setupPanel)setupPanel.hidden=!canSync||bound||!plan;
  const transfers=el('productionCloudTransferActions');if(transfers)transfers.hidden=!canSync||bound||!plan;
  if(advanced&&review&&maintenance){advanced.open=true;if(reviewDetails)reviewDetails.open=true;}
  if(reviewDetails&&reviewHome&&!maintenance){if(review&&reviewExpanded){setupPanel?.after(reviewDetails);reviewDetails.open=true;}else if(reviewDetails.parentElement!==reviewHome){reviewHome.appendChild(reviewDetails);reviewDetails.open=false;}}
  if(reviewOpen)reviewOpen.hidden=maintenance||!review;
  if(reviewBtn&&review?.kind==='conflict')reviewBtn.textContent='Confirmar escolhas e sincronizar';else if(reviewBtn)reviewBtn.textContent='Aplicar e manter pausa';
  if(manualSync){manualSync.hidden=!canSync||!uid||!bound||!st.active||!!review||invalid;manualSync.disabled=busy||st.busy||waiting||!online()||!ready()||!writeAllowed;}
  if(retry){retry.hidden=maintenance||!uid||!!review||invalid||(!attention&&(!bound||st.active));retry.disabled=busy||st.busy||waiting||!online()||!ready();}
  if(header&&canSync){
   const kind=uid&&entitlement().plan==='free'&&!premium()?'free':!premium()?'disconnected':!uid?'disconnected':!online()?'offline':invalid||attention?'attention':waiting||review?'paused':syncing||st.busy?'syncing':recovering?'paused':st.active&&verifiedSync?'synced':st.active?'online':'paused';

   const labels={free:'Google conectado · Plano Free (dados locais)',disconnected:'Desconectado',offline:'Sem internet',attention:'Atenção necessária',syncing:'Sincronizando',synced:'Sincronizado',online:'Conectado',paused:recovering?'Reconectando automaticamente':review?'Revisão necessária':'Pausado'};
   header.title='Nuvem: '+labels[kind];header.setAttribute('aria-label',header.title);header.dataset.syncState=kind;
   header.classList.remove('text-emerald-400','text-amber-400','text-slate-400','text-blue-400','text-red-400');
   header.classList.add(kind==='synced'?'text-emerald-400':kind==='syncing'?'text-blue-400':kind==='attention'?'text-red-400':kind==='offline'||kind==='paused'?'text-amber-400':'text-slate-400');
   const glyph=header.querySelector('svg');if(glyph){for(const g of glyph.querySelectorAll('[data-cloud-glyph]'))g.style.display=g.dataset.cloudGlyph===kind?'':'none';glyph.classList.toggle('raytech-sync-spin',kind==='syncing');}
   const panelIcon=el('productionCloudPanelIcon'),panelCheck=el('productionCloudPanelCheck'),greeting=el('productionCloudPremiumGreeting');
   if(panelIcon){panelIcon.classList.remove('text-emerald-400','text-amber-400','text-slate-400','text-blue-400','text-red-400');panelIcon.classList.add(kind==='synced'?'text-emerald-400':kind==='syncing'?'text-blue-400':kind==='attention'?'text-red-400':kind==='offline'||kind==='paused'?'text-amber-400':'text-slate-400');}
   if(panelCheck)panelCheck.style.display=kind==='synced'?'':'none';
   if(greeting)greeting.hidden=!(uid&&entitlement().plan==='premium');
   const guest=el('productionCloudGuest'),person=el('productionCloudProfile'),google=el('productionCloudGoogle'),name=el('productionCloudName'),photo=el('productionCloudPhoto'),initial=el('productionCloudInitial'),notice=el('productionCloudNotice');
   if(guest)guest.hidden=!!uid;if(person){person.hidden=!uid;person.classList.toggle('flex',!!uid);}if(google)google.disabled=busy||!online()||!ready();
   if(name)name.textContent=profile?.displayName||profile?.email||'Conta Google';
   if(initial)initial.textContent=(profile?.displayName||profile?.email||'G').trim().slice(0,1).toUpperCase();
   if(photo){let url=null;try{const u=new URL(profile?.photoURL);if(PRODUCTION_CONFIG.firebase.projectId==='raytech-cg-homologacao'&&u.protocol==='https:'&&/(^|\.)googleusercontent\.com$/.test(u.hostname))url=u.href;}catch{}if(url&&photo.getAttribute('src')!==url){photo.hidden=false;if(initial){initial.hidden=true;initial.classList.remove('flex');}photo.src=url;}else if(!url){photo.removeAttribute('src');photo.hidden=true;if(initial){initial.hidden=false;initial.classList.add('flex');}}}
   if(notice){notice.hidden=!review&&!attention&&!invalid&&!waiting;notice.textContent=waiting&&!review&&!invalid?'Reserva diária esgotada. Retomada automática a partir de '+renewal+'. Dados locais preservados.':review?'Existem alterações que precisam ser revisadas. Seus dados estão preservados.':invalid?'Sincronização protegida. Entre em contato com o suporte.':'Não foi possível sincronizar. Seus dados locais estão preservados.';}
   const view=el('productionCloudState');if(view)view.hidden=!uid;
   if(indicator&&!premium())indicator.textContent=kind==='free'?'Google conectado · Plano Free\nSincronização exclusiva Premium':'Google conectado · dados locais';
   if(indicator&&kind==='synced')indicator.textContent='Sincronizado';
   if(indicator&&kind==='online')indicator.textContent='Sincronização ativa · aguardando confirmação';
   if(indicator&&recovering&&kind==='paused')indicator.textContent='Reconectando automaticamente';
   if(indicator&&kind==='syncing')indicator.textContent='Sincronizando…';
   if(indicator&&kind==='attention')indicator.textContent='Atenção necessária';if(indicator&&waiting&&!review&&!invalid)indicator.textContent='Reserva diária esgotada';
  }
  if(indicator&&canSync){const free=!!uid&&entitlement().plan==='free'&&!premium();indicator.classList.toggle('text-emerald-400',verifiedSync&&!!st.active&&online()&&!invalid&&!review&&!attention&&!syncing&&!st.busy);indicator.classList.toggle('text-amber-400',!free&&!!uid&&(!st.active||!online()||invalid||!!review||attention));indicator.classList.toggle('text-slate-400',!uid);}
  if(last){try{const x=JSON.parse(syncStorage.getItem(LAST_KEY));last.textContent=!premium()?'Dados salvos neste dispositivo':x?.uid===uid?'Última sincronização: '+new Date(x.at).toLocaleString('pt-BR'):'Última sincronização: —';}catch{last.textContent='Última sincronização: —';}}
  const remoteBackup=el('productionCloudRemoteBackup');if(remoteBackup){remoteBackup.hidden=!plan?.remoteBackup;remoteBackup.disabled=busy;}
  const blocked=busy||!premium()||!canSync||!session||invalid||!ready()||st.busy;
  seed.disabled=blocked||bound||plan?.mode!=='seed'||!writeAllowed;disable(adopt,blocked||bound||!['adopt','merge'].includes(plan?.mode)||plan?.conflict||!writeAllowed);
  disable(refresh,blocked||!bound||!st.active||!!review||!writeAllowed);
  if(canSync){connect.hidden=!!cloud;login.hidden=!!uid||!cloud;seed.hidden=bound||plan?.mode!=='seed';if(adopt){adopt.hidden=bound||!['adopt','merge'].includes(plan?.mode)||plan?.conflict;adopt.textContent=plan?.mode==='merge'?'Conciliar e sincronizar':'Receber da nuvem';}if(refresh)refresh.hidden=!bound;logout.hidden=!uid;}else {const p=el('productionCloudProfile');if(p)p.hidden=!uid;const state=el('productionCloudState');if(state)state.hidden=true;}
disable(pauseBtn,!canSync||!session||(!st.active&&!waiting));disable(resumeBtn,blocked||!bound||st.active||waiting||!!review||!writeAllowed);
  disable(backupBtn,blocked);disable(stageBtn,blocked||!bound||st.active||!!review||!writeAllowed);disable(reviewBtn,blocked||st.active||!review||!writeAllowed||!!displayedConflict?.blocked.length);disable(updateBtn,blocked||st.active||!review||!writeAllowed);
  for(const e of [historyBtn,historyExport,diagnosticBtn])disable(e,blocked);
  if(canSync)try{watchState();}catch{stopWatch();}
 }
 function renderConflictReview(){if(!reviewBox)return;const select=el('productionCloudChoice'),fingerprint=review?JSON.stringify(review):null;if(select)select.hidden=review?.kind==='conflict';if(fingerprint===displayedReview?.fingerprint&&reviewBox.childNodes.length)return;displayedReview=review?{fingerprint,snapshot:structuredClone(review)}:null;displayedConflict=null;reviewBox.replaceChildren();reset('productionCloudReviewConsent','productionCloudReviewBackup');if(!review){reviewBox.textContent='Nenhuma revisão pendente.';return;}if(review.kind!=='conflict'){reviewBox.textContent='Backup em revisão. Confira a origem e exporte as versões antes de aplicar.';return;}const data=session.conflictFields();displayedConflict=data;const add=(tag,text,home=reviewBox)=>{const e=doc.createElement(tag);e.textContent=text;home.appendChild(e);return e;};add('p','Escolha uma versão para cada divergência. Alterações independentes serão preservadas.');const money=v=>new Intl.NumberFormat('pt-BR',{style:'currency',currency:'BRL'}).format(v);const labels={salary:'Salário',budgetLimit:'Limite do orçamento',expenses:'Despesa',cardExpenses:'Cartão',extraIncomes:'Renda extra',title:'Nome',description:'Descrição',category:'Categoria',amount:'Valor',type:'Tipo',date:'Data',paid:'Pago',installmentValue:'Valor da parcela',totalAmount:'Valor total',installments:'Parcelas',currentInstallment:'Parcela atual',isInstallment:'Parcelado',installmentOriginId:'Série'};const describe=v=>v===null?'Registro ausente':typeof v==='number'?money(v):typeof v==='object'?Object.entries(v).filter(([k])=>k!=='id').map(([k,x])=>(labels[k]??k)+': '+(typeof x==='boolean'?(x?'Sim':'Não'):['amount','installmentValue','totalAmount'].includes(k)?money(x):String(x??'—'))).join(' · '):String(v);for(const f of data.fields){const row=add('div','');row.className='border border-slate-700 rounded-lg p-2 space-y-1';const [month,kind]=f.path.split(' · '),record=f.local??f.target??f.before;add('p',month+' · '+(record?.title??record?.description??labels[kind]??kind),row).className='font-semibold';add('p','Original: '+describe(f.before),row).className='text-slate-400';add('p','Neste dispositivo: '+describe(f.local),row);add('p','Na nuvem: '+describe(f.target),row);const choice=doc.createElement('select');choice.className='w-full bg-slate-900 rounded p-2';choice.dataset.conflictPath=f.path;for(const [v,label] of [['','Escolha a versão'],['local','Preservar neste dispositivo'],['target','Preservar da nuvem']]){const o=doc.createElement('option');o.value=v;o.textContent=label;choice.appendChild(o);}row.appendChild(choice);}for(const b of data.blocked)add('p','Revisão especializada necessária: '+b).className='text-amber-300';}
 async function details(){if(!session)return;try{const cp=await session.checkpoint();bound=!!cp;review=session.review();applyFingerprint=cp?.base&&cp?.apply&&!review?JSON.stringify(cp.apply):null;if(!applyFingerprint&&applyReview)clearApply();invalid=false;renderConflictReview();const b=session.budget();if(el('productionCloudBudget'))el('productionCloudBudget').textContent='Reserva local: '+(b?.reads??0)+'/'+LIMITS.reads+' leituras; '+(b?.writes??0)+'/'+LIMITS.writes+' escritas. Não é faturamento.';const m=session.metrics();if(el('productionCloudMetrics'))el('productionCloudMetrics').textContent='Chamadas nesta sessão (concluídas/tentadas): consultas '+m.read.completed+'/'+m.read.attempted+'; confirmações '+m.confirm.completed+'/'+m.confirm.attempted+'; envios '+m.send.completed+'/'+m.send.attempted+'; reservas de escuta '+m.listener.completed+'/'+m.listener.attempted+'. Não são contagens faturadas pelo Firebase.';if(syncStorage.getItem(RECOVERY_KEY)!==null)invalid=true;}catch{invalid=true;try{session.pause();}catch{}say('Metadados indisponíveis. Sincronização bloqueada; preserve os dados.');}}
 const action=async fn=>{if(busy||session?.state().busy||!unlocked())return;busy=true;paint();try{await fn();}catch(e){error(e);}finally{busy=false;await details();paint();runtime?.changed();if(unifiedLogin&&uid&&canSync&&ready()&&online()){void finishExplicitLogin();}}};
 function stop(preserve=false){clearApply();stopWatch();clearWatchRetry();watchFailed=false;watchTerminal=false;watchFailures=0;recovering=false;runtime?.close();runtime=null;if(session)try{preserve?session.suspend():session.sessionChanged();}catch{}session=null;plan=null;bound=false;review=null;invalid=false;writeAllowed=false;}
 function makeSession(who,g){
  const current=()=>g===generation&&uid===who&&ready()&&premium();
  const s=createProductionSyncSession({config,location:win.location,search,cloud,storage:syncStorage,uid:who,hash:payloadHash,id:()=>win.crypto.randomUUID(),local:{read:()=>storage.getItem(dbKey),apply:(raw,payload)=>current()&&win.productionV2ApplyLocal?.(raw,payload)===true},unlocked:current,online,visible:()=>doc.visibilityState!=='hidden',lock:(key,fn)=>withQueueLock('main_b2_'+key,fn,win.navigator?.locks)});
  runtime=createEventRuntime({session:{state:()=>{const state=s.state();return {...state,active:state.active||bound&&state.persisted==='active'&&!state.budgetWaiting};},tick:async opts=>{try{syncing=true;paint();
  if(!s.state().active){await authorizeWrite();if(g!==generation||!await s.restoreActive())return {status:'paused'};}
  const r=await s.tick(opts);if(g===generation){result(r);if(r.status==='updated'||r.status==='synced'&&s.hasLocalChanges())runtime?.signal();}return r;}finally{syncing=false;await details();paint();}},pause:s.pause,sessionChanged:s.sessionChanged},environment:()=>({visible:doc.visibilityState!=='hidden',online:win.navigator?.onLine!==false,unlocked:current()&&!busy&&!review&&!invalid,bound}),delay:1000,eventOnly:true,onRenew:async()=>{if(g!==generation||!current()||!bound||review||invalid||!online()||!s.state().budgetWaiting||s.state().budgetDay>=new Date().toISOString().slice(0,10))return false;await authorizeWrite();if(g!==generation||!current())return false;const ok=await s.restoreActive();if(ok){attention=false;watchFailed=false;}await details();paint();return ok;},setTimer:(fn,ms)=>win.setTimeout(fn,ms),clearTimer:id=>win.clearTimeout(id),onError:failure=>{if(g===generation){reportFailure(failure);paint();}}});
  return s;
 }
 function requireSession(){if(!canSync||!session||!ready()||invalid)throw Error('PRODUCTION_TRANSFER_DISABLED');return session;}
 async function authorizeWrite(){const who=uid,g=generation;const a=await cloud.approved(who,{write:true});if(g!==generation||uid!==who||!ready()||a?.writeEnabled!==true)throw Error('PRODUCTION_WRITE_NOT_APPROVED');writeAllowed=true;}
 function download(name,data){const url=win.URL.createObjectURL(new win.Blob([JSON.stringify(data,null,2)],{type:'application/json'}));const a=doc.createElement('a');a.href=url;a.download=name;a.click();win.setTimeout(()=>win.URL.revokeObjectURL(url),1000);}
 function checked(id){return el(id)?.checked===true;}
 function reset(...ids){for(const id of ids){if(el(id))el(id).checked=false;}}
 async function finishExplicitLogin(){
  if(!premium()||!unifiedLogin||busy||restoring||!uid||!session||!ready()||!online())return;
  unifiedLogin=false;
  return action(async()=>{const s=requireSession(),g=generation,who=uid;await details();if(g!==generation||who!==uid||invalid||review)return;
   if(!bound)return;
   await authorizeWrite();if(g!==generation||who!==uid||!ready())return;
   if(!s.state().active){if(s.state().persisted==='active')await s.restoreActive();else await s.resume(true);}
   if(g!==generation||who!==uid||!ready()||!s.state().active)return;
   syncStorage.setItem(CONNECTION_KEY,who);attention=false;syncing=true;paint();try{const r=await s.tick({manual:true});if(g===generation)result(r);}finally{syncing=false;}
   if(s.hasLocalChanges())runtime?.signal();
  });
 }
 async function restore(){
  if(!premium()||restoring||busy||!canSync||!ready()||!online()||doc.visibilityState==='hidden'||!uid||!session||connection()!==uid)return;
  const s=session,g=generation;restoring=true;busy=true;paint();
  try{await details();if(g!==generation||!bound||invalid||review)return;if(s.state().budgetWaiting&&s.state().budgetDay===new Date().toISOString().slice(0,10))return;if(s.state().persisted!=='active'&&writeAllowed)return;await authorizeWrite();if(g!==generation)return;
   if(!s.state().active&&s.state().persisted==='active')await s.restoreActive();
   if(g===generation&&s.state().active){syncing=true;paint();try{const r=await s.tick({manual:true});if(g===generation){result(r);if(r.status==='updated'||r.status!=='empty'&&s.hasLocalChanges())runtime?.signal();}}finally{syncing=false;}}
  }catch(e){if(g===generation)error(e);}finally{restoring=false;busy=false;await details();paint();runtime?.changed();}
 }
 async function connectCloud(){if(cloud||!config.enabled)return;cloud=await open();cloud.onSession(user=>{
  const previous=uid;generation++;stop(!previous||previous===user?.uid);uid=user?.uid??null;profile=user??null;reviewExpanded=false;attention=false;verifiedSync=false;storageChanged=false;
  displayedReview=null;displayedConflict=null;if(historyBox)historyBox.textContent='';if(reviewBox)reviewBox.textContent='';if(planBox)planBox.textContent='';
  reset('productionCloudConsent','productionCloudBackupSaved','productionCloudReviewConsent','productionCloudReviewBackup');
  if(uid){if(canSync&&premium())try{session=makeSession(uid,generation);}catch(e){error(e);paint();return;}
   say(premium()?'Conta Google conectada. Se este dispositivo ainda não estiver vinculado, selecione Revisar vínculo com Firestore.':'Conta Google conectada. Os dados deste plano ficam neste dispositivo.');
  }else say('Entre com a conta Google desejada.');
  void details().then(()=>{paint();win.setTimeout(()=>{if(!canSync||!uid||!ready()||!online()||busy)return;if(!premium())return;if(bound&&connection()===uid)void restore();},0);});
 });}
 connect.addEventListener('click',()=>action(connectCloud));
 const photo=el('productionCloudPhoto');photo?.addEventListener('error',()=>{photo.hidden=true;const initial=el('productionCloudInitial');if(initial){initial.hidden=false;initial.classList.add('flex');}});
 el('productionCloudGoogle')?.addEventListener('click',()=>{if(!premium()||!canSync||!ready()||!online())return;unifiedLogin=true;void action(async()=>{try{await connectCloud();if(!cloud.currentUid())throw Error('SESSION_REQUIRED');}catch(e){unifiedLogin=false;throw e;}});});

 applyOpen?.addEventListener('click',()=>action(async()=>{const s=requireSession();clearApply();await authorizeWrite();const p=await s.inspectApply();applyReview=p;applyFields.textContent='';for(const f of p.fields){const row=doc.createElement('label');row.className='block text-xs space-y-1';const title=doc.createElement('p');const record=f.local??f.target??f.before;const isRecord=record&&typeof record==='object';const month=f.path.split(' · ')[0];title.textContent=month+' · '+(isRecord?(record.title??record.description??'Lançamento'):(f.path.includes('budgetLimit')?'Limite do orçamento':'Salário'));title.className='font-semibold text-sm';row.appendChild(title);
 const fmt=(v,k)=>v==null?'Ausente':typeof v==='boolean'?(v?'Sim':'Não'):typeof v==='number'&&['amount','salary','budgetLimit','installmentValue','totalAmount'].includes(k)?new Intl.NumberFormat('pt-BR',{style:'currency',currency:'BRL'}).format(v):k==='date'?String(v).split('-').reverse().join('/'):String(v);
 const labels={title:'Nome',description:'Descrição',category:'Categoria',amount:'Valor',type:'Tipo',date:'Data',paid:'Pago',installmentValue:'Valor da parcela',totalAmount:'Valor total',installments:'Parcelas',currentInstallment:'Parcela atual',isInstallment:'Parcelado',installmentOriginId:'Série da parcela'};
 const cats={moradia:'Moradia e contas',alimentacao:'Alimentação',transporte:'Transporte',compras:'Compras',lazer:'Lazer',saude:'Saúde',investimentos:'Investimentos',outros:'Outros gastos'};
 const display=(v,k)=>k==='category'?(cats[v]??fmt(v,k)):k==='type'?(v==='fixed'?'Fixa':v==='one-time'?'Avulsa':fmt(v,k)):fmt(v,k);
 const keys=isRecord?[...new Set([...Object.keys(f.local??{}),...Object.keys(f.target??{})])].filter(k=>k!=='id'&&f.local?.[k]!==f.target?.[k]):[f.path.includes('budgetLimit')?'budgetLimit':'salary'];
 if(isRecord){const meta=doc.createElement('p');meta.className='text-slate-400';meta.textContent=[cats[record.category],record.date?fmt(record.date,'date'):null].filter(Boolean).join(' · ');row.appendChild(meta);}
 const describe=v=>v==null?'Registro ausente':keys.map(k=>(labels[k]??'Valor')+': '+display(isRecord?v[k]:v,k)).join(' · ');
 const select=doc.createElement('select');select.className='w-full bg-slate-900 rounded p-2 text-sm';select.dataset.path=f.path;for(const [v,t] of [['','Escolha qual versão preservar'],['local','Celular: '+describe(f.local)],['target','Atualização pendente: '+describe(f.target)]]){const o=doc.createElement('option');o.value=v;o.textContent=t;select.appendChild(o);}
 for(const [label,value] of [['Celular',f.local],['Atualização pendente',f.target]]){const line=doc.createElement('p');line.className='text-amber-300 text-sm whitespace-normal break-words';line.textContent=label+' — '+describe(value);row.appendChild(line);}row.appendChild(select);applyFields.appendChild(row);}for(const reason of p.blocked){const line=doc.createElement('p');line.textContent='Revisão especializada necessária: '+reason;applyFields.appendChild(line);}say('Revise os conflitos da operação pendente.');}));
 el('productionCloudApplyExport')?.addEventListener('click',()=>action(async()=>{if(!applyReview)return;download('raytech-revisao-pendente.json',applyReview);}));
 applyResolve?.addEventListener('click',()=>action(async()=>{const s=requireSession();if(!applyReview||!applyConfirm.checked||!applyBackup.checked)return;const choices=Object.fromEntries([...applyFields.querySelectorAll('select')].map(x=>[x.dataset.path,x.value]));if(Object.values(choices).some(x=>!x))throw Error('PRODUCTION_RECOVERY_CHOICE');await authorizeWrite();try{await s.resolveApply({choices,confirmed:true,backupSaved:true});}finally{clearApply();}attention=false;runtime?.retry();say('Recuperação validada. Retomando sincronização.');}));
 reviewOpen?.addEventListener('click',()=>{reviewExpanded=true;paint();});
 manualSync?.addEventListener('click',()=>{if(!manualSync.disabled&&session?.state().active)runtime?.retry();});
 retry?.addEventListener('click',()=>{if(!uid||review||invalid||busy||session?.state().busy)return;clearWatchRetry();watchFailed=false;watchTerminal=false;if(session?.state().active){runtime?.retry();return;}unifiedLogin=true;void finishExplicitLogin();});
 login.addEventListener('click',()=>action(async()=>{if(!cloud||uid)return;throw Error('SESSION_REQUIRED');}));
 async function inspectAccount(){if(!cloud||!uid)return;const who=uid,g=generation;if(!canSync){const remote=await cloud.read(who);if(g!==generation||who!==uid||!unlocked())return;say('UID: '+who+(remote?' • Nuvem existente, revisão '+remote.head.revision:' • Conta autorizada; nuvem vazia.'));return;}const s=requireSession();writeAllowed=false;await authorizeWrite();plan=null;if(planBox)planBox.replaceChildren();if(await s.checkpoint()){say('Conta autorizada para escrita. Retomada exige confirmação explícita.');return;}const r=await s.inspect();if(g!==generation||who!==uid)return;plan=r;reset('productionCloudConsent','productionCloudBackupSaved');if(planBox){
  const describe=(label,data)=>{const p=doc.createElement('p');p.textContent=data?
  label+' · '+data.months+' mês(es), '+data.entries+' lançamento(s)'+(data.empty?' · sem dados financeiros':'')+(data.revision?' · revisão '+data.revision:''):
  label+' · sem dados financeiros';return p;};
  planBox.replaceChildren(describe('Neste dispositivo',r.local),describe('Na nuvem',r.remote));
 }
 say(r.conflict?'Há informações incompatíveis. Exporte as duas cópias e revise as diferenças antes de tentar novamente.':r.mode==='seed'?'A nuvem está sem dados financeiros. Confirme o envio deste dispositivo.':r.mode==='adopt'?'Este dispositivo está sem dados financeiros. Confirme o recebimento da nuvem.':'As duas cópias têm dados. Confirme a união dos lançamentos compatíveis.');}
 inspect.addEventListener('click',()=>{if(premium()&&!inspect.disabled)void action(inspectAccount);});
 function link(mode){return action(async()=>{const s=requireSession();if(plan?.mode!==mode||!checked('productionCloudConsent')||!checked('productionCloudBackupSaved'))throw Error('PRODUCTION_CONSENT');await authorizeWrite();await s.authorize({mode,confirmed:true,backupSaved:true});syncStorage.setItem(CONNECTION_KEY,uid);plan=null;reset('productionCloudConsent','productionCloudBackupSaved');if(planBox)planBox.textContent='';say('Vínculo confirmado. Sincronização automática ativa.');await details();const outcome=await s.tick({manual:true});result(outcome);if(outcome.status==='updated'||outcome.status!=='empty'&&s.hasLocalChanges())runtime?.signal();});}
 seed.addEventListener('click',()=>link('seed'));adopt?.addEventListener('click',()=>link(plan?.mode));
 refresh?.addEventListener('click',()=>{if(!canSync)return;void action(async()=>{const s=requireSession();if(!writeAllowed||!s.state().active)throw Error('PRODUCTION_PAUSED');syncing=true;paint();try{const r=await s.tick({manual:true});result(r);}finally{syncing=false;}});});
 pauseBtn?.addEventListener('click',()=>{if(canSync&&session){try{runtime.pause();say('Sincronização pausada.');paint();}catch(e){error(e);}}});
 resumeBtn?.addEventListener('click',()=>action(async()=>{const s=requireSession();if(!confirm('Retomar explicitamente a sincronização do banco V2 principal?'))return;await authorizeWrite();await s.resume(true);syncStorage.setItem(CONNECTION_KEY,uid);runtime?.retry();say('Sincronização retomada.');}));
 backupBtn?.addEventListener('click',()=>action(async()=>{download('raytech-backup-principal.json',requireSession().exportLocal());say('Backup exportado; guarde o arquivo antes de confirmar.');}));
 el('productionCloudRemoteBackup')?.addEventListener('click',()=>{if(plan?.remoteBackup)download('raytech-backup-nuvem.json',plan.remoteBackup);});
 stageBtn?.addEventListener('click',()=>action(async()=>{const s=requireSession();const file=el('productionCloudBackupFile')?.files?.[0];if(!file||!file.name.toLowerCase().endsWith('.json')||file.size>2000000)throw Error('PRODUCTION_BACKUP_FILE');await s.stageRestore(decodeJsonFile(await file.text()));reset('productionCloudReviewConsent','productionCloudReviewBackup');el('productionCloudChoice').value='';say('Backup em revisão; nenhum dado aplicado.');}));
 updateBtn?.addEventListener('click',()=>action(async()=>{const s=requireSession();if(!confirm('Preservar a revisão anterior e consultar a atual?'))return;await s.refreshReview(true);reset('productionCloudReviewConsent','productionCloudReviewBackup');el('productionCloudChoice').value='';say('Revisão atualizada; confirme novamente.');}));
 reviewBtn?.addEventListener('click',()=>action(async()=>{const s=requireSession();await authorizeWrite();const individual=review?.kind==='conflict';const choices=individual?Object.fromEntries([...reviewBox.querySelectorAll('select[data-conflict-path]')].map(e=>[e.dataset.conflictPath,e.value])):undefined;await s.resolve({choice:individual?'individual':el('productionCloudChoice')?.value,choices,expectedReview:displayedReview?.snapshot,confirmed:checked('productionCloudReviewConsent'),backupSaved:checked('productionCloudReviewBackup')});reset('productionCloudReviewConsent','productionCloudReviewBackup');el('productionCloudChoice').value='';if(individual){await s.resume(true);attention=false;verifiedSync=false;runtime?.retry();say('Decisão aplicada. Retomando sincronização.');}else say('Decisão aplicada localmente. Sincronização pausada.');}));
 historyBtn?.addEventListener('click',()=>action(async()=>{const s=requireSession();if(historyBox)historyBox.textContent=JSON.stringify(s.history(),null,2);}));
 el('productionCloudExportReview')?.addEventListener('click',()=>action(async()=>{const s=requireSession();download('raytech-versoes-em-revisao.json',s.review());}));
 historyExport?.addEventListener('click',()=>action(async()=>{const s=requireSession();download('raytech-revisoes.json',{current:s.review(),history:s.history(),recovery:s.recoveryHistory()});}));
 diagnosticBtn?.addEventListener('click',()=>action(async()=>{download('raytech-diagnostico-local.json',requireSession().recoveryExport());}));
 logout.addEventListener('click',()=>action(async()=>{if(!uid)return;unifiedLogin=false;syncStorage.setItem(CONNECTION_KEY,'signed-out');generation++;stop();await cloud.signOut();}));
 if(win&&canSync){
  // Normal import uses the reviewed session, never a direct replacement of a linked bank.
  win.productionPrepareBackupRestore=backup=>{
   const checkReady=()=>{
    if(!session||!uid||!bound||!writeAllowed||invalid||review||!ready()||!online()||doc.visibilityState==='hidden'||busy||session.state().busy||!session.state().active)throw Error('Banco vinculado. Aguarde a sincronização ativa e sem pendências; tente novamente.');
   };
   checkReady();
   const s=session,g=generation,who=uid,expected=storage.getItem(dbKey),checkpoint=syncStorage.getItem(DEVICE_KEY);
   return async()=>{
    checkReady();
    if(s!==session||g!==generation||who!==uid||expected!==storage.getItem(dbKey)||checkpoint!==syncStorage.getItem(DEVICE_KEY))throw Error('Os dados ou a conta mudaram desde a confirmação. Importe novamente.');
    busy=true;verifiedSync=false;stopWatch();paint();runtime?.changed();
    let applied=false,paused=false;
    try{
     await authorizeWrite();
     if(s!==session||g!==generation||who!==uid||!ready()||expected!==storage.getItem(dbKey)||checkpoint!==syncStorage.getItem(DEVICE_KEY))throw Error('Os dados mudaram. Importe novamente.');
     s.pause();paused=true;
     await s.stageRestore(backup);
     if(s!==session||g!==generation||who!==uid||!ready()||s.review()?.local!==expected||storage.getItem(dbKey)!==expected)throw Error('Alteração simultânea detectada. Dados preservados; revise a pendência de restauração.');
     // resolve archives the reviewed local/remote/target snapshot durably before applying.
     if(doc.activeElement?.id==='jsonImportInput'||doc.activeElement?.id==='excelImportInput')doc.activeElement.blur();
     await s.resolve({choice:'restore',confirmed:true,backupSaved:true});applied=true;
     await s.resume(true);paused=false;
     syncing=true;paint();
     const r=await s.tick({manual:true});result(r);
     // An updated/merged result has not necessarily been sent yet.
     if(r.status!=='synced')runtime?.signal();
     return {synced:r.status==='synced'};
    }catch(e){
     if(s===session&&g===generation&&who===uid){
      if(paused&&!applied){try{const cp=await s.checkpoint();if(!s.review()&&!cp?.apply&&!cp?.pending&&ready()&&online())await s.resume(true);}catch{}}
      error(e);
     }
     if(applied)return {synced:false};
     throw Error('Não foi possível concluir com segurança. Dados e cópias de recuperação preservados. Verifique a conexão e possíveis pendências ('+String(e.code??e.message)+').');
    }finally{syncing=false;busy=false;await details();paint();runtime?.changed();}
   };
  };
  win.addEventListener('raytech-finance-saved',()=>{try{if(session&&!session.hasLocalChanges())return;}catch{}verifiedSync=false;runtime?.signal({local:true});paint();});
  const lifecycle=()=>{runtime?.changed();paint();if(!online()||!ready()||doc.visibilityState==='hidden')return;if(!cloud&&(connection()||win.raytechStorage)&&!busy)void action(connectCloud);else if(!premium())return;else if(unifiedLogin&&bound){void finishExplicitLogin();}else if(session?.state().active){runtime?.signal();}else if(!session?.state().budgetWaiting)void restore();};
  win.addEventListener('raytech-plan-changed',()=>{generation++;stop(true);attention=false;verifiedSync=false;if(uid&&premium()&&canSync){session=makeSession(uid,generation);unifiedLogin=connection()===uid;}paint();if(premium())void details().then(()=>{if(unifiedLogin)void finishExplicitLogin();});});
  win.addEventListener('online',()=>{
    verifiedSync=false;clearWatchRetry();
    if(!watchTerminal){watchFailed=false;watchFailures=0;}
    runtime?.reconnect();lifecycle();
  });
  win.addEventListener('raytech-online-verified',lifecycle);
  win.addEventListener('offline',()=>{
    verifiedSync=false;stopWatch();clearWatchRetry();reportFailure({kind:'offline'});lifecycle();
  });doc.addEventListener?.('visibilitychange',lifecycle);
  win.addEventListener('storage',e=>{if(e.key===dbKey||e.key===syncPrefix(search)+DEVICE_KEY||e.key===syncPrefix(search)+REVIEW_KEY){storageChanged=true;stop();say('Alteração em outra aba. Feche as outras abas e reabra; sincronização bloqueada.');paint();}});
  win.addEventListener('pagehide',()=>{generation++;stop(true);},{once:true});
  const observer=new win.MutationObserver(lifecycle);const pin=el('pinLockOverlay');if(pin)observer.observe(pin,{attributes:true,attributeFilter:['class']});
  const startup=()=>{if(!ready()){win.setTimeout(startup,500);return;}lifecycle();};win.setTimeout(startup,0);
 }
 say(config.enabled?(canSync?'Conecte-se para verificar sua conta.':'Login disponível para validação. Transferências financeiras desativadas.'):'Nuvem V2 aguardando liberação. Nenhuma conexão foi iniciada.');paint();
}
if(typeof document!=='undefined')bindCloudPanel(document,(globalThis.raytechStorage??globalThis.localStorage));
