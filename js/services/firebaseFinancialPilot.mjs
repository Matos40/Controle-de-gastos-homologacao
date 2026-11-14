/* Only synthetic preset values. Never reads appDb, PIN, Gemini or existing financial storage. */
import { getFirestore, doc, getDocFromServer, onSnapshot, runTransaction } from 'https://www.gstatic.com/firebasejs/11.10.0/firebase-firestore.js';
import { slots, initial, validate, validId, intent, apply, balance } from './firebaseFinancialPilotModel.mjs';
export function mountPilot(app, auth, onAuthStateChanged) {
  const root=document.getElementById('financialPilotPanel');
  if (!root) return;
  const host=location.hostname, path=location.pathname;
  if(app.options.projectId!=='raytech-cg-homologacao'|| !((host==='matos40.github.io'&&path.startsWith('/Controle-de-gastos-homologacao/'))||host==='raytech-cg-homologacao.firebaseapp.com')){root.textContent='Piloto bloqueado fora da homologação.';return;}
  const db=getFirestore(app);
  let uid=null, generation=0, unsub=null, state=null, ready=false, busy=false, notice='', storageOK=true;
  const make=(tag,text)=>{const el=document.createElement(tag);if(text!==undefined)el.textContent=text;return el;};
  const money=x=>(x/100).toLocaleString('pt-BR',{style:'currency',currency:'BRL'});
  const same=(id,g)=>uid===id&&auth.currentUser?.uid===id&&generation===g;
  const ref=id=>doc(db,'raytechSyncPilotV1',id);
  const access=id=>doc(db,'raytechSyncPilotAccessV1',id);
  const prefix=id=>'raytech_sync_pilot_pending_v1:'+id+':';
  function pending(){
    if(!uid)return [];
    try{
      const pre=prefix(uid), rows=[];
      for(let i=0;i<localStorage.length;i++){
        const key=localStorage.key(i);if(!key?.startsWith(pre))continue;
        const q=JSON.parse(localStorage.getItem(key));intent(q);
        if(key!==pre+q.id)throw Error('INVALID_PENDING');
        rows.push(q);
      }
      return rows.sort((a,b)=>a.expectedRevision-b.expectedRevision||a.id.localeCompare(b.id));
    }catch{storageOK=false;return [];}
  }
  function settleConfirmed(s,id){
    for(const q of pending()){
      if(Object.hasOwn(s.receipts,q.id)){
        if(s.receipts[q.id]!==intent(q)){storageOK=false;notice='Identificador divergente. Novas gravações bloqueadas.';return;}
        try{localStorage.removeItem(prefix(id)+q.id);}catch{storageOK=false;}
      }
    }
  }
  function button(label,fn,disabled=false){const b=make('button',label);b.type='button';b.className='bg-cyan-800 hover:bg-cyan-700 rounded-lg px-3 py-2 text-xs font-bold text-white disabled:opacity-50';b.disabled=disabled;b.addEventListener('click',fn);return b;}
  function render(){
    root.replaceChildren();
    const title=make('h3','Finanças na nuvem — somente teste');title.className='font-bold text-cyan-300';root.append(title);
    const info=make('p','Use apenas os valores fictícios oferecidos. Nenhum saldo ou lançamento do aplicativo local é lido ou enviado.');info.className='text-xs text-amber-200';root.append(info);
    if(uid){const id=make('p','UID de teste: '+uid);id.className='text-xs break-all text-slate-400';root.append(id);}
    const status=make('p',notice||(!uid?'Entre com Google para começar.':!ready?'Aguardando servidor.':'Sincronizado com o servidor.'));status.setAttribute('role','status');status.className='text-xs text-cyan-200';root.append(status);
    const rows=pending();
    if(!storageOK){root.append(make('p','Armazenamento de operações indisponível. Gravações bloqueadas.'));return;}
    if(!state||!uid)return;
    root.append(make('p','Revisão confirmada: '+state.revision+' / 100'));
    const totals=make('p','Saldo fictício: '+money(balance(state)));totals.className='text-lg font-bold text-white';root.append(totals);
    const disabled=!ready||busy||rows.length>0||state.revision>=100;
    for(const [key,slot] of Object.entries(slots)){
      const line=make('div');line.className='border border-slate-700 rounded-xl p-2 space-y-2';
      line.append(make('p',slot.label+' · '+money(state[key])));
      const select=make('select');select.className='bg-slate-900 text-white rounded p-2 w-full text-xs';select.setAttribute('aria-label',slot.label);select.disabled=disabled;
      for(const n of slot.values){const option=make('option',n===0?'R$ 0,00 / remover':money(n));option.value=String(n);select.append(option);}
      select.value=String(state[key]);const rev=state.revision;
      line.append(select,button('Salvar valor',()=>start(key,Number(select.value),rev),disabled));
      if(slot.paid&&state[key]>0)line.append(button(state[slot.paid]?'Marcar não pago':'Marcar pago',()=>start(slot.paid,!state[slot.paid],rev),disabled));
      root.append(line);
    }
    if(rows.length){
      const q=rows[0];
      root.append(make('p','Operação pendente: '+q.key+' / revisão '+q.expectedRevision+'. Novos lançamentos estão bloqueados até resolver.'));
      root.append(button('Consultar / tentar mesma operação',()=>execute(q),!ready||busy));
      if(ready&&state.revision>q.expectedRevision&&!Object.hasOwn(state.receipts,q.id)){root.append(button('Descartar conflito e revisar',()=>{
        if(!ready||busy||!state||state.revision<=q.expectedRevision||Object.hasOwn(state.receipts,q.id)||!auth.currentUser||auth.currentUser.uid!==uid)return;
        if(!confirm('A revisão mudou e a operação antiga não pode ser aplicada. Descartar apenas a intenção fictícia local?'))return;
        try{localStorage.removeItem(prefix(uid)+q.id);notice='Conflito descartado. Revise os valores confirmados antes de gravar.';}catch{storageOK=false;}
        render();
      },busy));}
    }
  }
  async function start(key,value,rev){
    if(!uid||!ready||busy||!state||!storageOK||state.revision!==rev||auth.currentUser?.uid!==uid||pending().length||!storageOK)return;
    const q={id:crypto.randomUUID(),key,value,expectedRevision:rev};
    try{intent(q);localStorage.setItem(prefix(uid)+q.id,JSON.stringify(q));}catch{storageOK=false;notice='Não foi possível guardar a intenção local. Nada enviado.';render();return;}
    await execute(q);
  }
  async function execute(q){
    const id=uid, g=generation;
    if(!id||!same(id,g)||busy||!ready||!storageOK)return;
    busy=true;notice='Confirmando com o servidor…';render();
    try{
      await runTransaction(db,async tx=>{
        if(!same(id,g))throw Error('SESSION_CHANGED');
        const snap=await tx.get(ref(id));
        if(!same(id,g))throw Error('SESSION_CHANGED');
        const old=snap.exists()?validate(snap.data()):initial();
        const result=apply(old,q);
        if(!result.replay)tx.set(ref(id),result.state);
      });
      const final=await getDocFromServer(ref(id));
      if(!same(id,g))return;
      if(!final.exists())throw Error('UNCONFIRMED');
      const next=validate(final.data());
      if(next.receipts[q.id]!==intent(q))throw Error('UNCONFIRMED');
      if(!state||next.revision>=state.revision)state=next;
      settleConfirmed(state,id);
      notice='Operação confirmada. Confira no outro aparelho.';
    }catch(err){
      if(!same(id,g))return;
      notice=err?.message==='CONFLICT'?'Conflito: outro aparelho alterou os dados. Revise ou descarte a intenção antiga.':err?.code==='permission-denied'?'Permissão negada. A intenção permanece local.':'Confirmação não concluída. A intenção foi preservada; consulte a mesma operação.';
    }finally{if(same(id,g)){busy=false;render();}}
  }
  onAuthStateChanged(auth,async user=>{
    const g=++generation;if(unsub)unsub();unsub=null;uid=null;state=null;ready=false;busy=false;storageOK=true;notice='';
    if(!user||!/^[A-Za-z0-9_-]{1,128}$/.test(user.uid)){render();return;}
    uid=user.uid;const id=uid;notice='Verificando autorização do piloto…';render();
    try{
      const allowed=await getDocFromServer(access(id));if(!same(id,g))return;
      if(!allowed.exists()||allowed.data().enabled!==true){notice='Piloto ainda não habilitado para esta conta. Nenhum dado foi enviado.';render();return;}
      unsub=onSnapshot(ref(id),{includeMetadataChanges:true},snap=>{
        if(!same(id,g))return;
        if(snap.metadata.fromCache||snap.metadata.hasPendingWrites){ready=false;notice='Sem confirmação atual do servidor. Gravações bloqueadas.';render();return;}
        try{const next=snap.exists()?validate(snap.data()):initial();if(state&&next.revision<state.revision)throw Error('REVISION_ROLLBACK');state=next;ready=true;settleConfirmed(state,id);if(!busy)notice='Sincronizado com o servidor.';}catch{state=null;ready=false;notice='Estado inválido ou revisão regressiva. Gravações bloqueadas.';}
        render();
      },()=>{if(same(id,g)){ready=false;state=null;notice='Sem acesso ao piloto. Confira as regras e a autorização.';render();}});
    }catch{if(same(id,g)){notice='Piloto não autorizado ou servidor indisponível. Nenhum dado enviado.';render();}}
  });
  window.addEventListener('offline',()=>{ready=false;notice='Sem internet. Valores confirmados preservados; gravações bloqueadas.';render();});
  window.addEventListener('storage',e=>{if(uid&&e.key?.startsWith(prefix(uid)))render();});
  render();
}
