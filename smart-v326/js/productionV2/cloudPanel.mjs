import {PRODUCTION_CONFIG} from './config.mjs';
import {databaseKey,scopeSyncStorage,canTransfer,syncPrefix} from './cleanWorkspace.mjs';
import {createProductionSyncSession,LIMITS,RECOVERY_KEY,REVIEW_KEY} from '../experimentalSync/session.mjs';
import {DEVICE_KEY} from '../experimentalSync/engine.mjs';
import {createEventRuntime} from './eventRuntime.mjs';
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
 if(advanced)advanced.hidden=!maintenance;status.hidden=!maintenance;
 const reviewDetails=el('productionCloudReviewDetails'),reviewHome=reviewDetails?.parentElement,reviewOpen=el('productionCloudReviewOpen'),retry=el('productionCloudRetry'),manualSync=el('productionCloudSyncNow');
 const connection=()=>{const stored=syncStorage.getItem(CONNECTION_KEY);if(stored!==null)return stored==='signed-out'?null:stored;try{const p=JSON.parse(syncStorage.getItem('experimental-sync-policy-v1')),c=JSON.parse(syncStorage.getItem(DEVICE_KEY));return p?.uid&&p.uid===c?.uid&&['active','paused'].includes(p.state)?p.uid:null;}catch{return null;}};
 const online=()=>win?.navigator?.onLine!==false;
 let unsubscribe=null,watchGeneration=0,watchStarting=false,watchFailed=false,watchRevision=null,unifiedLogin=false,reviewExpanded=false,profile=null,syncing=false,attention=false,verifiedSync=false,restoring=false,cloud=null,uid=null,busy=false,generation=0,session=null,runtime=null,plan=null,bound=false,review=null,invalid=false,writeAllowed=false,storageChanged=false;
 const unlocked=()=>!el('pinLockOverlay')||el('pinLockOverlay').classList.contains('hidden');
 const ready=()=>!storageChanged&&win?.productionCleanWorkspaceReady===true&&unlocked();
 const say=message=>{status.textContent=message;};
 const result=r=>{verifiedSync=['synced','updated'].includes(r.status);attention=r.status==='conflict';const labels={synced:'Sincronizado',updated:'Sincronizado',paused:'Pausado',offline:'Sem internet',conflict:'Conflito: revisão necessária',idle:'Aguardando',throttled:'Aguardando próxima consulta'};if(['synced','updated'].includes(r.status)&&uid){try{syncStorage.setItem(LAST_KEY,JSON.stringify({uid,at:new Date().toISOString()}));}catch{}}say('Nuvem V2 · '+(labels[r.status]??r.status)+(r.revision?' · revisão '+r.revision:''));};
 const error=e=>{if(e?.message==='EXPERIMENTAL_BUDGET_EXHAUSTED'){attention=false;verifiedSync=false;say('Reserva diária esgotada. Dados locais preservados.');return;}attention=true;verifiedSync=false;const code=String(e?.code??e?.message??'PRODUCTION_UNAVAILABLE');say('Operação não concluída ('+(/^[A-Z0-9_/-]+$/i.test(code)?code:'PRODUCTION_UNAVAILABLE')+'). Dados e pendências preservados.');};
 const disable=(e,v)=>{if(e)e.disabled=!!v;};
 function stopWatch(){watchGeneration++;watchStarting=false;watchRevision=null;unsubscribe?.();unsubscribe=null;}
 function watchState(){const allowed=canSync&&uid&&session&&bound&&writeAllowed&&!review&&!invalid&&ready()&&online()&&doc.visibilityState!=='hidden'&&session.state().active;if(!allowed){if(unsubscribe||watchStarting)stopWatch();return;}if(unsubscribe||watchStarting||watchFailed||!cloud?.watchHead||busy||restoring||syncing||session.state().busy)return;watchStarting=true;const token=++watchGeneration,who=uid;void session.reserveListener().then(ok=>{if(token!==watchGeneration||who!==uid)return;watchStarting=false;if(!ok){watchFailed=true;return;}unsubscribe=cloud.watchHead(who,revision=>{if(token!==watchGeneration||who!==uid)return;if(watchRevision===revision)return;watchRevision=revision;let base;try{base=JSON.parse(syncStorage.getItem(DEVICE_KEY))?.base?.head?.revision??0;}catch{return;}if(revision!==base){verifiedSync=false;runtime?.signal();}},()=>{if(token===watchGeneration){stopWatch();watchFailed=true;runtime?.changed();paint();}});}).catch(()=>{if(token===watchGeneration){stopWatch();watchFailed=true;runtime?.changed();paint();}});}
 function paint(){
  if(applyOpen){applyOpen.hidden=!canSync||!uid||!applyFingerprint||!!review||invalid;applyOpen.disabled=busy||!online()||!ready()||!!session?.state().active;}
  if(applyBox)applyBox.hidden=!applyReview||!uid||!ready();
  if(applyResolve)applyResolve.disabled=busy||!online()||!ready()||!applyReview||!!applyReview?.blocked?.length;
  connect.disabled=busy||!!cloud||!config.enabled;login.disabled=busy||!cloud||!!uid;inspect.disabled=busy||!uid;logout.disabled=busy||!uid;
  let st={active:false,busy:false};try{if(session)st=session.state();}catch{invalid=true;}
  const indicator=el('productionCloudConnection'),last=el('productionCloudLastSync');const waiting=!!st.budgetWaiting;const renewal=waiting?new Date(Date.parse(st.budgetDay+'T00:00:00Z')+86400000).toLocaleString('pt-BR'):'';
  if(indicator)indicator.textContent=!online()?'Sem internet — dados locais preservados':!unlocked()?'Bloqueado pelo PIN':!uid?'Desconectado':invalid||review?'Revisão necessária':st.active?'Conectado · automático':bound?'Conectado · pausado':'Conectado · aguardando vínculo';
  if(setupPanel)setupPanel.hidden=!canSync||bound||!plan;
  const transfers=el('productionCloudTransferActions');if(transfers)transfers.hidden=!canSync||bound||!plan;
  if(advanced&&review&&maintenance){advanced.open=true;if(reviewDetails)reviewDetails.open=true;}
  if(reviewDetails&&reviewHome&&!maintenance){if(review&&reviewExpanded){setupPanel?.after(reviewDetails);reviewDetails.open=true;}else if(reviewDetails.parentElement!==reviewHome){reviewHome.appendChild(reviewDetails);reviewDetails.open=false;}}
  if(reviewOpen)reviewOpen.hidden=maintenance||!review;
  if(manualSync){manualSync.hidden=!canSync||!uid||!bound||!st.active||!!review||invalid;manualSync.disabled=busy||st.busy||waiting||!online()||!ready()||!writeAllowed;}
  if(retry){retry.hidden=maintenance||!uid||!!review||invalid||(!attention&&(!bound||st.active));retry.disabled=busy||st.busy||waiting||!online()||!ready();}
  if(header&&canSync){
   const kind=!uid?'disconnected':!online()?'offline':invalid||review?'attention':waiting?'paused':attention?'attention':syncing||st.busy?'syncing':st.active&&verifiedSync?'synced':st.active?'online':'paused';

   const labels={disconnected:'Desconectado',offline:'Sem internet',attention:'Atenção necessária',syncing:'Sincronizando',synced:'Sincronizado',online:'Conectado',paused:'Pausado'};
   header.title='Nuvem: '+labels[kind];header.setAttribute('aria-label',header.title);header.dataset.syncState=kind;
   header.classList.remove('text-emerald-400','text-amber-400','text-slate-400','text-blue-400','text-red-400');
   header.classList.add(kind==='synced'||kind==='online'?'text-emerald-400':kind==='syncing'?'text-blue-400':kind==='attention'?'text-red-400':kind==='offline'||kind==='paused'?'text-amber-400':'text-slate-400');
   const glyph=header.querySelector('svg');if(glyph){for(const g of glyph.querySelectorAll('[data-cloud-glyph]'))g.style.display=g.dataset.cloudGlyph===kind?'':'none';glyph.classList.toggle('raytech-sync-spin',kind==='syncing');}
   const guest=el('productionCloudGuest'),person=el('productionCloudProfile'),google=el('productionCloudGoogle'),name=el('productionCloudName'),photo=el('productionCloudPhoto'),initial=el('productionCloudInitial'),notice=el('productionCloudNotice');
   if(guest)guest.hidden=!!uid;if(person){person.hidden=!uid;person.classList.toggle('flex',!!uid);}if(google)google.disabled=busy||!online()||!ready();
   if(name)name.textContent=profile?.displayName||profile?.email||'Conta Google';
   if(initial)initial.textContent=(profile?.displayName||profile?.email||'G').trim().slice(0,1).toUpperCase();
   if(photo){let url=null;try{const u=new URL(profile?.photoURL);if(u.protocol==='https:'&&/(^|\.)googleusercontent\.com$/.test(u.hostname))url=u.href;}catch{}if(url&&photo.getAttribute('src')!==url){photo.hidden=false;if(initial){initial.hidden=true;initial.classList.remove('flex');}photo.src=url;}else if(!url){photo.removeAttribute('src');photo.hidden=true;if(initial){initial.hidden=false;initial.classList.add('flex');}}}
   if(notice){notice.hidden=!review&&!attention&&!invalid&&!waiting;notice.textContent=waiting&&!review&&!invalid?'Reserva diária esgotada. Retomada automática a partir de '+renewal+'. Dados locais preservados.':review?'Existem alterações que precisam ser revisadas. Seus dados estão preservados.':invalid?'Sincronização protegida. Entre em contato com o suporte.':'Não foi possível sincronizar. Seus dados locais estão preservados.';}
   const view=el('productionCloudState');if(view)view.hidden=!uid;
   if(indicator&&kind==='synced')indicator.textContent='Sincronizado';
   if(indicator&&kind==='online')indicator.textContent='Conectado · automático';
   if(indicator&&kind==='syncing')indicator.textContent='Sincronizando…';
   if(indicator&&kind==='attention')indicator.textContent='Atenção necessária';if(indicator&&waiting&&!review&&!invalid)indicator.textContent='Reserva diária esgotada';
  }
  if(indicator&&canSync){indicator.classList.toggle('text-emerald-400',!!st.active&&online()&&!invalid&&!review&&!attention);indicator.classList.toggle('text-amber-400',!!uid&&(!st.active||!online()||invalid||!!review||attention));indicator.classList.toggle('text-slate-400',!uid);}
  if(last){try{const x=JSON.parse(syncStorage.getItem(LAST_KEY));last.textContent=x?.uid===uid?'Última sincronização: '+new Date(x.at).toLocaleString('pt-BR'):'Última sincronização: —';}catch{last.textContent='Última sincronização: —';}}
  const blocked=busy||!canSync||!session||invalid||!ready()||st.busy;
  seed.disabled=blocked||bound||plan?.mode!=='seed'||!writeAllowed;disable(adopt,blocked||bound||plan?.mode!=='adopt'||!writeAllowed);
  disable(refresh,blocked||!bound||!st.active||!!review||!writeAllowed);
  if(canSync){connect.hidden=!!cloud;login.hidden=!!uid||!cloud;inspect.hidden=bound&&writeAllowed;seed.hidden=bound||plan?.mode!=='seed';if(adopt)adopt.hidden=bound||plan?.mode!=='adopt';if(refresh)refresh.hidden=!bound;logout.hidden=!uid;}else {const p=el('productionCloudProfile');if(p)p.hidden=!uid;const state=el('productionCloudState');if(state)state.hidden=true;}
disable(pauseBtn,!canSync||!session||(!st.active&&!waiting));disable(resumeBtn,blocked||!bound||st.active||waiting||!!review||!writeAllowed);
  disable(backupBtn,blocked);disable(stageBtn,blocked||!bound||st.active||!!review||!writeAllowed);disable(reviewBtn,blocked||st.active||!review||!writeAllowed);disable(updateBtn,blocked||st.active||!review||!writeAllowed);
  for(const e of [historyBtn,historyExport,diagnosticBtn])disable(e,blocked);
  if(canSync)try{watchState();}catch{stopWatch();}
 }
 async function details(){if(!session)return;try{const cp=await session.checkpoint();bound=!!cp;review=session.review();applyFingerprint=cp?.base&&cp?.apply&&!review?JSON.stringify(cp.apply):null;if(!applyFingerprint&&applyReview)clearApply();invalid=false;if(reviewBox)reviewBox.textContent=review?JSON.stringify(review,null,2):'Nenhuma revisão pendente.';const b=session.budget();if(el('productionCloudBudget'))el('productionCloudBudget').textContent='Reserva local: '+(b?.reads??0)+'/'+LIMITS.reads+' leituras; '+(b?.writes??0)+'/'+LIMITS.writes+' escritas. Não é faturamento.';const m=session.metrics();if(el('productionCloudMetrics'))el('productionCloudMetrics').textContent='Chamadas nesta sessão (concluídas/tentadas): consultas '+m.read.completed+'/'+m.read.attempted+'; confirmações '+m.confirm.completed+'/'+m.confirm.attempted+'; envios '+m.send.completed+'/'+m.send.attempted+'; reservas de escuta '+m.listener.completed+'/'+m.listener.attempted+'. Não são contagens faturadas pelo Firebase.';if(syncStorage.getItem(RECOVERY_KEY)!==null)invalid=true;}catch{invalid=true;try{session.pause();}catch{}say('Metadados indisponíveis. Sincronização bloqueada; preserve os dados.');}}
 const action=async fn=>{if(busy||session?.state().busy||!unlocked())return;busy=true;paint();try{await fn();}catch(e){error(e);}finally{busy=false;await details();paint();runtime?.changed();if(unifiedLogin&&uid&&canSync&&ready()&&online()){void finishExplicitLogin();}}};
 function stop(preserve=false){clearApply();stopWatch();watchFailed=false;runtime?.close();runtime=null;if(session)try{preserve?session.suspend():session.sessionChanged();}catch{}session=null;plan=null;bound=false;review=null;invalid=false;writeAllowed=false;}
 function makeSession(who,g){
  const current=()=>g===generation&&uid===who&&ready();
  const s=createProductionSyncSession({config,location:win.location,search,cloud,storage:syncStorage,uid:who,hash:payloadHash,id:()=>win.crypto.randomUUID(),local:{read:()=>storage.getItem(dbKey),apply:(raw,payload)=>current()&&win.productionV2ApplyLocal?.(raw,payload)===true},unlocked:current,online:()=>win?.navigator?.onLine!==false,visible:()=>doc.visibilityState!=='hidden',lock:(key,fn)=>withQueueLock('hml_smart326_main_b2_'+key,fn,win.navigator?.locks)});
  runtime=createEventRuntime({session:{state:s.state,tick:async opts=>{try{syncing=true;paint();const r=await s.tick(opts);if(g===generation){result(r);if(['updated','synced'].includes(r.status)&&s.hasLocalChanges())runtime?.signal();}return r;}finally{syncing=false;await details();paint();}},pause:s.pause,sessionChanged:s.sessionChanged},environment:()=>({visible:doc.visibilityState!=='hidden',online:win.navigator?.onLine!==false,unlocked:current()&&!busy&&!review&&!invalid,bound}),eventOnly:true,onRenew:async()=>{if(g!==generation||!current()||!bound||review||invalid||!online()||!s.state().budgetWaiting||s.state().budgetDay>=new Date().toISOString().slice(0,10))return false;await authorizeWrite();if(g!==generation||!current())return false;const ok=await s.restoreActive();if(ok){attention=false;watchFailed=false;}await details();paint();return ok;},setTimer:(fn,ms)=>win.setTimeout(fn,ms),clearTimer:id=>win.clearTimeout(id),onError:code=>{if(g!==generation)return;if(code==='EXPERIMENTAL_BUDGET_EXHAUSTED'){attention=false;verifiedSync=false;paint();return;}attention=true;verifiedSync=false;say('Consulta automática interrompida ('+code+'). Dados preservados.');paint();}});
  return s;
 }
 function requireSession(){if(!canSync||!session||!ready()||invalid)throw Error('PRODUCTION_TRANSFER_DISABLED');return session;}
 async function authorizeWrite(){const who=uid,g=generation;const a=await cloud.approved(who,{write:true});if(g!==generation||uid!==who||!ready()||a?.writeEnabled!==true)throw Error('PRODUCTION_WRITE_NOT_APPROVED');writeAllowed=true;}
 function download(name,data){const url=win.URL.createObjectURL(new win.Blob([JSON.stringify(data,null,2)],{type:'application/json'}));const a=doc.createElement('a');a.href=url;a.download=name;a.click();win.setTimeout(()=>win.URL.revokeObjectURL(url),1000);}
 function checked(id){return el(id)?.checked===true;}
 function reset(...ids){for(const id of ids){if(el(id))el(id).checked=false;}}
 async function finishExplicitLogin(){
  if(!unifiedLogin||busy||restoring||!uid||!session||!ready()||!online())return;
  unifiedLogin=false;
  return action(async()=>{const s=requireSession(),g=generation,who=uid;await details();if(g!==generation||who!==uid||invalid||review)return;
   if(!bound){await inspectAccount();return;}
   await authorizeWrite();if(g!==generation||who!==uid||!ready())return;
   if(!s.state().active){if(s.state().persisted==='active')await s.restoreActive();else await s.resume(true);}
   if(g!==generation||who!==uid||!ready()||!s.state().active)return;
   syncStorage.setItem(CONNECTION_KEY,who);attention=false;syncing=true;paint();try{const r=await s.tick({manual:true});if(g===generation)result(r);}finally{syncing=false;}
   if(s.hasLocalChanges())runtime?.signal();
  });
 }
 async function restore(){
  if(restoring||busy||!canSync||!ready()||!online()||doc.visibilityState==='hidden'||!uid||!session||connection()!==uid)return;
  const s=session,g=generation;restoring=true;busy=true;paint();
  try{await details();if(g!==generation||!bound||invalid||review)return;if(s.state().budgetWaiting&&s.state().budgetDay===new Date().toISOString().slice(0,10))return;if(s.state().persisted!=='active'&&writeAllowed)return;await authorizeWrite();if(g!==generation)return;
   if(!s.state().active&&s.state().persisted==='active')await s.restoreActive();
   if(g===generation&&s.state().active){syncing=true;paint();try{const r=await s.tick({manual:true});if(g===generation){result(r);if(s.hasLocalChanges())runtime?.signal();}}finally{syncing=false;}}
  }catch(e){if(g===generation)error(e);}finally{restoring=false;busy=false;await details();paint();runtime?.changed();}
 }
 async function connectCloud(){if(cloud||!config.enabled)return;cloud=await open();cloud.onSession(user=>{
  const previous=uid;generation++;stop(!previous||previous===user?.uid);uid=user?.uid??null;profile=user??null;reviewExpanded=false;attention=false;verifiedSync=false;storageChanged=false;
  if(historyBox)historyBox.textContent='';if(reviewBox)reviewBox.textContent='';if(planBox)planBox.textContent='';
  reset('productionCloudConsent','productionCloudBackupSaved','productionCloudReviewConsent','productionCloudReviewBackup');
  if(uid){if(canSync)try{session=makeSession(uid,generation);}catch(e){error(e);paint();return;}say('Conta Google conectada. Verifique a autorização da conta.');}else say('Entre com a conta Google desejada.');
  void details().then(()=>{paint();win.setTimeout(()=>{if(!canSync||!uid||!ready()||!online()||busy)return;if(unifiedLogin)void finishExplicitLogin();else if(connection()===uid)void restore();},0);});
 });}
 connect.addEventListener('click',()=>action(connectCloud));
 const photo=el('productionCloudPhoto');photo?.addEventListener('error',()=>{photo.hidden=true;const initial=el('productionCloudInitial');if(initial){initial.hidden=false;initial.classList.add('flex');}});
 el('productionCloudGoogle')?.addEventListener('click',()=>{if(!canSync||!ready()||!online())return;unifiedLogin=true;void action(async()=>{try{await connectCloud();if(!cloud.currentUid())await cloud.signIn();}catch(e){unifiedLogin=false;throw e;}});});

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
 retry?.addEventListener('click',()=>{if(!uid||review||invalid||busy||session?.state().busy)return;if(session?.state().active){runtime?.retry();return;}unifiedLogin=true;void finishExplicitLogin();});
 login.addEventListener('click',()=>action(async()=>{if(!cloud||uid)return;await cloud.signIn();}));
 async function inspectAccount(){if(!cloud||!uid)return;const who=uid,g=generation;if(!canSync){const remote=await cloud.read(who);if(g!==generation||who!==uid||!unlocked())return;say('UID: '+who+(remote?' • Nuvem existente, revisão '+remote.head.revision:' • Conta autorizada; nuvem vazia.'));return;}const s=requireSession();writeAllowed=false;await authorizeWrite();if(await s.checkpoint()){say('Conta autorizada para escrita. Retomada exige confirmação explícita.');return;}const r=await s.inspect();if(g!==generation||who!==uid)return;plan=r;reset('productionCloudConsent','productionCloudBackupSaved');if(planBox)planBox.textContent=JSON.stringify({uid:r.uid,mode:r.mode,local:r.local,remote:r.remote},null,2);say(r.mode==='seed'?'Conta autorizada; nuvem vazia. Revise e confirme.':'Conta autorizada; nuvem existente. Revise antes de receber.');}
 inspect.addEventListener('click',()=>action(inspectAccount));
 function link(mode){return action(async()=>{const s=requireSession();if(plan?.mode!==mode||!checked('productionCloudConsent')||!checked('productionCloudBackupSaved'))throw Error('PRODUCTION_CONSENT');await authorizeWrite();await s.authorize({mode,confirmed:true,backupSaved:true});syncStorage.setItem(CONNECTION_KEY,uid);plan=null;reset('productionCloudConsent','productionCloudBackupSaved');if(planBox)planBox.textContent='';say('Vínculo confirmado. Sincronização automática ativa.');runtime?.signal();});}
 seed.addEventListener('click',()=>link('seed'));adopt?.addEventListener('click',()=>link('adopt'));
 refresh?.addEventListener('click',()=>{if(!canSync)return;void action(async()=>{const s=requireSession();if(!writeAllowed||!s.state().active)throw Error('PRODUCTION_PAUSED');syncing=true;paint();try{const r=await s.tick({manual:true});result(r);}finally{syncing=false;}});});
 pauseBtn?.addEventListener('click',()=>{if(canSync&&session){try{runtime.pause();say('Sincronização pausada.');paint();}catch(e){error(e);}}});
 resumeBtn?.addEventListener('click',()=>action(async()=>{const s=requireSession();if(!confirm('Retomar explicitamente a sincronização do banco V2 principal?'))return;await authorizeWrite();await s.resume(true);syncStorage.setItem(CONNECTION_KEY,uid);say('Sincronização retomada.');runtime?.signal();}));
 backupBtn?.addEventListener('click',()=>action(async()=>{download('raytech-backup-principal.json',requireSession().exportLocal());say('Backup exportado; guarde o arquivo antes de confirmar.');}));
 stageBtn?.addEventListener('click',()=>action(async()=>{const s=requireSession();const file=el('productionCloudBackupFile')?.files?.[0];if(!file||!file.name.toLowerCase().endsWith('.json')||file.size>2000000)throw Error('PRODUCTION_BACKUP_FILE');await s.stageRestore(decodeJsonFile(await file.text()));reset('productionCloudReviewConsent','productionCloudReviewBackup');el('productionCloudChoice').value='';say('Backup em revisão; nenhum dado aplicado.');}));
 updateBtn?.addEventListener('click',()=>action(async()=>{const s=requireSession();if(!confirm('Preservar a revisão anterior e consultar a atual?'))return;await s.refreshReview(true);reset('productionCloudReviewConsent','productionCloudReviewBackup');el('productionCloudChoice').value='';say('Revisão atualizada; confirme novamente.');}));
 reviewBtn?.addEventListener('click',()=>action(async()=>{const s=requireSession();await authorizeWrite();await s.resolve({choice:el('productionCloudChoice')?.value,confirmed:checked('productionCloudReviewConsent'),backupSaved:checked('productionCloudReviewBackup')});reset('productionCloudReviewConsent','productionCloudReviewBackup');el('productionCloudChoice').value='';say('Decisão aplicada localmente. Sincronização pausada.');}));
 historyBtn?.addEventListener('click',()=>action(async()=>{const s=requireSession();if(historyBox)historyBox.textContent=JSON.stringify(s.history(),null,2);}));
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
  const lifecycle=()=>{if(online()&&doc.visibilityState!=='hidden')watchFailed=false;runtime?.changed();paint();if(!online()||!ready()||doc.visibilityState==='hidden')return;if(!cloud&&connection()&&!busy)void action(connectCloud);else if(unifiedLogin)void finishExplicitLogin();else if(session?.state().active){runtime?.signal();}else if(!session?.state().budgetWaiting)void restore();};
  win.addEventListener('online',lifecycle);win.addEventListener('offline',lifecycle);doc.addEventListener?.('visibilitychange',lifecycle);
  win.addEventListener('storage',e=>{if(e.key===dbKey||e.key===syncPrefix(search)+DEVICE_KEY||e.key===syncPrefix(search)+REVIEW_KEY){storageChanged=true;stop();say('Alteração em outra aba. Feche as outras abas e reabra; sincronização bloqueada.');paint();}});
  win.addEventListener('pagehide',()=>{generation++;stop(true);},{once:true});
  const observer=new win.MutationObserver(lifecycle);const pin=el('pinLockOverlay');if(pin)observer.observe(pin,{attributes:true,attributeFilter:['class']});
  const startup=()=>{if(!ready()){win.setTimeout(startup,500);return;}lifecycle();};win.setTimeout(startup,0);
 }
 say(config.enabled?(canSync?'Conecte-se para verificar sua conta.':'Login disponível para validação. Transferências financeiras desativadas.'):'Nuvem V2 aguardando liberação. Nenhuma conexão foi iniciada.');paint();
}
if(typeof document!=='undefined')bindCloudPanel(document,localStorage);
