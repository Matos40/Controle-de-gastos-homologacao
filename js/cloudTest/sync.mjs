/* Offline-first synthetic workspace. No access to the ordinary financial database. */
import {initializeApp} from 'https://www.gstatic.com/firebasejs/11.10.0/firebase-app.js';
import {getAuth,onAuthStateChanged} from 'https://www.gstatic.com/firebasejs/11.10.0/firebase-auth.js';
import {getFirestore,doc,onSnapshot,getDocFromServer,runTransaction} from 'https://www.gstatic.com/firebasejs/11.10.0/firebase-firestore.js';
import {blank,validatePayload,validateEnvelope,apply,checkSuccessor,validateRecovery,validateQueued,queueStatus,assertParent,appendQueued,makeQueueBackup,readQueueBackup,backupPack,validateBackupPack,packRows,readPackRows,mergeImport,validateUndo,snapshotDiff,queueFits} from './model.mjs';
const firebaseConfig = Object.freeze({
  apiKey: 'AIzaSyAlOok-2bV9QigR6PyjRgHMLjFLIoPDWpw',
  authDomain: 'raytech-cg-homologacao.firebaseapp.com',
  projectId: 'raytech-cg-homologacao',
  storageBucket: 'raytech-cg-homologacao.firebasestorage.app',
  messagingSenderId: '195471491370',
  appId: '1:195471491370:web:b7e5a0a5a218d16f7a9e53'
});
const host=location.hostname,path=location.pathname;
if(document.documentElement.dataset.raytechMode!=='cloud'||!((host==='matos40.github.io'&&['/Controle-de-gastos-homologacao/','/Controle-de-gastos-homologacao/index.html'].includes(path))||(host==='raytech-cg-homologacao.firebaseapp.com'&&['/','/index.html'].includes(path))))throw Error('Homologation only');
const app=initializeApp(firebaseConfig),auth=getAuth(app),db=getFirestore(app);
function startCloud(){
const el=id=>document.getElementById(id),workspace=el('cloudWorkspace'),status=el('cloudStatus'),indicator=el('cloudIndicator'),details=el('cloudDetails'),refresh=el('cloudRefresh'),retry=el('cloudRetry'),download=el('cloudDownload'),discard=el('cloudDiscard'),restore=el('cloudRestore'),fileInput=el('cloudRecoveryFile'),leave=el('cloudLeave');
const importBtn=el('cloudImport'),importFile=el('cloudImportFile'),fixtureJson=el('cloudFixtureJson'),fixtureExcel=el('cloudFixtureExcel'),undoBtn=el('cloudUndo'),compareBtn=el('cloudCompare'),conflictReport=el('cloudConflictReport');
const ref=id=>doc(db,'raytechFinancialTestV1',id),access=id=>doc(db,'raytechSyncPilotAccessV1',id);
const prefix=id=>'raytech_financial_test_pending_v1:'+id+':',checkpoint=id=>'raytech_financial_test_checkpoint_v1:'+id,preference='raytech_cloud_test_preference_v1';
const sha=async p=>Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(p))),b=>b.toString(16).padStart(2,'0')).join('');
let uid=null,generation=0,epoch=0,serial=0,unsub=null,base=null,authorized=false,ready=false,loaded=false,busy=false,dirty=false,storageFault=false,denied=false,recoverBusy=false,attention='',notice='Verificando conta Google…',view=null,viewPayload='',timer=null;
const same=(id,g)=>uid===id&&generation===g&&auth.currentUser?.uid===id;
function modalOpen(){return ['confirmModal','editExpenseModal','editCardModal','incomeModal'].some(id=>!el(id)?.classList.contains('hidden'));}
function dismiss(){pendingModalAction=null;for(const id of ['confirmModal','editExpenseModal','editCardModal','incomeModal'])el(id)?.classList.add('hidden');}
function readRows(){if(!uid)return [];try{const rows=[],pre=prefix(uid);for(let i=0;i<localStorage.length;i++){const k=localStorage.key(i);if(!k?.startsWith(pre))continue;const q=validateQueued(JSON.parse(localStorage.getItem(k)));if(k!==pre+q.id)throw Error('QUEUE_KEY');rows.push(q);}return rows.sort((a,b)=>a.expectedRevision-b.expectedRevision||a.id.localeCompare(b.id));}catch{storageFault=true;return [];}}
function plan(){try{return queueStatus(base,readRows());}catch{storageFault=true;return {kind:'conflict'};}}
function put(q){validateQueued(q);const k=prefix(uid)+q.id,prior=localStorage.getItem(k);if(prior!==null&&prior!==JSON.stringify(q))throw Error('ID_REUSE');localStorage.setItem(k,JSON.stringify(q));}
async function verify(s){if(!s)return null;validateEnvelope(s);if(s.receipts[s.lastOperationId]!==s.revision+':'+await sha(s.payload))throw Error('PAYLOAD_HASH_MISMATCH');return s;}
function persist(s,id){
  const key=checkpoint(id),raw=localStorage.getItem(key);
  if(raw!==null){const previous=JSON.parse(raw);if(previous.uid!==id||previous.format!=='raytech-test-checkpoint-v1')throw Error('CHECKPOINT');
    if(previous.state){validateEnvelope(previous.state);if(!s||previous.state.revision>s.revision)throw Error('CHECKPOINT_NEWER');checkSuccessor(previous.state,s);}}
  localStorage.setItem(key,JSON.stringify({format:'raytech-test-checkpoint-v1',uid:id,state:s}));
}
function showPayload(payload,revision,parent){
  viewPayload=payload;view={revision,parent};appDb=validatePayload(payload);dismiss();document.activeElement?.blur?.();updateMonthHeader();renderAll();loaded=true;dirty=false;
}
function showPlan(p=plan()){
  if(p.kind==='ready')showPayload(p.tail.payload,p.revision,p.parent);
  else if(p.kind==='empty')showPayload(base?.payload??JSON.stringify(blank(getTodayYM())),base?.revision??0,base?.lastOperationId??'');
  else if(!loaded){showPayload(base?.payload??JSON.stringify(blank(getTodayYM())),base?.revision??0,base?.lastOperationId??'');}
}
function scrub(){
  loaded=false;ready=false;authorized=false;workspace.style.display='none';workspace.inert=true;appDb=blank(getTodayYM());view=null;viewPayload='';dismiss();
  for(const f of workspace.querySelectorAll('form'))f.reset();
  document.activeElement?.blur?.();updateMonthHeader();renderAll();
}
const undoKey=(id,op)=>'raytech_test_import_undo_v1:'+id+':'+op;
function canMigrate(){return !!uid&&auth.currentUser?.uid===uid&&loaded&&authorized&&ready&&!denied&&!storageFault&&!busy&&!recoverBusy&&!dirty&&!modalOpen()&&!readRows().length&&!!view&&view.revision===(base?.revision??0)&&view.parent===(base?.lastOperationId??'')&&view.revision<500;}
function currentUndo(){try{if(!uid||!view||!view.parent)return null;const raw=localStorage.getItem(undoKey(uid,view.parent));if(raw===null)return null;return validateUndo(JSON.parse(raw),uid,viewPayload,view.parent,view.revision);}catch{return null;}}
function paint(){
  const rows=readRows(),p=plan(),conflict=p.kind==='conflict',blocked=!loaded||!authorized||denied||storageFault||busy||recoverBusy||!['empty','ready'].includes(p.kind)||rows.length>=16||(p.revision??0)>=500;
  workspace.style.display=loaded?'block':'none';workspace.inert=blocked;workspace.setAttribute('aria-busy',String(blocked));window.raytechCloudPending=rows.length>0||busy;
  const mode=denied?'Acesso negado':storageFault?'Bloqueado':conflict?'Conflito':busy||recoverBusy?'Sincronizando…':rows.length?(ready?'Pendente':'Offline · '+rows.length):ready?'Sincronizado':loaded?'Offline':'Conectando…';
  indicator.textContent=mode;indicator.dataset.tone=ready&&!rows.length&&!blocked?'ok':busy||!loaded?'busy':'warn';
  status.textContent=notice+(loaded?' · revisão confirmada '+(base?.revision??0)+' / 500':'')+' · '+rows.length+' pendente(s)';
  retry.hidden=!rows.length;retry.disabled=!ready||busy||recoverBusy||storageFault||denied||conflict;
  download.hidden=!rows.length;download.disabled=busy||recoverBusy||storageFault;
  discard.hidden=!(rows.length&&conflict&&ready&&!busy&&!recoverBusy&&!denied);
  refresh.disabled=busy||recoverBusy;restore.hidden=!loaded||!authorized||denied||rows.length>0||storageFault;restore.disabled=busy||recoverBusy;
  importBtn.hidden=!canMigrate();fixtureJson.hidden=!loaded||!authorized||denied;fixtureExcel.hidden=fixtureJson.hidden;
  undoBtn.hidden=!canMigrate()||!currentUndo();compareBtn.hidden=!(rows.length&&conflict&&ready&&!busy&&!recoverBusy&&!denied);
  if(compareBtn.hidden){conflictReport.hidden=true;conflictReport.textContent='';}
  const next=denied?'denied':storageFault?'fault':conflict?'conflict':rows.length>=16?'full':!loaded?'connecting':'';
  if(next&&next!==attention)details.open=true;if(!next&&attention==='connecting')details.open=false;attention=next;
}
function fault(e){storageFault=true;notice='Armazenamento ou integridade não confirmados. Nada será sobrescrito. '+(e?.message??'');paint();}
async function settle(s,id,g){
  for(const q of readRows()){if(!s||!Object.hasOwn(s.receipts,q.id))continue;const h=await sha(q.payload);if(!same(id,g))return;if(s.receipts[q.id]!==q.expectedRevision+1+':'+h)throw Error('ID_REUSE');
    // Checkpoint has already been persisted. An acknowledged operation can now be removed.
    const k=prefix(id)+q.id;if(localStorage.getItem(k)===JSON.stringify(q))localStorage.removeItem(k);}
}
function schedule(delay=0){if(timer!==null)clearTimeout(timer);timer=setTimeout(()=>{timer=null;drain();},delay);}
async function accept(s,id,g,n){
  await verify(s);if(!same(id,g)||n!==serial)return;
  if(base&&s&&s.revision<base.revision)return;
  checkSuccessor(base,s);persist(s,id);base=s;authorized=true;denied=false;
  await settle(s,id,g);if(!same(id,g)||n!==serial)return;
  ready=true;try{localStorage.setItem(preference,'enabled');}catch{}
  const p=plan();
  if(!loaded||(!busy&&!dirty&&!modalOpen()))showPlan(p);
  notice=p.kind==='conflict'?'Outro dispositivo alterou a revisão. Sua fila permanece guardada; exporte antes de descartar.':p.kind==='ready'?'Alterações locais aguardando envio automático.':dirty||modalOpen()?'Revisão recebida. Rascunho preservado; alterações sobre revisão antiga serão bloqueadas.':'Sincronizado com o servidor.';
  paint();schedule();
}
function fail(e,id,g){if(!same(id,g))return;ready=false;if(e?.code==='permission-denied'){denied=true;authorized=false;loaded=false;notice='Acesso revogado ou não autorizado. Fila preservada.';}else notice='Servidor indisponível. Alterações locais preservadas.';paint();}
async function connect(){
  const id=uid,g=generation,t=++epoch;++serial;if(unsub)unsub();unsub=null;ready=false;paint();
  if(!id||!navigator.onLine)return;
  try{const a=await getDocFromServer(access(id));if(!same(id,g)||t!==epoch)return;if(!a.exists()||a.data().enabled!==true){fail({code:'permission-denied'},id,g);return;}
    unsub=onSnapshot(ref(id),{includeMetadataChanges:true},snap=>{
      if(!same(id,g)||t!==epoch)return;const n=++serial;
      if(snap.metadata.fromCache||snap.metadata.hasPendingWrites){ready=false;paint();return;}
      accept(snap.exists()?snap.data():null,id,g,n).catch(e=>{if(same(id,g)&&n===serial)fault(e);});
    },e=>{if(t===epoch)fail(e,id,g);});
  }catch(e){if(t===epoch)fail(e,id,g);}
}
async function drain(){
  const id=uid,g=generation;if(!id||!same(id,g)||!ready||!navigator.onLine||busy||recoverBusy||storageFault||denied)return;
  const p=plan();if(p.kind!=='ready')return;
  if(dirty||modalOpen()){schedule(1000);return;}
  const q=p.first;busy=true;notice='Enviando operação guardada no dispositivo…';paint();let success=false;
  try{
    const hash=await sha(q.payload);if(!same(id,g))return;
    await runTransaction(db,async tx=>{
      if(!same(id,g))throw Error('SESSION_CHANGED');const snap=await tx.get(ref(id));const old=snap.exists()?await verify(snap.data()):null;if(!same(id,g))throw Error('SESSION_CHANGED');
      assertParent(old,q);const result=apply(old,q,hash);if(!result.replay)tx.set(ref(id),result.state);
    });
    const snap=await getDocFromServer(ref(id));const s=await verify(snap.exists()?snap.data():null);if(!same(id,g))return;
    if(!s||s.receipts[q.id]!==q.expectedRevision+1+':'+hash)throw Error('UNCONFIRMED');
    if(!base||s.revision>=base.revision){checkSuccessor(base,s);persist(s,id);base=s;}
    await settle(base,id,g);if(!same(id,g))return;ready=true;success=true;showPlan();notice=readRows().length?'Enviando alterações restantes…':'Sincronizado com o servidor.';
  }catch(e){if(!same(id,g))return;if(e?.message==='CONFLICT'){notice='Conflito de revisão. Fila preservada, sem sobrescrever o servidor.';ready=false;}else if(e?.code==='permission-denied'){fail(e,id,g);}else{notice='Envio não confirmado. Fila guardada para nova tentativa.';ready=false;}}
  finally{if(same(id,g)){busy=false;paint();if(success)schedule();else if(navigator.onLine&&!denied&&!storageFault)setTimeout(()=>{if(same(id,g)&&!busy&&!ready)connect();},3000);}}
}
window.raytechCloudSave=function(candidate){
  if(!uid||auth.currentUser?.uid!==uid||!loaded||!authorized||denied||storageFault||busy||recoverBusy||!view){if(view)appDb=validatePayload(viewPayload);throw Error('Gravação bloqueada');}
  let payload;try{payload=JSON.stringify(candidate);validatePayload(payload);validateBackupDatabase(JSON.parse(payload));if(payload===viewPayload){dirty=false;return;}
    const q=appendQueued(base,readRows(),view,payload,crypto.randomUUID());put(q);
    viewPayload=payload;view={revision:q.expectedRevision+1,parent:q.id};dirty=false;notice='Alteração fictícia salva neste dispositivo.';paint();schedule();
  }catch(e){appDb=validatePayload(viewPayload);notice='Não gravado: '+e.message;paint();renderAll();alert(notice);throw e;}
};
workspace.addEventListener('input',e=>{if(e.target.closest('form')||['salaryInput','budgetLimitInput'].includes(e.target.id))dirty=true;},true);
for(const ev of ['click','submit','keydown','input','change'])workspace.addEventListener(ev,e=>{if(workspace.inert){e.preventDefault();e.stopImmediatePropagation();}},true);
refresh.addEventListener('click',()=>{if(!uid){location.href='./index.html?mode=local';return;}if((dirty||modalOpen())&&!confirm('Descartar rascunho não enviado? A fila salva será mantida.'))return;dirty=false;dismiss();if(loaded)showPlan();connect();});
retry.addEventListener('click',()=>{if(!ready)connect();else schedule();});
download.addEventListener('click',async()=>{const id=uid,g=generation,rows=readRows();if(!id||!rows.length||busy||recoverBusy||storageFault)return;try{const pack=makeQueueBackup(id,rows),payload=JSON.stringify(pack),digest=await sha(payload);if(!same(id,g))return;const a=document.createElement('a'),url=URL.createObjectURL(new Blob([JSON.stringify({payload,sha256:digest})],{type:'application/json'}));a.href=url;a.download='raytech-fila-teste.json';a.click();setTimeout(()=>URL.revokeObjectURL(url),3000);}catch{notice='Não foi possível exportar. Fila preservada.';paint();}});
restore.addEventListener('click',()=>{if(!uid||!authorized||busy||recoverBusy||readRows().length)return;fileInput.value='';fileInput.click();});
fileInput.addEventListener('change',async()=>{const f=fileInput.files?.[0],id=uid,g=generation;if(!f||!id||!same(id,g)||!authorized||busy||recoverBusy||storageFault||readRows().length||f.size>5000000)return;recoverBusy=true;paint();
  try{const outer=JSON.parse(await f.text());let rows;if(outer.format==='raytech-test-recovery-v1'){const q=validateRecovery(outer,id);if(await sha(q.payload)!==outer.sha256)throw Error('HASH');rows=[q];}else{if(typeof outer.payload!=='string'||await sha(outer.payload)!==outer.sha256)throw Error('HASH');rows=readQueueBackup(JSON.parse(outer.payload),id);}
    if(!same(id,g)||!authorized||readRows().length)return;
    const unconfirmed=[];for(const q of rows){if(base&&Object.hasOwn(base.receipts,q.id)){if(base.receipts[q.id]!==q.expectedRevision+1+':'+await sha(q.payload))throw Error('ID_REUSE');}else unconfirmed.push(q);}
    if(!same(id,g)||!authorized||readRows().length)return;
    if(!unconfirmed.length){notice='Todas as operações já confirmadas; nenhuma duplicação.';return;}
    if(!confirm('Recuperar '+unconfirmed.length+' operação(ões) fictícia(s) desta conta?'))return;
    // Immutable keys: if storage is exhausted, already saved entries remain available and original file unchanged.
    if(unconfirmed.length>16||unconfirmed.reduce((n,q)=>n+JSON.stringify(q).length,0)>1250000)throw Error('QUEUE_CAPACITY');
    for(const q of unconfirmed)put(q);showPlan();notice='Fila recuperada. Conflitos não serão enviados.';schedule();
  }catch(e){if(same(id,g))notice='Recuperação interrompida: '+e.message+'. Confira as operações guardadas; mantenha o arquivo original.';}
  finally{if(same(id,g)){recoverBusy=false;fileInput.value='';paint();schedule();}}});
