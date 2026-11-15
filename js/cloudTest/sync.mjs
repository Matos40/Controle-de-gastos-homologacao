/* Offline-first synthetic workspace. No access to the ordinary financial database. */
import {initializeApp} from 'https://www.gstatic.com/firebasejs/11.10.0/firebase-app.js';
import {getAuth,onAuthStateChanged} from 'https://www.gstatic.com/firebasejs/11.10.0/firebase-auth.js';
import {getFirestore,doc,onSnapshot,getDocFromServer,runTransaction} from 'https://www.gstatic.com/firebasejs/11.10.0/firebase-firestore.js';
import {blank,validatePayload,validateEnvelope,apply,checkSuccessor,validateRecovery,validateQueued,queueStatus,assertParent,appendQueued,makeQueueBackup,readQueueBackup,backupPack,validateBackupPack,packRows,readPackRows,mergeImport,validateUndo,snapshotDiff,queueFits,encodeQueue,decodeQueue,sameQueued,legacyFixture,validateLegacyFixture,legacyRows,readLegacyRows,conflictBranches,mergeThreeWay,linearConflict,reconcileCandidate,proofMatches,canonical,adaptiveFits,adaptiveAppend,adaptiveBackup,readAdaptiveBackup,invoiceFixture,invoiceImport,richLegacyFixture,candidateV2,validateRoute,seedMigration,canRollbackV2} from './model.mjs?v=v2integration';
import {commitV2,validateV2Head,validateV2Receipt} from './capacityV2.mjs?v=v2integration';
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
const legacyJson=el('cloudLegacyJson'),legacyExcel=el('cloudLegacyExcel');
const importBtn=el('cloudImport'),importFile=el('cloudImportFile'),fixtureJson=el('cloudFixtureJson'),fixtureExcel=el('cloudFixtureExcel'),undoBtn=el('cloudUndo'),compareBtn=el('cloudCompare'),conflictReport=el('cloudConflictReport');
const richJson=el('cloudRichLegacy'),richExcel=el('cloudRichExcel');
const invoiceBtn=el('cloudInvoice'),invoicePanel=el('cloudInvoicePanel'),invoiceCanvas=el('cloudInvoiceCanvas'),invoiceKey=el('cloudInvoiceKey'),invoiceMock=el('cloudInvoiceMock'),invoiceAnalyze=el('cloudInvoiceAnalyze'),invoiceClose=el('cloudInvoiceClose'),v2Btn=el('cloudV2');
const routeRef=id=>doc(db,'raytechFinancialRouteV2',id),v1Ref=id=>doc(db,'raytechFinancialTestV1',id),v2Ref=id=>doc(db,'raytechFinancialActiveV2',id),receiptRef=(id,op)=>doc(db,'raytechFinancialActiveV2',id,'receipts',op);
const rollbackBtn=el('cloudRollback'),switchBtn=el('cloudRouteSwitch'),quota=el('cloudQuota'),versionLabel=el('cloudVersion');
let version=1,routeMismatch=false,routeAvailable=false,routeUnsub=null,routeObserved=null,refreshRouteBusy=false;
const routeKey=id=>'raytech_test_active_bank_v2:'+id,limit=()=>version===2?Number.MAX_SAFE_INTEGER:500;
const ref=id=>version===2?v2Ref(id):v1Ref(id),access=id=>doc(db,'raytechSyncPilotAccessV1',id);
const prefix=id=>'raytech_financial_test_pending_v'+version+':'+id+':',checkpoint=id=>'raytech_financial_test_checkpoint_v'+version+':'+id,preference='raytech_cloud_test_preference_v1';
const sha=async p=>Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(p))),b=>b.toString(16).padStart(2,'0')).join('');
let uid=null,generation=0,epoch=0,serial=0,unsub=null,base=null,authorized=false,ready=false,loaded=false,busy=false,dirty=false,storageFault=false,denied=false,recoverBusy=false,attention='',notice='Verificando conta Google…',view=null,viewPayload='',timer=null;
const ns=()=>version===2?'_active_v2':'';
const proofKey=(id,op)=>'raytech_test_merge_base_v2'+ns()+':'+id+':'+op;
const journalKey=id=>'raytech_test_merge_journal_v2'+ns()+':'+id;
const mergedKey=(id,op)=>'raytech_test_merged_v2'+ns()+':'+id+':'+op;
const same=(id,g)=>uid===id&&generation===g&&auth.currentUser?.uid===id;
function modalOpen(){return ['confirmModal','editExpenseModal','editCardModal','incomeModal'].some(id=>!el(id)?.classList.contains('hidden'));}
function dismiss(){pendingModalAction=null;for(const id of ['confirmModal','editExpenseModal','editCardModal','incomeModal'])el(id)?.classList.add('hidden');}
function readRows(){if(!uid)return [];try{const rows=[],pre=prefix(uid);for(let i=0;i<localStorage.length;i++){const k=localStorage.key(i);if(!k?.startsWith(pre))continue;const q=decodeQueue(localStorage.getItem(k));if(k!==pre+q.id)throw Error('QUEUE_KEY');rows.push(q);}return rows.sort((a,b)=>a.expectedRevision-b.expectedRevision||a.id.localeCompare(b.id));}catch{storageFault=true;return [];}}
function readJournal(id){const raw=localStorage.getItem(journalKey(id));if(raw===null)return null;const j=JSON.parse(raw);if(j.uid!==id||j.format!=='raytech-test-merge-v2'||!Array.isArray(j.sources)||!linearConflict(j.sources))throw Error('MERGE_JOURNAL');j.sources.forEach(validateQueued);validateQueued(j.operation);return j;}
function hasJournal(){try{return !!uid&&!!readJournal(uid);}catch{storageFault=true;return true;}}
function canonicalQueue(rows){return JSON.stringify(rows.map(q=>encodeQueue(q)));}
function plan(){try{if(hasJournal())return {kind:'conflict'};return queueStatus(base,readRows());}catch{storageFault=true;return {kind:'conflict'};}}
function preserveProof(q,payload){if(!q.expectedRevision||!q.parentId)return;validatePayload(payload);const k=proofKey(uid,q.id),record=JSON.stringify({operationId:q.id,parentId:q.parentId,revision:q.expectedRevision,payload});const existing=localStorage.getItem(k);if(existing!==null&&existing!==record)throw Error('BASE_REUSE');if(existing===null)localStorage.setItem(k,record);}
function put(q){validateQueued(q);const k=prefix(uid)+q.id,prior=localStorage.getItem(k);if(prior!==null){if(!sameQueued(prior,q))throw Error('ID_REUSE');return;}localStorage.setItem(k,encodeQueue(q));}
async function verify(s){if(!s)return null;if(version===1){validateEnvelope(s);if(s.receipts[s.lastOperationId]!==s.revision+':'+await sha(s.payload))throw Error('PAYLOAD_HASH_MISMATCH');return s;}const {receipts,...head}=s;validateV2Head(head);if(!receipts||receipts[head.lastOperationId]!==head.revision+':'+head.hash||head.hash!==await sha(head.payload))throw Error('V2_HASH');return s;}
function continuity(previous,next){if(version===1)return checkSuccessor(previous,next);if(!previous)return;if(!next||next.revision<previous.revision)throw Error('REVISION_ROLLBACK');if(next.receipts[previous.lastOperationId]!==previous.receipts[previous.lastOperationId])throw Error('RECEIPT_DIVERGENCE');if(next.revision===previous.revision&&(next.payload!==previous.payload||next.lastOperationId!==previous.lastOperationId))throw Error('REVISION_DIVERGENCE');}
async function readReceipt(id,op){const snap=await getDocFromServer(receiptRef(id,op));if(!snap.exists())return null;const r=validateV2Receipt(snap.data());if(r.operationId!==op)throw Error('RECEIPT_ID');return r.revision+':'+r.hash;}
async function project(raw,id,g,extra=[]){
 if(version===1)return verify(raw);if(!raw)throw Error('ACTIVE_V2_MISSING');const head=validateV2Head(raw);if(head.hash!==await sha(head.payload))throw Error('V2_HASH');
 const ids=new Set([head.lastOperationId,...extra]);if(base)ids.add(base.lastOperationId);const rows=readRows();for(const q of rows){if(q.expectedRevision<head.revision)ids.add(q.id);}if(rows[0]?.parentId)ids.add(rows[0].parentId);const j=readJournal(id);if(j)ids.add(j.operation.id);
 const receipts={};await Promise.all([...ids].map(async op=>{if(!same(id,g))return;const value=await readReceipt(id,op);if(value)receipts[op]=value;}));if(!same(id,g))throw Error('SESSION_CHANGED');
 return verify({...head,receipts});
}
function budget(id,consume=false){const day=new Date().toISOString().slice(0,10),k='raytech_test_send_budget:'+id;let state;try{state=JSON.parse(localStorage.getItem(k)??'null');}catch{throw Error('BUDGET_STORAGE');}const used=state?.day===day?state.used:0;if(!Number.isInteger(used)||used<0)throw Error('BUDGET_STORAGE');if(consume){if(used>=300)throw Error('DAILY_BUDGET');localStorage.setItem(k,JSON.stringify({day,used:used+1}));}return used+(consume?1:0);}
async function send(q,id,g,hash){
 budget(id,true);
 if(version===1){await runTransaction(db,async tx=>{if(!same(id,g))throw Error('SESSION_CHANGED');const snap=await tx.get(v1Ref(id)),old=snap.exists()?await verify(snap.data()):null;if(!same(id,g))throw Error('SESSION_CHANGED');assertParent(old,q);const result=apply(old,q,hash);if(!result.replay)tx.set(v1Ref(id),result.state);},{maxAttempts:3});return;}
 const adapter={currentUid:()=>same(id,g)&&!routeMismatch?id:null,sha,transaction:fn=>runTransaction(db,tx=>fn({getHead:async()=>{const x=await tx.get(v2Ref(id));return x.exists()?x.data():null;},getReceipt:async(_,op)=>{const x=await tx.get(receiptRef(id,op));return x.exists()?x.data():null;},setHead:(_,x)=>tx.set(v2Ref(id),x),setReceipt:(_,op,x)=>tx.set(receiptRef(id,op),x)}),{maxAttempts:3})};
 try{await commitV2(adapter,id,q);}catch(e){if(e.message==='V2_CONFLICT')throw Error('CONFLICT');throw e;}
}
async function confirmedState(id,g,extra=[]){const snap=await getDocFromServer(ref(id));return project(snap.exists()?snap.data():null,id,g,extra);}
function selectVersion(target,id){localStorage.setItem(routeKey(id),String(target));location.reload();}
function routeChanged(target,id,g){if(!same(id,g)||target===version)return false;ready=false;routeMismatch=true;routeObserved=target;notice='Banco ativo mudou em outro aparelho. Fila anterior preservada. Exporte antes de arquivar ou trocar.';if(!readRows().length&&!hasJournal()&&!dirty&&!modalOpen()&&!busy&&!recoverBusy){selectVersion(target,id);return true;}paint();return true;}
async function checkRoute(id,g){try{const snap=await getDocFromServer(routeRef(id));if(!same(id,g))return false;routeAvailable=true;const target=snap.exists()?2:1;if(snap.exists())validateRoute(snap.data());routeObserved=target;if(routeChanged(target,id,g))return false;routeMismatch=false;return true;}catch(e){if(e?.code==='permission-denied'&&version===1&&!routeAvailable){routeAvailable=false;return true;}throw e;}}

