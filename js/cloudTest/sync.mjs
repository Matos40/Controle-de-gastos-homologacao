/* Integrated synthetic app; separate page and data store, no production/local financial reads. */
import {initializeApp} from 'https://www.gstatic.com/firebasejs/11.10.0/firebase-app.js';
import {getAuth,onAuthStateChanged} from 'https://www.gstatic.com/firebasejs/11.10.0/firebase-auth.js';
import {getFirestore,doc,onSnapshot,getDocFromServer,runTransaction} from 'https://www.gstatic.com/firebasejs/11.10.0/firebase-firestore.js';
import {blank,validatePayload,validId,validateEnvelope,apply} from './model.mjs';
const firebaseConfig = Object.freeze({
  apiKey: 'AIzaSyAlOok-2bV9QigR6PyjRgHMLjFLIoPDWpw',
  authDomain: 'raytech-cg-homologacao.firebaseapp.com',
  projectId: 'raytech-cg-homologacao',
  storageBucket: 'raytech-cg-homologacao.firebasestorage.app',
  messagingSenderId: '195471491370',
  appId: '1:195471491370:web:b7e5a0a5a218d16f7a9e53'
});
const host=location.hostname,path=location.pathname;
if(!((host==='matos40.github.io'&&path==='/Controle-de-gastos-homologacao/cloud-test.html')||(host==='raytech-cg-homologacao.firebaseapp.com'&&path==='/cloud-test.html')))throw Error('Homologation only');
const app=initializeApp(firebaseConfig),auth=getAuth(app),db=getFirestore(app);
function startCloud(){
const workspace=document.getElementById('cloudWorkspace'),status=document.getElementById('cloudStatus'),btnRefresh=document.getElementById('cloudRefresh'),btnRetry=document.getElementById('cloudRetry'),btnDownload=document.getElementById('cloudDownload'),btnDiscard=document.getElementById('cloudDiscard');
const ref=id=>doc(db,'raytechFinancialTestV1',id);
const access=id=>doc(db,'raytechSyncPilotAccessV1',id);
const prefix=id=>'raytech_financial_test_pending_v1:'+id+':';
const same=(id,g)=>uid===id&&generation===g&&auth.currentUser?.uid===id;
const sha=async p=>Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(p))),b=>b.toString(16).padStart(2,'0')).join('');
let uid=null,generation=0,unsub=null,confirmed=null,viewRevision=0,ready=false,busy=false,dirty=false,loaded=false,storageFault=false,deferred=null,hasDeferred=false,notice='Aguardando conta Google…',snapshotSerial=0;
let viewPayload=JSON.stringify(blank(getTodayYM()));
function listPending(){
  if(!uid)return [];
  try{const rows=[],pre=prefix(uid);for(let i=0;i<localStorage.length;i++){const key=localStorage.key(i);if(!key?.startsWith(pre))continue;const q=JSON.parse(localStorage.getItem(key));if(!q||key!==pre+q.id||!validId(q.id)||!Number.isInteger(q.expectedRevision)||q.expectedRevision<0||q.expectedRevision>=500)throw Error('PENDING');validatePayload(q.payload);rows.push(q);}return rows.sort((a,b)=>a.expectedRevision-b.expectedRevision||a.id.localeCompare(b.id));}catch{storageFault=true;return [];}
}
function modalOpen(){return ['confirmModal','editExpenseModal','editCardModal','incomeModal'].some(id=>!document.getElementById(id)?.classList.contains('hidden'));}
function paint(){
  const rows=listPending(),q=rows[0],blocked=!loaded||!ready||busy||!!q||storageFault||(confirmed?.revision??0)>=500;
  workspace.style.display=loaded?'':'none';workspace.inert=blocked;workspace.setAttribute('aria-busy',String(blocked));window.raytechCloudPending=busy||!!q;
  status.textContent=notice+(loaded?' · revisão '+viewRevision+' / 500':'')+(q?' · intenção local pendente':'')+(storageFault?' · armazenamento local inválido, gravações bloqueadas':'');
  btnRetry.hidden=!q;btnRetry.disabled=busy||!ready||storageFault;
  btnDownload.hidden=!q;btnDiscard.hidden=!(q&&ready&&!busy&&(confirmed?.revision??0)>q.expectedRevision&&!Object.hasOwn(confirmed?.receipts??{},q.id));btnRefresh.disabled=busy;
}
function show(s){
  viewPayload=s?s.payload:JSON.stringify(blank(getTodayYM()));viewRevision=s?.revision??0;appDb=validatePayload(viewPayload);
  pendingModalAction=null;for(const id of ['confirmModal','editExpenseModal','editCardModal','incomeModal'])document.getElementById(id)?.classList.add('hidden');
  updateMonthHeader();renderAll();loaded=true;dirty=false;hasDeferred=false;deferred=null;
}
function scrub(){
  loaded=false;ready=false;workspace.style.display='none';workspace.inert=true;appDb=blank(getTodayYM());pendingModalAction=null;
  for(const f of workspace.querySelectorAll('form'))f.reset();
  for(const e of workspace.querySelectorAll('input:not([type=radio]):not([type=checkbox]):not([type=file]),textarea'))e.value='';
  document.activeElement?.blur?.();updateMonthHeader();renderAll();
}
async function verify(s){if(!s)return null;validateEnvelope(s);if(s.receipts[s.lastOperationId]!==s.revision+':'+await sha(s.payload))throw Error('PAYLOAD_HASH_MISMATCH');return s;}
async function settle(s,id,g){
  for(const q of listPending()){if(!s||!Object.hasOwn(s.receipts,q.id))continue;const h=await sha(q.payload);if(!same(id,g))return;if(s.receipts[q.id]!==q.expectedRevision+1+':'+h){storageFault=true;throw Error('ID_REUSE');}localStorage.removeItem(prefix(id)+q.id);}
}
async function accept(s,id,g,serial){
  await verify(s);if(!same(id,g)||serial!==snapshotSerial)return;
  if(confirmed&&(s?.revision??0)<confirmed.revision)throw Error('REVISION_ROLLBACK');
  if(confirmed&&s&&s.revision===confirmed.revision&&s.receipts[s.lastOperationId]!==confirmed.receipts[confirmed.lastOperationId])throw Error('REVISION_DIVERGENCE');
  confirmed=s;await settle(s,id,g);if(!same(id,g)||serial!==snapshotSerial)return;
  ready=true;const rows=listPending();
  if(!loaded){show(s);}
  else if(!busy&&!rows.length&&(s?.revision??0)!==viewRevision){
    if(dirty||modalOpen()){hasDeferred=true;deferred=s;notice='Outro aparelho alterou os dados. Seu rascunho foi mantido; atualizar descartará o rascunho, salvar uma revisão antiga gera conflito.';paint();return;}
    show(s);
  }
  if(!busy)notice=rows.length?'Intenção pendente. Consulte ou resolva antes de continuar.':hasDeferred?'Outro aparelho alterou os dados. Atualize ou resolva seu rascunho antes de continuar.':'Sincronizado com o servidor.';
  paint();
}
function failed(err,id,g){if(!same(id,g))return;ready=false;notice=err?.code==='permission-denied'?'Acesso negado. Confira as regras do Firestore de homologação.':'Servidor indisponível ou dados inválidos. Gravações bloqueadas.';paint();}
async function connect(id,g){
  ++snapshotSerial;if(unsub)unsub();unsub=null;ready=false;notice='Verificando autorização e servidor…';paint();
  try{const a=await getDocFromServer(access(id));if(!same(id,g))return;if(!a.exists()||a.data().enabled!==true){notice='Conta ainda não autorizada para o teste.';paint();return;}
    unsub=onSnapshot(ref(id),{includeMetadataChanges:true},snap=>{
      if(!same(id,g))return;const serial=++snapshotSerial;
      if(snap.metadata.fromCache||snap.metadata.hasPendingWrites){ready=false;notice='Aguardando confirmação atual do servidor.';paint();return;}
      accept(snap.exists()?snap.data():null,id,g,serial).catch(e=>{if(serial===snapshotSerial)failed(e,id,g);});
    },e=>failed(e,id,g));
  }catch(e){failed(e,id,g);}
}
async function execute(q){
  const id=uid,g=generation;if(!id||!same(id,g)||busy||!ready||storageFault)return;
  busy=true;notice='Enviando alteração fictícia; aguardando confirmação…';paint();
  try{
    const hash=await sha(q.payload);if(!same(id,g))return;
    await runTransaction(db,async tx=>{
      if(!same(id,g))throw Error('SESSION_CHANGED');const snap=await tx.get(ref(id));if(!same(id,g))throw Error('SESSION_CHANGED');
      const old=snap.exists()?await verify(snap.data()):null;if(!same(id,g))throw Error('SESSION_CHANGED');
      const result=apply(old,q,hash);if(!result.replay)tx.set(ref(id),result.state);
    });
    const snap=await getDocFromServer(ref(id));if(!same(id,g))return;const s=await verify(snap.exists()?snap.data():null);if(!same(id,g))return;
    if(!s||s.receipts[q.id]!==q.expectedRevision+1+':'+hash)throw Error('UNCONFIRMED');
    if(!confirmed||s.revision>=confirmed.revision)confirmed=s;
    await settle(confirmed,id,g);if(!same(id,g))return;
    show(confirmed);ready=true;notice='Sincronizado com o servidor. Operação confirmada.';
  }catch(e){
    if(!same(id,g))return;
    notice=e?.message==='CONFLICT'?'Conflito de revisão: sua intenção foi preservada. Nenhum dado remoto foi sobrescrito.':e?.code==='permission-denied'?'Permissão negada. Intenção preservada.':'Não foi possível confirmar. Intenção preservada para repetir sem duplicar.';
  }finally{if(same(id,g)){busy=false;paint();}}
}
window.raytechCloudSave=function(candidate){
  const rows=listPending();
  if(!uid||auth.currentUser?.uid!==uid||!loaded||!ready||busy||rows.length||storageFault||(confirmed?.revision??0)>=500){appDb=validatePayload(viewPayload);paint();throw Error('Nuvem não disponível para gravação.');}
  let payload;
  try{payload=JSON.stringify(candidate);validatePayload(payload);validateBackupDatabase(JSON.parse(payload));}catch(e){appDb=validatePayload(viewPayload);notice=e.message;paint();renderAll();alert(notice);throw e;}
  if(payload===viewPayload)return;
  const q={id:crypto.randomUUID(),expectedRevision:viewRevision,payload};
  try{localStorage.setItem(prefix(uid)+q.id,JSON.stringify(q));}catch(e){appDb=validatePayload(viewPayload);storageFault=true;notice='Não foi possível guardar a operação. Nada enviado.';paint();renderAll();throw e;}
  dirty=false;execute(q);
};
workspace.addEventListener('input',e=>{if(e.target.closest('form')||['salaryInput','budgetLimitInput'].includes(e.target.id))dirty=true;},true);
for(const ev of ['click','submit','keydown','input','change'])workspace.addEventListener(ev,e=>{if(workspace.inert){e.preventDefault();e.stopImmediatePropagation();}},true);
btnRefresh.addEventListener('click',()=>{
  if(!uid){location.href='./index.html';return;}
  if((dirty||modalOpen())&&!confirm('Descartar o rascunho não enviado e carregar os dados confirmados?'))return;
  if(dirty||modalOpen()){
    for(const id of ['expenseForm','cardExpenseForm','editExpenseForm','editCardForm','incomeForm'])document.getElementById(id)?.reset();
    if(document.activeElement===salaryInput||document.activeElement?.id==='budgetLimitInput'){document.activeElement.value='';}
  }
  if(hasDeferred){show(deferred);notice='Revisão remota carregada.';paint();}
  else if(dirty||modalOpen()){show(confirmed);}
  connect(uid,generation);
});
btnRetry.addEventListener('click',()=>{const q=listPending()[0];if(q)execute(q);});
btnDownload.addEventListener('click',()=>{const q=listPending()[0];if(!q)return;const a=document.createElement('a'),url=URL.createObjectURL(new Blob([q.payload],{type:'application/json'}));a.href=url;a.download='raytech-intencao-ficticia.json';a.click();setTimeout(()=>URL.revokeObjectURL(url),3000);});
btnDiscard.addEventListener('click',()=>{const q=listPending()[0];if(!q||!ready||busy||!uid||auth.currentUser?.uid!==uid||(confirmed?.revision??0)<=q.expectedRevision||Object.hasOwn(confirmed?.receipts??{},q.id))return;if(!confirm('Descartar apenas esta intenção fictícia desatualizada? Os dados no servidor serão preservados.'))return;try{localStorage.removeItem(prefix(uid)+q.id);show(confirmed);notice='Conflito descartado. Revise e refaça o lançamento se necessário.';}catch{storageFault=true;}paint();});
onAuthStateChanged(auth,user=>{
  const g=++generation;++snapshotSerial;if(unsub)unsub();unsub=null;uid=null;confirmed=null;busy=false;dirty=false;hasDeferred=false;storageFault=false;scrub();
  if(!user||!/^[a-zA-Z0-9_-]{1,128}$/.test(user.uid)){notice='Entre com Google no aplicativo local e volte a este modo.';paint();return;}
  uid=user.uid;connect(uid,g);
});
window.addEventListener('offline',()=>{ready=false;notice='Sem internet. Gravações bloqueadas; operações pendentes preservadas.';paint();});
window.addEventListener('online',()=>{if(uid&&!busy)connect(uid,generation);});
window.addEventListener('storage',e=>{if(uid&&e.key?.startsWith(prefix(uid)))paint();});
paint();

}
if(window.raytechCloudUiReady)startCloud();else window.addEventListener('DOMContentLoaded',startCloud,{once:true});