// Migration never reads the original local financial storage.
window.raytechSyntheticExport=async payload=>{const id=uid,g=generation;if(!id||!same(id,g)||!loaded||!authorized||denied)throw Error('Conta de teste indisponível.');const backup=backupPack(payload,await sha(payload));return same(id,g)&&authorized&&!denied?{backup,rows:packRows(backup)}:null;};
function downloadJson(pack,name){const a=document.createElement('a'),url=URL.createObjectURL(new Blob([JSON.stringify(pack,null,2)],{type:'application/json'}));a.href=url;a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(url),3000);}
async function fixture(asExcel){
 const id=uid,g=generation;if(!id||!same(id,g)||!loaded||!authorized||denied)return;
 try{const ym=appDb.selectedMonth,d=blank(ym),m=d.months[ym];
 const suffix=asExcel?'excel':'json';m.expenses.push({id:'fixture_migration_'+suffix+'_1',title:'Migração '+suffix.toUpperCase()+' Teste',category:'outros',type:'one-time',date:ym+'-10',amount:42.50,paid:false});
 m.expenses.push({id:'fixture_migration_'+suffix+'_2',title:'Migração '+suffix.toUpperCase()+' Teste',category:'outros',type:'one-time',date:ym+'-10',amount:42.50,paid:false});
 const payload=JSON.stringify(d),pack=backupPack(payload,await sha(payload));if(!same(id,g)||!authorized)return;
 if(asExcel){if(typeof XLSX==='undefined')throw Error('Excel indisponível.');const wb=XLSX.utils.book_new();XLSX.utils.book_append_sheet(wb,XLSX.utils.aoa_to_sheet(packRows(pack)),'Raytech Teste');XLSX.writeFile(wb,'Raytech_Fixture_Teste.xlsx');}else downloadJson(pack,'Raytech_Fixture_Teste.json');
 notice='Arquivo fictício gerado. Dois lançamentos iguais com IDs distintos.';paint();
 }catch(e){if(same(id,g)){notice='Falha ao gerar arquivo: '+e.message;paint();}}
}
fixtureJson.addEventListener('click',()=>fixture(false));fixtureExcel.addEventListener('click',()=>fixture(true));
importBtn.addEventListener('click',()=>{if(!canMigrate())return;importFile.value='';importFile.click();});
function migrationStillValid(id,g,v,payload){return same(id,g)&&authorized&&ready&&!denied&&!storageFault&&!busy&&!dirty&&!modalOpen()&&!readRows().length&&view?.revision===v.revision&&view?.parent===v.parent&&viewPayload===payload&&v.revision===(base?.revision??0)&&v.parent===(base?.lastOperationId??'');}
function enqueueMigration(payload,q){put(q);showPayload(payload,q.expectedRevision+1,q.id);notice='Operação salva. Aguardando confirmação do servidor.';paint();schedule();}
importFile.addEventListener('change',async()=>{
 const file=importFile.files?.[0],id=uid,g=generation;if(!file||!canMigrate())return;if(file.size>2000000){notice='Arquivo excede o limite de 2 MB.';paint();return;}
 const v={...view},before=viewPayload;recoverBusy=true;paint();
 try{
 let pack;if(file.name.toLowerCase().endsWith('.xlsx')){if(typeof XLSX==='undefined')throw Error('Biblioteca Excel indisponível.');const wb=XLSX.read(await file.arrayBuffer(),{type:'array',sheetRows:10});const ws=wb.Sheets['Raytech Teste'];if(!ws||!ws['!ref'])throw Error('Aba Raytech Teste ausente.');const range=XLSX.utils.decode_range(ws['!ref']);if(range.s.r!==0||range.s.c!==0||range.e.r>8||range.e.c!==4||Object.keys(ws).some(k=>!k.startsWith('!')&&ws[k]?.f))throw Error('Estrutura Excel inválida.');pack=readPackRows(XLSX.utils.sheet_to_json(ws,{header:1,raw:true,defval:null,blankrows:true}));}else if(file.name.toLowerCase().endsWith('.json'))pack=validateBackupPack(JSON.parse(await file.text()));else throw Error('Formato não permitido.');
 if(await sha(pack.payload)!==pack.sha256)throw Error('Checksum SHA-256 divergente.');
 if(!migrationStillValid(id,g,v,before))throw Error('Revisão mudou. Reabra a importação.');
 const result=mergeImport(before,pack.payload);
 if(result.conflicts.length){notice='Importação bloqueada: '+result.conflicts.slice(0,8).join('; ');details.open=true;return;}
 if(!result.changed){notice='Nenhuma alteração: '+result.stats.duplicates+' duplicata(s), '+result.stats.skippedDeleted+' parcela(s) excluída(s) preservada(s).';return;}
 const st=result.stats;
 if(!confirm('Backup FICTÍCIO validado.\n'+st.added+' lançamento(s) novo(s), '+st.months+' mês(es) novo(s), '+st.duplicates+' duplicata(s), '+st.skippedDeleted+' parcela(s) excluída(s) ignorada(s), '+st.filled+' saldo(s)/limite(s) preenchido(s), '+st.kept+' campo(s) atual(is) preservado(s).\nConfirma a importação sem substituir os lançamentos atuais?')){notice='Importação cancelada. Banco intacto.';return;}
 const q=appendQueued(base,[],v,result.payload,crypto.randomUUID());const journal={format:'raytech-import-undo-v1',uid:id,operationId:q.id,revision:q.expectedRevision+1,before,after:result.payload,sha256:await sha(before)};
 if(!migrationStillValid(id,g,v,before))throw Error('Revisão mudou antes da gravação.');
 localStorage.setItem(undoKey(id,q.id),JSON.stringify(journal));enqueueMigration(result.payload,q);
 }catch(e){if(same(id,g))notice='Importação não concluída: '+e.message+' Confira o status; nenhuma sobrescrita foi autorizada.';}
 finally{if(same(id,g)){recoverBusy=false;importFile.value='';paint();schedule();}}
});
undoBtn.addEventListener('click',async()=>{
 if(!canMigrate())return;const id=uid,g=generation,v={...view},before=viewPayload,j=currentUndo();if(!j)return;
 if(!confirm('Desfazer esta importação? O estado anterior será gravado como uma nova revisão. Só é permitido se nenhuma mudança ocorreu depois.'))return;recoverBusy=true;paint();
 try{if(await sha(j.before)!==j.sha256)throw Error('Cópia anterior inválida.');if(!migrationStillValid(id,g,v,before))throw Error('Revisão mudou. Reversão bloqueada.');const q=appendQueued(base,[],v,j.before,crypto.randomUUID());enqueueMigration(j.before,q);}
 catch(e){if(same(id,g))notice='Reversão bloqueada: '+e.message;}
 finally{if(same(id,g)){recoverBusy=false;paint();schedule();}}
});
compareBtn.addEventListener('click',()=>{if(!ready||busy||recoverBusy||plan().kind!=='conflict')return;try{const rows=readRows(),tail=rows[rows.length-1],remote=base?.payload??JSON.stringify(blank(getTodayYM()));const lines=snapshotDiff(remote,tail.payload);conflictReport.textContent='Servidor x última intenção da fila (não é mesclagem automática):\n'+(lines.slice(0,80).join('\n')||'Sem diferenças de conteúdo; revisão incompatível.')+(lines.length>80?'\nMais diferenças no arquivo da fila.':'')+'\nExporte a fila antes de descartar. Revise e reaplique manualmente apenas os lançamentos desejados.';conflictReport.hidden=false;}catch(e){notice='Comparação indisponível: '+e.message;paint();}});
discard.addEventListener('click',()=>{const id=uid,g=generation,rows=readRows();if(!id||!same(id,g)||!ready||busy||recoverBusy||plan().kind!=='conflict')return;if(!confirm('Descartar TODA a fila fictícia em conflito? Exporte-a antes. O servidor não será alterado.'))return;
  try{for(const q of rows){const k=prefix(id)+q.id;if(localStorage.getItem(k)===JSON.stringify(q))localStorage.removeItem(k);}showPlan();notice='Fila descartada por confirmação do usuário.';paint();}catch(e){fault(e);}});