function persist(s,id){
  const key=checkpoint(id),raw=localStorage.getItem(key);
  if(raw!==null){const previous=JSON.parse(raw);if(previous.uid!==id||previous.format!=='raytech-test-checkpoint-v1')throw Error('CHECKPOINT');
    if(previous.state){if(version===1)validateEnvelope(previous.state);else{const {receipts,...h}=previous.state;validateV2Head(h);}if(!s||previous.state.revision>s.revision)throw Error('CHECKPOINT_NEWER');continuity(previous.state,s);}}
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
function scrub(){invoiceKey.value='';invoicePanel.hidden=true;invoicePanel.open=false;
  loaded=false;ready=false;authorized=false;workspace.style.display='none';workspace.inert=true;appDb=blank(getTodayYM());view=null;viewPayload='';dismiss();
  for(const f of workspace.querySelectorAll('form'))f.reset();
  document.activeElement?.blur?.();updateMonthHeader();renderAll();
}
const undoKey=(id,op)=>'raytech_test_import_undo_v1'+ns()+':'+id+':'+op;
function canProbeV2(){return !!uid&&auth.currentUser?.uid===uid&&loaded&&authorized&&ready&&!denied&&!storageFault&&!busy&&!recoverBusy&&!readRows().length&&!hasJournal()&&!dirty&&!modalOpen()&&!routeMismatch;}
function canMigrate(){return !!uid&&auth.currentUser?.uid===uid&&loaded&&authorized&&ready&&!denied&&!storageFault&&!busy&&!recoverBusy&&!dirty&&!modalOpen()&&!readRows().length&&!hasJournal()&&!!view&&view.revision===(base?.revision??0)&&view.parent===(base?.lastOperationId??'')&&view.revision<limit()&&!routeMismatch;}
function currentUndo(){try{if(!uid||!view||!view.parent)return null;const raw=localStorage.getItem(undoKey(uid,view.parent));if(raw===null)return null;return validateUndo(JSON.parse(raw),uid,viewPayload,view.parent,view.revision);}catch{return null;}}
function paint(){
  const rows=readRows(),p=plan(),conflict=p.kind==='conflict',blocked=!loaded||!authorized||denied||storageFault||routeMismatch||busy||recoverBusy||!['empty','ready'].includes(p.kind)||rows.length>=64||(p.revision??0)>=limit();
  workspace.style.display=loaded?'block':'none';workspace.inert=blocked;workspace.setAttribute('aria-busy',String(blocked));window.raytechCloudPending=rows.length>0||busy;
  const mode=routeMismatch?'Banco mudou':denied?'Acesso negado':storageFault?'Bloqueado':conflict?'Conflito':busy||recoverBusy?'Sincronizando…':rows.length?(ready?'Pendente':'Offline · '+rows.length):ready?'Sincronizado':loaded?'Offline':'Conectando…';
  indicator.textContent=mode;indicator.dataset.tone=ready&&!rows.length&&!blocked?'ok':busy||!loaded?'busy':'warn';
  status.textContent=notice+(loaded?' · revisão confirmada '+(base?.revision??0)+(version===1?' / 500':' (V2)'):'')+' · '+rows.length+' pendente(s)';
  retry.hidden=!rows.length;retry.disabled=!ready||busy||recoverBusy||storageFault||denied;
  download.hidden=!rows.length;download.disabled=busy||recoverBusy||storageFault;
  discard.hidden=!(rows.length&&conflict&&ready&&!busy&&!recoverBusy&&!denied&&!hasJournal());
  refresh.disabled=busy||recoverBusy;restore.hidden=!loaded||!authorized||denied||routeMismatch||version===2&&!ready||rows.length>0||storageFault||hasJournal();restore.disabled=busy||recoverBusy;
  invoiceBtn.hidden=!canMigrate();v2Btn.hidden=version!==1||!routeAvailable||!base||!canProbeV2();rollbackBtn.hidden=version!==2||base?.revision!==1||!canProbeV2();switchBtn.hidden=!routeMismatch||!routeObserved||busy||recoverBusy;versionLabel.textContent='RC V2 · banco V'+version;try{quota.textContent=uid?'Envios deste aparelho (UTC): '+budget(uid)+' / 300. Cota local preventiva, não é medição do Firebase.':'';}catch{quota.textContent='Contador local indisponível.';}invoiceMock.disabled=busy||recoverBusy;invoiceAnalyze.disabled=busy||recoverBusy;invoiceClose.disabled=busy||recoverBusy;
  importBtn.hidden=!canMigrate();fixtureJson.hidden=!loaded||!authorized||denied;fixtureExcel.hidden=fixtureJson.hidden;legacyJson.hidden=fixtureJson.hidden;legacyExcel.hidden=fixtureJson.hidden;richJson.hidden=fixtureJson.hidden;richExcel.hidden=fixtureJson.hidden;
  undoBtn.hidden=!canMigrate()||!currentUndo();compareBtn.hidden=!(rows.length&&conflict&&ready&&!busy&&!recoverBusy&&!denied);
  if(compareBtn.hidden){conflictReport.hidden=true;conflictReport.textContent='';}
  const next=routeMismatch?'route':denied?'denied':storageFault?'fault':conflict?'conflict':rows.length>=64?'full':!loaded?'connecting':'';
  if(next&&next!==attention)details.open=true;if(!next&&attention==='connecting')details.open=false;attention=next;
}
function fault(e){storageFault=true;notice='Armazenamento ou integridade não confirmados. Nada será sobrescrito. '+(e?.message??'');paint();}
async function settle(s,id,g){
  for(const q of readRows()){if(!s||!Object.hasOwn(s.receipts,q.id))continue;const h=await sha(q.payload);if(!same(id,g))return;if(s.receipts[q.id]!==q.expectedRevision+1+':'+h)throw Error('ID_REUSE');
    // Checkpoint has already been persisted. An acknowledged operation can now be removed.
    const k=prefix(id)+q.id;if(sameQueued(localStorage.getItem(k),q)){localStorage.removeItem(k);localStorage.removeItem(proofKey(id,q.id));}}
}
function schedule(delay=0){if(timer!==null)clearTimeout(timer);timer=setTimeout(()=>{timer=null;drain();},delay);}
async function accept(s,id,g,n){
  s=await project(s,id,g);if(!same(id,g)||n!==serial)return;
  if(base&&s&&s.revision<base.revision)return;
  continuity(base,s);persist(s,id);base=s;authorized=true;denied=false;
  await settle(s,id,g);if(!same(id,g)||n!==serial)return;
  ready=true;try{localStorage.setItem(preference,'enabled');}catch{}
  const p=plan();
  if(!loaded||(!busy&&!dirty&&!modalOpen()))showPlan(p);
  notice=p.kind==='conflict'?'Outro dispositivo alterou a revisão. Sua fila permanece guardada; exporte antes de descartar.':p.kind==='ready'?'Alterações locais aguardando envio automático.':dirty||modalOpen()?'Revisão recebida. Rascunho preservado; alterações sobre revisão antiga serão bloqueadas.':'Sincronizado com o servidor.';
  paint();schedule();
}
function fail(e,id,g){if(!same(id,g))return;ready=false;if(e?.code==='permission-denied'){if(routeMismatch){notice='Banco anterior bloqueado. Fila preservada.';paint();return;}denied=true;authorized=false;loaded=false;notice='Acesso revogado ou não autorizado. Fila preservada.';}else notice='Servidor indisponível. Alterações locais preservadas.';paint();}
async function connect(){
  const id=uid,g=generation,t=++epoch;++serial;if(unsub)unsub();unsub=null;ready=false;paint();
  if(!id||!navigator.onLine)return;
  try{const a=await getDocFromServer(access(id));if(!same(id,g)||t!==epoch)return;if(!a.exists()||a.data().enabled!==true){fail({code:'permission-denied'},id,g);return;}
    if(!await checkRoute(id,g)||!same(id,g)||t!==epoch)return;
    if(routeUnsub)routeUnsub();routeUnsub=null;
    if(routeAvailable)routeUnsub=onSnapshot(routeRef(id),{includeMetadataChanges:true},snap=>{if(!same(id,g)||snap.metadata.fromCache||snap.metadata.hasPendingWrites)return;try{if(snap.exists())validateRoute(snap.data());routeChanged(snap.exists()?2:1,id,g);}catch(e){fault(e);}},e=>{if(same(id,g))fail(e,id,g);});
    unsub=onSnapshot(ref(id),{includeMetadataChanges:true},snap=>{
      if(!same(id,g)||t!==epoch)return;const n=++serial;
      if(snap.metadata.fromCache||snap.metadata.hasPendingWrites){ready=false;paint();return;}
      accept(snap.exists()?snap.data():null,id,g,n).catch(e=>{if(same(id,g)&&n===serial)fault(e);});
    },e=>{if(t===epoch)fail(e,id,g);});
  }catch(e){if(t===epoch)fail(e,id,g);}
}
// Keep the original queue until a new receipt is confirmed. Never infer a missing baseline.
async function reconcile(){
 const id=uid,g=generation;if(!id||!same(id,g)||!ready||!base||busy||recoverBusy||storageFault||denied||routeMismatch)return;
 if(!navigator.locks?.request){notice='Conflito preservado: este navegador não dispõe de bloqueio seguro entre abas.';paint();return;}
 busy=true;paint();let completed=false;
 try{await navigator.locks.request('raytech-merge-v2:'+id,{ifAvailable:true},async lock=>{
  if(!lock||!same(id,g)||!ready||!base)return;
  let j=readJournal(id),rows=readRows();
  if(j&&!Object.hasOwn(base.receipts,j.operation.id)&&base.revision>j.operation.expectedRevision){
   // Old candidate cannot commit at this newer confirmed revision. Retain originals, then recompute.
   if(canonicalQueue(rows)!==canonicalQueue(j.sources)){notice='Fila mudou; journal preservado.';return;}
   localStorage.removeItem(journalKey(id));j=null;
  }
  async function candidate(remote,source,opId){
   const chain=linearConflict(source);if(!chain)return {conflicts:['Fila não linear ou revisão-base ausente']};
   let prior=null,proof=null;
   for(const q of chain.rows){const raw=localStorage.getItem(proofKey(id,q.id));if(!raw)return {conflicts:['Revisão-base anterior não disponível']};const p=JSON.parse(raw);if(!proofMatches(q,p))return {conflicts:['Prova de origem incompatível']};validatePayload(p.payload);if(prior&&p.payload!==prior.payload)return {conflicts:['Cadeia de origens incompatível']};if(!proof)proof=p;prior=q;}
   return (version===2?candidateV2:reconcileCandidate)(remote,source,proof,await sha(proof.payload),opId);
  }
  if(!j){
   const remote=base,result=await candidate(remote,rows,crypto.randomUUID());
   if(!same(id,g)||base!==remote||canonicalQueue(readRows())!==canonicalQueue(rows))return;
   if(!result.operation){notice='Conflito requer revisão: '+result.conflicts.slice(0,5).join('; ');return;}
   j={format:'raytech-test-merge-v2',uid:id,sources:rows,operation:result.operation};
   localStorage.setItem(journalKey(id),JSON.stringify(j));
  }
  const q=j.operation,expected=await sha(q.payload);if(!same(id,g))return;
  if(!Object.hasOwn(base.receipts,q.id)){
   if(canonicalQueue(readRows())!==canonicalQueue(j.sources)){notice='Fila mudou durante a conciliação. Originais preservados.';return;}
   const remote=base;if(remote.revision!==q.expectedRevision||remote.lastOperationId!==q.parentId){notice='Revisão mudou; journal preservado.';return;}
   const rechecked=await candidate(remote,j.sources,q.id);
   if(!same(id,g)||base!==remote||canonicalQueue(readRows())!==canonicalQueue(j.sources))return;
   if(!rechecked.operation||canonical(rechecked.operation)!==canonical(q))throw Error('MERGE_JOURNAL_DIVERGENCE');
   await send(q,id,g,expected);
  }
  const confirmed=await confirmedState(id,g,[q.id]);if(!same(id,g))return;
  if(!confirmed||confirmed.receipts[q.id]!==q.expectedRevision+1+':'+expected)throw Error('MERGE_UNCONFIRMED');
  if(!base||confirmed.revision>=base.revision){continuity(base,confirmed);persist(confirmed,id);base=confirmed;}
  for(const original of j.sources){const k=mergedKey(id,original.id),record=JSON.stringify({operationId:q.id,receipt:confirmed.receipts[q.id]});const prior=localStorage.getItem(k);if(prior!==null&&prior!==record)throw Error('MERGE_ID_REUSE');localStorage.setItem(k,record);}
  for(const original of j.sources){const k=prefix(id)+original.id;if(sameQueued(localStorage.getItem(k),original)){localStorage.removeItem(k);localStorage.removeItem(proofKey(id,original.id));}}
  localStorage.removeItem(journalKey(id));completed=true;ready=true;showPlan();notice='Conciliação automática confirmada. Alterações independentes preservadas.';
 });}catch(e){if(same(id,g)){notice='Conciliação não confirmada: '+e.message+'. Fila e journal preservados.';if(e?.code==='permission-denied')fail(e,id,g);else if(e?.message==='CONFLICT'){ready=false;setTimeout(()=>{if(same(id,g)&&!busy)connect();},3000);}}}
 finally{if(same(id,g)){busy=false;paint();if(completed)schedule();}}
}
async function drain(){
  const id=uid,g=generation;if(!id||!same(id,g)||!ready||!navigator.onLine||busy||recoverBusy||storageFault||denied||routeMismatch)return;
  try{if(budget(id)>=300){notice='Limite preventivo diário deste aparelho. Fila preservada até o próximo dia UTC.';paint();return;}}catch(e){fault(e);return;}
  const p=plan();if(p.kind==='conflict'){if(!dirty&&!modalOpen())await reconcile();return;}if(p.kind!=='ready')return;
  if(dirty||modalOpen()){schedule(1000);return;}
  const q=p.first;busy=true;notice='Enviando operação guardada no dispositivo…';paint();let success=false;
  try{
    const hash=await sha(q.payload);if(!same(id,g))return;
    await send(q,id,g,hash);
    const s=await confirmedState(id,g,[q.id]);if(!same(id,g))return;
    if(!s||s.receipts[q.id]!==q.expectedRevision+1+':'+hash)throw Error('UNCONFIRMED');
    if(!base||s.revision>=base.revision){continuity(base,s);persist(s,id);base=s;}
    await settle(base,id,g);if(!same(id,g))return;ready=true;success=true;showPlan();notice=readRows().length?'Enviando alterações restantes…':'Sincronizado com o servidor.';
  }catch(e){if(!same(id,g))return;if(e?.message==='CONFLICT'){notice='Conflito de revisão. Fila preservada, sem sobrescrever o servidor.';ready=false;}else if(e?.code==='permission-denied'){fail(e,id,g);}else{notice='Envio não confirmado. Fila guardada para nova tentativa.';ready=false;}}
  finally{if(same(id,g)){busy=false;paint();if(success)schedule();else if(navigator.onLine&&!denied&&!storageFault)setTimeout(()=>{if(same(id,g)&&!busy&&!ready)connect();},3000);}}
}
window.raytechCloudSave=function(candidate){
  if(!uid||auth.currentUser?.uid!==uid||!loaded||!authorized||denied||storageFault||routeMismatch||busy||recoverBusy||!view){if(view)appDb=validatePayload(viewPayload);throw Error('Gravação bloqueada');}
  let payload;try{payload=JSON.stringify(candidate);validatePayload(payload);validateBackupDatabase(JSON.parse(payload));if(payload===viewPayload){dirty=false;return;}
    if(hasJournal())throw Error('Conciliação pendente');const q=adaptiveAppend(base,readRows(),view,payload,crypto.randomUUID());
    if(readRows().reduce((n,x)=>n+(localStorage.getItem(proofKey(uid,x.id))?.length??0),0)+viewPayload.length>1250000)throw Error('QUEUE_PROOF_CAPACITY');
    preserveProof(q,viewPayload);put(q);
    viewPayload=payload;view={revision:q.expectedRevision+1,parent:q.id};dirty=false;notice='Alteração fictícia salva neste dispositivo.';paint();schedule();
  }catch(e){appDb=validatePayload(viewPayload);notice='Não gravado: '+e.message;paint();renderAll();alert(notice);throw e;}
};
workspace.addEventListener('input',e=>{if(e.target.closest('form')||['salaryInput','budgetLimitInput'].includes(e.target.id))dirty=true;},true);
for(const ev of ['click','submit','keydown','input','change'])workspace.addEventListener(ev,e=>{if(workspace.inert){e.preventDefault();e.stopImmediatePropagation();}},true);
refresh.addEventListener('click',()=>{if(!uid){location.href='./index.html?mode=local';return;}if((dirty||modalOpen())&&!confirm('Descartar rascunho não enviado? A fila salva será mantida.'))return;dirty=false;dismiss();if(loaded)showPlan();connect();});
retry.addEventListener('click',()=>{if(!ready)connect();else schedule();});
download.addEventListener('click',async()=>{const id=uid,g=generation,rows=readRows();if(!id||!rows.length||busy||recoverBusy||storageFault)return;try{const pack=adaptiveBackup(id,rows),payload=JSON.stringify(version===2?{format:'raytech-active-v2-queue',uid:id,queue:pack}:pack),digest=await sha(payload);if(!same(id,g))return;const a=document.createElement('a'),url=URL.createObjectURL(new Blob([JSON.stringify({payload,sha256:digest})],{type:'application/json'}));a.href=url;a.download='raytech-fila-teste.json';a.click();setTimeout(()=>URL.revokeObjectURL(url),3000);}catch{notice='Não foi possível exportar. Fila preservada.';paint();}});
restore.addEventListener('click',()=>{if(!uid||!authorized||routeMismatch||version===2&&!ready||busy||recoverBusy||readRows().length||hasJournal())return;fileInput.value='';fileInput.click();});
fileInput.addEventListener('change',async()=>{const f=fileInput.files?.[0],id=uid,g=generation;if(!f||!id||!same(id,g)||!authorized||routeMismatch||version===2&&!ready||busy||recoverBusy||storageFault||readRows().length||f.size>5000000)return;recoverBusy=true;paint();
  try{const outer=JSON.parse(await f.text());let rows;if(outer.format==='raytech-test-recovery-v1'){if(version===2)throw Error('Arquivo de fila V1 não pode ser enviado ao V2.');const q=validateRecovery(outer,id);if(await sha(q.payload)!==outer.sha256)throw Error('HASH');rows=[q];}else{if(typeof outer.payload!=='string'||await sha(outer.payload)!==outer.sha256)throw Error('HASH');const decoded=JSON.parse(outer.payload);if(version===2){if(decoded.format!=='raytech-active-v2-queue'||decoded.uid!==id)throw Error('Fila de outro banco.');rows=readAdaptiveBackup(decoded.queue,id);}else rows=readAdaptiveBackup(decoded,id);}
    if(!same(id,g)||!authorized||readRows().length)return;
    const unconfirmed=[];for(const q of rows){if(localStorage.getItem(mergedKey(id,q.id))!==null)throw Error('Operação já conciliada neste aparelho.');const receipt=version===2?await readReceipt(id,q.id):base?.receipts[q.id];if(receipt){if(receipt!==q.expectedRevision+1+':'+await sha(q.payload))throw Error('ID_REUSE');}else unconfirmed.push(q);}
    if(!same(id,g)||!authorized||readRows().length)return;
    if(!unconfirmed.length){notice='Todas as operações já confirmadas; nenhuma duplicação.';return;}
    if(!confirm('Recuperar '+unconfirmed.length+' operação(ões) fictícia(s) desta conta?'))return;
    // Immutable keys: if storage is exhausted, already saved entries remain available and original file unchanged.
    if(unconfirmed.length&&!adaptiveFits(unconfirmed.slice(0,-1),unconfirmed.at(-1)))throw Error('QUEUE_CAPACITY');
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
function makeLegacy(asExcel){if(!uid||auth.currentUser?.uid!==uid||!authorized||!loaded||denied)return;try{const d=legacyFixture(asExcel?'excel':'json');if(asExcel){if(typeof XLSX==='undefined')throw Error('Excel indisponível.');const wb=XLSX.utils.book_new();XLSX.utils.book_append_sheet(wb,XLSX.utils.aoa_to_sheet(legacyRows(d)),'Backup restauracao');XLSX.writeFile(wb,'Raytech_Legado_Teste.xlsx');}else downloadJson(d,'Raytech_Legado_Teste.json');notice='Fixture legada gerada: dezembro/2026, dois lançamentos de R$ 27,25.';paint();}catch(e){notice='Falha ao gerar fixture: '+e.message;paint();}}
legacyJson.addEventListener('click',()=>makeLegacy(false));legacyExcel.addEventListener('click',()=>makeLegacy(true));
function generateRichLegacy(excel){if(!uid||auth.currentUser?.uid!==uid||!authorized||!loaded||denied)return;try{const d=richLegacyFixture();if(excel){if(typeof XLSX==='undefined')throw Error('Excel indisponível.');const wb=XLSX.utils.book_new();XLSX.utils.book_append_sheet(wb,XLSX.utils.aoa_to_sheet(legacyRows(d)),'Backup restauracao');XLSX.writeFile(wb,'Raytech_Legado_Completo_Teste.xlsx');}else downloadJson(d,'Raytech_Legado_Completo_Teste.json');notice='Fixture completa gerada: fevereiro e março/2027, com parcelas e histórico.';paint();}catch(e){notice='Falha ao gerar fixture: '+e.message;paint();}}
richJson.addEventListener('click',()=>generateRichLegacy(false));richExcel.addEventListener('click',()=>generateRichLegacy(true));
importBtn.addEventListener('click',()=>{if(!canMigrate())return;importFile.value='';importFile.click();});
function migrationStillValid(id,g,v,payload){return same(id,g)&&authorized&&ready&&!routeMismatch&&!denied&&!storageFault&&!busy&&!dirty&&!modalOpen()&&!readRows().length&&view?.revision===v.revision&&view?.parent===v.parent&&viewPayload===payload&&v.revision===(base?.revision??0)&&v.parent===(base?.lastOperationId??'');}
let invoiceMonth=null;
function closeInvoice(){invoiceKey.value='';invoicePanel.hidden=true;invoicePanel.open=false;invoiceMonth=null;}
invoiceClose.addEventListener('click',closeInvoice);
invoiceBtn.addEventListener('click',()=>{if(!canMigrate())return;invoiceMonth=appDb.selectedMonth;const ctx=invoiceCanvas.getContext('2d');ctx.fillStyle='#fff';ctx.fillRect(0,0,600,250);ctx.fillStyle='#111827';ctx.font='bold 24px sans-serif';ctx.fillText('RAYTECH — FATURA FICTÍCIA',22,40);ctx.font='17px sans-serif';ctx.fillText('Dados de demonstração, sem banco ou titular',22,70);invoiceFixture(invoiceMonth).forEach((x,i)=>ctx.fillText(x.date+'   '+x.title+'   R$ '+x.amount.toFixed(2).replace('.',','),22,120+i*45));ctx.fillText('TOTAL R$ 80,00',22,218);invoicePanel.hidden=false;invoicePanel.open=true;});
async function analyzeInvoice(real){
 if(!canMigrate()||!invoiceMonth||appDb.selectedMonth!==invoiceMonth)return;
 const id=uid,g=generation,v={...view},before=viewPayload,ym=invoiceMonth,key=real?invoiceKey.value.trim():'';
 invoiceKey.value='';
 if(real&&(!key||!navigator.onLine)){notice='Informe uma chave Gemini de teste e mantenha conexão.';paint();return;}
 if(real&&!confirm('Enviar exclusivamente a imagem fictícia exibida ao Gemini? Sua cota de API pode ser consumida.'))return;
 recoverBusy=true;paint();
 try{
 let rows=invoiceFixture(ym);
 if(real){
   const list=await fetch('https://generativelanguage.googleapis.com/v1beta/models?pageSize=100',{headers:{'x-goog-api-key':key}});
   if(!list.ok)throw Error('Consulta Gemini HTTP '+list.status);
   const body=await list.json(),models=(body.models??[]).filter(m=>/^models\/gemini-[a-zA-Z0-9.-]+$/.test(m.name??'')&&m.supportedGenerationMethods?.includes('generateContent')&&!/image-generation|embedding|tts|audio|live|robotics/i.test(m.name)).sort((a,b)=>Number(!a.name.includes('flash'))-Number(!b.name.includes('flash')));
   if(!models.length)throw Error('Nenhum modelo de geração disponível.');
   if(!migrationStillValid(id,g,v,before))throw Error('Conta ou revisão mudou.');
   const image=invoiceCanvas.toDataURL('image/png').split(',')[1];
   const result=await fetch('https://generativelanguage.googleapis.com/v1beta/'+models[0].name+':generateContent',{method:'POST',headers:{'Content-Type':'application/json','x-goog-api-key':key},body:JSON.stringify({contents:[{role:'user',parts:[{text:'Leia as duas linhas desta fatura fictícia. Retorne somente array JSON de objetos com title, date (YYYY-MM-DD) e amount numérico em reais. Não inclua o total.'},{inlineData:{mimeType:'image/png',data:image}}]}],generationConfig:{responseMimeType:'application/json'}})});
   if(!result.ok)throw Error('Análise Gemini HTTP '+result.status);
   const response=await result.json();rows=JSON.parse(response?.candidates?.[0]?.content?.parts?.[0]?.text??'null');
 }
 if(!migrationStillValid(id,g,v,before))throw Error('Revisão mudou. Nenhuma importação.');
 const outcome=invoiceImport(before,rows,ym);
 if(outcome.conflicts.length)throw Error(outcome.conflicts.join('; '));
 if(!outcome.changed){notice='Fatura já importada. Nenhuma duplicação.';return;}
 if(!confirm((real?'Leitura Gemini conferida.':'Leitura simulada, sem IA.')+' Importar '+outcome.stats.added+' compra(s) fictícia(s), total original R$ 80,00, no cartão de '+ym+'?')){notice='Importação cancelada.';return;}
 const q=adaptiveAppend(base,[],v,outcome.payload,crypto.randomUUID()),journal={format:'raytech-import-undo-v1',uid:id,operationId:q.id,revision:q.expectedRevision+1,before,after:outcome.payload,sha256:await sha(before)};
 if(!migrationStillValid(id,g,v,before))throw Error('Revisão mudou.');
 localStorage.setItem(undoKey(id,q.id),JSON.stringify(journal));enqueueMigration(outcome.payload,q);closeInvoice();
 }catch(e){if(same(id,g))notice='Fatura não importada: '+e.message;}
 finally{if(same(id,g)){recoverBusy=false;paint();schedule();}}
}
invoiceMock.addEventListener('click',()=>analyzeInvoice(false));invoiceAnalyze.addEventListener('click',()=>analyzeInvoice(true));
// V2 uses an independent UID path and never reads or migrates V1 or real account finances.
v2Btn.addEventListener('click',async()=>{
 if(version!==1||!routeAvailable||!base||!canProbeV2()||!confirm('Migrar somente os dados FICTÍCIOS sincronizados? O V1 ficará intacto e bloqueado para novas gravações enquanto V2 estiver ativo. Termine a sincronização nos outros aparelhos antes de continuar.'))return;
 const id=uid,g=generation,source=base,hash=await sha(base.payload);if(!same(id,g)||!canProbeV2()||base!==source)return;
 recoverBusy=true;paint();
 try{
 budget(id,true);const op=crypto.randomUUID();
 const result=await runTransaction(db,async tx=>{
  if(!same(id,g))throw Error('SESSION_CHANGED');
  const old=await tx.get(v1Ref(id)),route=await tx.get(routeRef(id)),head=await tx.get(v2Ref(id));
  if(!old.exists()||route.exists())throw Error('SOURCE_OR_ROUTE_CHANGED');
  const v1=validateEnvelope(old.data());if(v1.revision!==source.revision||v1.lastOperationId!==source.lastOperationId||v1.payload!==source.payload)throw Error('SOURCE_CHANGED');
  const prior=head.exists()?validateV2Head(head.data()):null;
  const candidate=seedMigration(v1,prior,null,op,hash);
  if(!same(id,g)||readRows().length||hasJournal())throw Error('SESSION_OR_QUEUE_CHANGED');
  if(candidate.receipt){tx.set(v2Ref(id),candidate.head);tx.set(receiptRef(id,candidate.receipt.operationId),candidate.receipt);}
  else {const receipt=await tx.get(receiptRef(id,candidate.route.seed));if(!receipt.exists()||canonical(validateV2Receipt(receipt.data()))!==canonical({operationId:candidate.route.seed,revision:1,parentId:'',hash}))throw Error('SEED_RECEIPT');}
  tx.set(routeRef(id),candidate.route);return candidate;
 },{maxAttempts:3});
 const route=await getDocFromServer(routeRef(id)),head=await getDocFromServer(v2Ref(id));
 if(!same(id,g))return;if(!route.exists()||!head.exists())throw Error('MIGRATION_UNCONFIRMED');
 validateRoute(route.data(),source,validateV2Head(head.data()));if(canonical(route.data())!==canonical(result.route))throw Error('ROUTE_DIVERGENCE');
 notice='Migração confirmada. V1 preservado.';selectVersion(2,id);
 }catch(e){if(same(id,g))notice='Migração não confirmada: '+e.message+'. V1 preservado; atualize para conferir o banco ativo.';}
 finally{if(same(id,g)){recoverBusy=false;paint();if(!routeMismatch)connect();}}
});
rollbackBtn.addEventListener('click',async()=>{
 if(version!==2||base?.revision!==1||!canProbeV2()||!confirm('Voltar ao V1? Permitido somente se V2 ainda contiver exatamente a cópia inicial confirmada. Nenhum documento financeiro será excluído.'))return;
 const id=uid,g=generation;recoverBusy=true;paint();
 try{budget(id,true);await runTransaction(db,async tx=>{
  const v1=await tx.get(v1Ref(id)),head=await tx.get(v2Ref(id)),route=await tx.get(routeRef(id));
  if(!same(id,g)||!v1.exists()||!head.exists()||!route.exists()||readRows().length||hasJournal()||!canRollbackV2(validateEnvelope(v1.data()),validateV2Head(head.data()),route.data()))throw Error('ROLLBACK_BLOCKED');
  tx.delete(routeRef(id));
 },{maxAttempts:3});if(!same(id,g))return;const route=await getDocFromServer(routeRef(id));if(route.exists())throw Error('ROLLBACK_UNCONFIRMED');selectVersion(1,id);}
 catch(e){if(same(id,g))notice='Reversão bloqueada: '+e.message;}
 finally{if(same(id,g)){recoverBusy=false;paint();connect();}}
});
switchBtn.addEventListener('click',()=>{if(!uid||!routeMismatch||!routeObserved||busy||recoverBusy)return;if(confirm('Abrir banco ativo? A fila do banco anterior ficará arquivada neste aparelho, sem ser enviada ou excluída. Salve o arquivo de recuperação antes.'))selectVersion(routeObserved,uid);});
function enqueueMigration(payload,q){put(q);showPayload(payload,q.expectedRevision+1,q.id);notice='Operação salva. Aguardando confirmação do servidor.';paint();schedule();}
importFile.addEventListener('change',async()=>{
 const file=importFile.files?.[0],id=uid,g=generation;if(!file||!canMigrate())return;if(file.size>2000000){notice='Arquivo excede o limite de 2 MB.';paint();return;}
 const v={...view},before=viewPayload;recoverBusy=true;paint();
 try{
 let pack,legacy=false;if(file.name.toLowerCase().endsWith('.xlsx')){if(typeof XLSX==='undefined')throw Error('Biblioteca Excel indisponível.');const wb=XLSX.read(await file.arrayBuffer(),{type:'array',sheetRows:10});let ws=wb.Sheets['Raytech Teste'];if(!ws){ws=wb.Sheets['Backup restauracao'];legacy=true;}if(!ws||!ws['!ref'])throw Error('Aba de backup ausente.');const range=XLSX.utils.decode_range(ws['!ref']);if(range.s.r!==0||range.s.c!==0||range.e.r>8||range.e.c!==4||Object.keys(ws).some(k=>!k.startsWith('!')&&ws[k]?.f))throw Error('Estrutura Excel inválida.');const rows=XLSX.utils.sheet_to_json(ws,{header:1,raw:true,defval:null,blankrows:true});if(legacy){const payload=readLegacyRows(rows);pack=backupPack(payload,await sha(payload));}else pack=readPackRows(rows);}
 else if(file.name.toLowerCase().endsWith('.json')){const raw=JSON.parse(await file.text());if(raw?.format==='raytech-synthetic-backup-v1')pack=validateBackupPack(raw);else{const payload=validateLegacyFixture(JSON.stringify(raw));pack=backupPack(payload,await sha(payload));legacy=true;}}else throw Error('Formato não permitido.');
 if(await sha(pack.payload)!==pack.sha256)throw Error('Checksum SHA-256 divergente.');
 if(!migrationStillValid(id,g,v,before))throw Error('Revisão mudou. Reabra a importação.');
 const result=mergeImport(before,pack.payload);
 if(result.conflicts.length){notice='Importação bloqueada: '+result.conflicts.slice(0,8).join('; ');details.open=true;return;}
 if(!result.changed){notice='Nenhuma alteração: '+result.stats.duplicates+' duplicata(s), '+result.stats.skippedDeleted+' parcela(s) excluída(s) preservada(s).';return;}
 const st=result.stats;
 if(!confirm((legacy?'Fixture legada conhecida (sem checksum original).':'Backup FICTÍCIO validado.')+'\n'+st.added+' lançamento(s) novo(s), '+st.months+' mês(es) novo(s), '+st.duplicates+' duplicata(s), '+st.skippedDeleted+' parcela(s) excluída(s) ignorada(s), '+st.filled+' saldo(s)/limite(s) preenchido(s), '+st.kept+' campo(s) atual(is) preservado(s).\nConfirma a importação sem substituir os lançamentos atuais?')){notice='Importação cancelada. Banco intacto.';return;}
 const q=adaptiveAppend(base,[],v,result.payload,crypto.randomUUID());const journal={format:'raytech-import-undo-v1',uid:id,operationId:q.id,revision:q.expectedRevision+1,before,after:result.payload,sha256:await sha(before)};
 if(!migrationStillValid(id,g,v,before))throw Error('Revisão mudou antes da gravação.');
 localStorage.setItem(undoKey(id,q.id),JSON.stringify(journal));enqueueMigration(result.payload,q);
 }catch(e){if(same(id,g))notice='Importação não concluída: '+e.message+' Confira o status; nenhuma sobrescrita foi autorizada.';}
 finally{if(same(id,g)){recoverBusy=false;importFile.value='';paint();schedule();}}
});
undoBtn.addEventListener('click',async()=>{
 if(!canMigrate())return;const id=uid,g=generation,v={...view},before=viewPayload,j=currentUndo();if(!j)return;
 if(!confirm('Desfazer esta importação? O estado anterior será gravado como uma nova revisão. Só é permitido se nenhuma mudança ocorreu depois.'))return;recoverBusy=true;paint();
 try{if(await sha(j.before)!==j.sha256)throw Error('Cópia anterior inválida.');if(!migrationStillValid(id,g,v,before))throw Error('Revisão mudou. Reversão bloqueada.');const q=adaptiveAppend(base,[],v,j.before,crypto.randomUUID());enqueueMigration(j.before,q);}
 catch(e){if(same(id,g))notice='Reversão bloqueada: '+e.message;}
 finally{if(same(id,g)){recoverBusy=false;paint();schedule();}}
});
compareBtn.addEventListener('click',()=>{if(!ready||busy||recoverBusy||plan().kind!=='conflict')return;try{const rows=readRows(),remote=base?.payload??JSON.stringify(blank(getTodayYM())),branches=conflictBranches(rows);const lines=branches.flatMap((q,i)=>['Ramo '+(i+1)+' · revisão-base '+q.expectedRevision+' · '+q.id,...snapshotDiff(remote,q.payload)]);conflictReport.textContent='Servidor x '+branches.length+' ramo(s) da fila (sem mesclagem automática):\n'+(lines.slice(0,120).join('\n')||'Revisão incompatível.')+(lines.length>120?'\nOutras diferenças no arquivo da fila.':'')+'\nExporte a fila antes de descartar. Revise e reaplique manualmente os lançamentos desejados.';conflictReport.hidden=false;}catch(e){notice='Comparação indisponível: '+e.message;paint();}});
discard.addEventListener('click',()=>{const id=uid,g=generation,rows=readRows();if(!id||!same(id,g)||!ready||busy||recoverBusy||plan().kind!=='conflict'||hasJournal())return;if(!confirm('Descartar TODA a fila fictícia em conflito? Exporte-a antes. O servidor não será alterado.'))return;
  if(hasJournal()||plan().kind!=='conflict'||canonicalQueue(readRows())!==canonicalQueue(rows)){notice='Fila mudou em outro separador. Revise novamente.';paint();return;}
  try{for(const q of rows){const k=prefix(id)+q.id;if(sameQueued(localStorage.getItem(k),q)){localStorage.removeItem(k);localStorage.removeItem(proofKey(id,q.id));}}showPlan();notice='Fila descartada por confirmação do usuário.';paint();}catch(e){fault(e);}});
leave.addEventListener('click',e=>{if((dirty||modalOpen())&&!confirm('Sair sem salvar o rascunho? A fila já gravada será preservada.')){e.preventDefault();return;}dirty=false;dismiss();try{localStorage.removeItem(preference);}catch{}});
window.addEventListener('beforeunload',e=>{if(dirty||modalOpen()){e.preventDefault();e.returnValue='';}});
window.addEventListener('pageshow',e=>{if(e.persisted)location.reload();});
onAuthStateChanged(auth,async user=>{
  const g=++generation;++epoch;++serial;if(unsub)unsub();unsub=null;if(routeUnsub)routeUnsub();routeUnsub=null;routeMismatch=false;routeAvailable=false;routeObserved=null;version=1;if(timer!==null)clearTimeout(timer);timer=null;uid=null;base=null;busy=false;recoverBusy=false;dirty=false;denied=false;storageFault=false;scrub();
  if(!user||!/^[a-zA-Z0-9_-]{1,128}$/.test(user.uid)){notice='Entre com Google no aplicativo local. Nenhum banco de outra conta será aberto.';paint();return;}
  const id=uid=user.uid;
  try{version=localStorage.getItem(routeKey(id))==='2'?2:1;const raw=localStorage.getItem(checkpoint(id));if(raw!==null){const c=JSON.parse(raw);if(c.format!=='raytech-test-checkpoint-v1'||c.uid!==id||!Object.hasOwn(c,'state'))throw Error('CHECKPOINT');const s=await verify(c.state);if(!same(id,g))return;base=s;authorized=true;if(version===1)await settle(base,id,g);if(!same(id,g))return;showPlan();notice='Banco fictício recuperado neste dispositivo.';paint();}}
  catch(e){if(same(id,g))fault(e);}
  if(same(id,g))connect();
});
window.addEventListener('offline',()=>{++serial;ready=false;notice='Sem internet. Continue registrando; alterações serão guardadas localmente.';paint();});
window.addEventListener('online',()=>{if(uid&&!busy)connect();});
document.addEventListener('visibilitychange',()=>{if(!document.hidden&&uid&&!busy&&navigator.onLine){if(!ready)connect();else schedule();}});
window.addEventListener('storage',e=>{if(!uid||!(e.key===null||e.key.startsWith(prefix(uid))||e.key===checkpoint(uid)||e.key===journalKey(uid)||e.key===routeKey(uid)))return;if(dirty||modalOpen()||busy){notice='Outro separador alterou o armazenamento. Seu rascunho não será sobrescrito.';paint();return;}const p=plan();if(loaded&&p.kind==='ready')showPlan(p);if(navigator.onLine&&!busy)connect();else paint();});
if('serviceWorker' in navigator)navigator.serviceWorker.register('./sw.js',{updateViaCache:'none'}).then(reg=>reg.update()).catch(()=>{notice='Cache offline indisponível neste navegador.';paint();});
paint();
}
if(window.raytechCloudUiReady)startCloud();else window.addEventListener('DOMContentLoaded',startCloud,{once:true});