leave.addEventListener('click',e=>{if((dirty||modalOpen())&&!confirm('Sair sem salvar o rascunho? A fila já gravada será preservada.')){e.preventDefault();return;}dirty=false;dismiss();try{localStorage.removeItem(preference);}catch{}});
window.addEventListener('beforeunload',e=>{if(dirty||modalOpen()){e.preventDefault();e.returnValue='';}});
window.addEventListener('pageshow',e=>{if(e.persisted)location.reload();});
onAuthStateChanged(auth,async user=>{
  const g=++generation;++epoch;++serial;if(unsub)unsub();unsub=null;if(timer!==null)clearTimeout(timer);timer=null;uid=null;base=null;busy=false;recoverBusy=false;dirty=false;denied=false;storageFault=false;scrub();
  if(!user||!/^[a-zA-Z0-9_-]{1,128}$/.test(user.uid)){notice='Entre com Google no aplicativo local. Nenhum banco de outra conta será aberto.';paint();return;}
  const id=uid=user.uid;
  try{const raw=localStorage.getItem(checkpoint(id));if(raw!==null){const c=JSON.parse(raw);if(c.format!=='raytech-test-checkpoint-v1'||c.uid!==id||!Object.hasOwn(c,'state'))throw Error('CHECKPOINT');const s=await verify(c.state);if(!same(id,g))return;base=s;authorized=true;await settle(base,id,g);if(!same(id,g))return;showPlan();notice='Banco fictício recuperado neste dispositivo.';paint();}}
  catch(e){if(same(id,g))fault(e);}
  if(same(id,g))connect();
});
window.addEventListener('offline',()=>{++serial;ready=false;notice='Sem internet. Continue registrando; alterações serão guardadas localmente.';paint();});
window.addEventListener('online',()=>{if(uid&&!busy)connect();});
document.addEventListener('visibilitychange',()=>{if(!document.hidden&&uid&&!busy&&navigator.onLine){if(!ready)connect();else schedule();}});
window.addEventListener('storage',e=>{if(!uid||!(e.key===null||e.key.startsWith(prefix(uid))||e.key===checkpoint(uid)))return;if(dirty||modalOpen()||busy){notice='Outro separador alterou o armazenamento. Seu rascunho não será sobrescrito.';paint();return;}const p=plan();if(loaded&&p.kind==='ready')showPlan(p);if(navigator.onLine&&!busy)connect();else paint();});
if('serviceWorker' in navigator)navigator.serviceWorker.register('./sw.js').catch(()=>{notice='Cache offline indisponível neste navegador.';paint();});
paint();
}
if(window.raytechCloudUiReady)startCloud();else window.addEventListener('DOMContentLoaded',startCloud,{once:true});
