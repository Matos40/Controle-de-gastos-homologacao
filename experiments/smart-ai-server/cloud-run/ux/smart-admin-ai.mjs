import {budgetLevel} from './budget.mjs';
const counts=[
 ['reserved','Leituras admitidas'],['completed','Extrações concluídas'],
 ['failed','Falhas'],['pending','Reservas pendentes'],['failed','Créditos restituídos'],
];
const number=new Intl.NumberFormat('pt-BR');
const currency=new Intl.NumberFormat('pt-BR',{style:'currency',currency:'BRL'});
const messages={ACCESS_DENIED:'Acesso reservado à administração.',
 VERSION_CONFLICT:'As configurações foram alteradas em outra sessão. Revise os valores atualizados.',
 NOT_FOUND:'O perfil não tem saldo disponível para consulta.',INVALID_REQUEST:'Confira os valores informados.'};

export function googleOwnerReauthentication(auth,provider,reauthenticateWithPopup){
 return async()=>{
  const user=auth.currentUser;
  if(!user)throw Error('REAUTH_REQUIRED');
  const result=await reauthenticateWithPopup(user,provider);
  if(result.user.uid!==user.uid||auth.currentUser?.uid!==user.uid)throw Error('REAUTH_REQUIRED');
  return result.user.getIdToken(true);
 };
}

export function mountSmartAdminAI(root,{getIdToken,reauthenticate,fetcher=fetch}){
 root.innerHTML=`
  <section class="raytech-ai raytech-ai-admin" aria-label="Smart Admin AI">
   <header class="raytech-ai__header"><h1>Smart Admin AI</h1><button type="button" data-reload>Atualizar indicadores</button></header>
   <p role="status" aria-live="polite" data-status></p>
   <div data-content hidden>
    <div class="raytech-ai-admin__metrics">
     <article><h2>Hoje</h2><dl data-day></dl></article>
     <article><h2>Este mês</h2><dl data-month></dl></article>
    </div>
    <p data-conversions></p><p data-average></p>
    <form data-search><label for="ai-admin-prefix">Pesquisar por nome, e-mail ou UID</label>
     <input id="ai-admin-prefix" required minlength="2" maxlength="128" >
     <button type="submit">Pesquisar</button></form>
    <ul data-users></ul><p data-credit aria-live="polite"></p>
    <p data-admission></p><p data-audit></p>
    <article aria-label="Proteção financeira Smart AI">
     <h2>Proteção financeira Smart AI</h2>
     <p data-finance></p><p data-finance-observed></p>
     <div data-budget-meter hidden><progress max="100" aria-label="Utilização do orçamento"></progress>
     <p data-budget-level></p></div><small>Alertas: 25% · 50% · 75% · 100%. O orçamento não é um teto de cobrança.</small><p data-security></p>
     <details><summary>Histórico de alertas</summary><ul data-alerts></ul></details>
     <form data-reactivate hidden>
      <label><input type="checkbox" required> Revisei o faturamento e confirmo a reativação</label>
      <button type="submit">Reautenticar e reativar</button>
     </form>
    </article>
    <form data-config hidden>
     <label><input name="enabled" type="checkbox"> Aceitar novas leituras de IA</label>
     <div class="raytech-ai-admin__metrics">
      <label>Limite diário (UTC)<input name="day" type="number" min="1" max="30" required></label>
      <label>Limite mensal (UTC)<input name="month" type="number" min="1" max="60" required></label>
     </div>
     <button type="submit">Salvar configuração</button> <button type="button" data-emergency>Suspender novas leituras</button>
    </form>
    <h2>Estimativa de custos</h2>
    <label>Valor estimado por tentativa em reais<input data-cost type="number" min="0" step="0.0001" inputmode="decimal"></label>
    <p data-estimate>Informe um valor para simular. A estimativa não representa faturamento real.</p>
   </div>
  </section>`;
 const el=name=>root.querySelector('[data-'+name+']');
 const status=el('status'),config=el('config'),search=el('search');
 let overview,busy=false;
 const unavailable='Os controles do Smart Admin AI estão indisponíveis.';
 async function request(action,parameters={},critical=false){
  if(critical&&typeof reauthenticate!=='function')throw Error('REAUTH_REQUIRED');
  const token=critical?await reauthenticate():await getIdToken();
  if(critical&&!token)throw Error('REAUTH_REQUIRED');
  if(!token)throw Error('ACCESS_DENIED');
  const response=await fetcher('/v1/admin/ai',{method:'POST',cache:'no-store',
   headers:{authorization:'Bearer '+token,'content-type':'application/json'},
   body:JSON.stringify({action,...parameters})});
  const data=await response.json();
  if(!response.ok)throw Error(data.error);
  return data;
 }
 const setStatus=text=>{status.textContent=text;};
 function renderMetrics(target,period){
  const graph=document.createElement('div');
  graph.className='raytech-ai-plan-chart';
  const total=period.free.reserved+period.premium.reserved;
  for(const [plan,label] of [['free','Free'],['premium','Premium']]){
   const row=document.createElement('label'),bar=document.createElement('meter');
   row.textContent=label+' · '+number.format(period[plan].reserved)+' leituras';
   bar.min=0;bar.max=Math.max(1,total);bar.value=period[plan].reserved;
   row.append(bar);graph.append(row);
  }
  target.replaceChildren(...counts.flatMap(([key,label])=>{
   const term=document.createElement('dt'),detail=document.createElement('dd');
   term.textContent=label;
   detail.textContent=number.format(period.free[key]+period.premium[key])+
    ' · Free '+number.format(period.free[key])+' · Premium '+number.format(period.premium[key]);
   return [term,detail];
  }));
  if(target.previousElementSibling?.classList.contains(graph.className))target.previousElementSibling.remove();
  target.before(graph);
 }
 function estimate(){
  const input=el('cost'),price=input.valueAsNumber;
  el('estimate').textContent=overview&&input.value!==''&&Number.isFinite(price)&&price>=0?
   'Simulação mensal: '+currency.format(price*(overview.month.free.reserved+overview.month.premium.reserved))+
   ' · Valor informado × tentativas registradas. Sem dados de faturamento real.':
   'Informe um valor para simular. A estimativa não representa faturamento real.';
 }
 async function load(){
  overview=await request('overview');
  el('content').hidden=false;
  renderMetrics(el('day'),overview.day);renderMetrics(el('month'),overview.month);
  el('conversions').textContent='Primeiro uso Premium após uso Free no mês: '+number.format(overview.month.conversions);
  el('average').textContent='Média mensal de extrações por usuário com tentativa: '+
   (overview.monthlyAverage===null?'sem dados':number.format(overview.monthlyAverage));
  el('audit').textContent=Number.isSafeInteger(overview.auditCount)?
   'Auditoria simulada · '+number.format(overview.auditCount)+' alterações registradas':'';
  const {settings}=overview;
  const finance=overview.finance;
  el('admission').textContent=finance?.suspended?'Suspensão financeira automática.':!settings.enabled?'Suspensão administrativa manual.':'Novas leituras habilitadas.';
  if(finance){
   el('finance').textContent=(finance.suspended?'Suspensa pelo limite financeiro':'Proteção financeira ativa')+
    ' · Orçamento mensal '+currency.format(finance.budgetCents/100);
   el('finance-observed').textContent=finance.observedCents===null?'Aguardando atualização do faturamento':
    (overview.simulated?'Faturamento simulado: ':'Faturamento observado: ')+currency.format(finance.observedCents/100)+' · '+
    number.format(100*finance.observedCents/finance.budgetCents)+'% · Atualizado em '+new Date(finance.updatedAt).toLocaleString('pt-BR');
   const level=budgetLevel(finance.observedCents,finance.budgetCents),meter=el('budget-meter');
   meter.hidden=!level;
   if(level){
    const progress=meter.querySelector('progress');progress.value=level.width;progress.dataset.level=level.level;
    el('budget-level').textContent=level.label+' · '+number.format(level.percent)+'%';
   }
   el('alerts').replaceChildren(...finance.alerts.slice().reverse().map(alert=>{
    const item=document.createElement('li');
    item.textContent=alert.period+' · '+alert.threshold+'%'+(alert.threshold===100?' · Alerta crítico':'');
    return item;
   }));
  }
  el('security').textContent=overview.security?.serverAuthorization?
   'Autorização no servidor · Autenticação recente de até cinco minutos para alterações.':'';
  el('reactivate').hidden=!(finance?.suspended&&overview.role==='owner');
  config.hidden=overview.role!=='owner';
  config.elements.enabled.checked=settings.enabled;el('emergency').disabled=!settings.enabled;
  config.elements.day.value=settings.budget.day;
  config.elements.month.value=settings.budget.month;
  estimate();
 }
 async function run(task){
  if(busy)return;
  busy=true;root.setAttribute('aria-busy','true');setStatus('Carregando…');
  try{setStatus(await task()??'');}
  catch(error){
   if(error.message==='ACCESS_DENIED'){el('content').hidden=true;el('users').replaceChildren();el('credit').textContent='';}
   setStatus(error.message==='REAUTH_REQUIRED'?'Confirme sua identidade com um novo login para continuar.':messages[error.message]??unavailable);
  }
  finally{busy=false;root.setAttribute('aria-busy','false');}
 }
 el('reload').addEventListener('click',()=>void run(load));
 el('cost').addEventListener('input',estimate);
 el('reactivate').addEventListener('submit',event=>{
  event.preventDefault();
  if(overview?.role!=='owner'||!overview.finance?.suspended||!event.currentTarget.querySelector('input').checked)return;
  event.currentTarget.reset();
  void run(async()=>{
   try{await request('reactivateFinance',{confirmed:true,expectedVersion:overview.finance.version},true);}
   catch(error){if(error.message==='VERSION_CONFLICT')await load();throw error;}
   await load();return 'Proteção financeira reativada. Confira se as novas leituras estão habilitadas.';
  });
 });
 search.addEventListener('submit',event=>{
  event.preventDefault();
  void run(async()=>{
   el('users').replaceChildren();el('credit').textContent='';
   const query=search.querySelector('input').value.trim();
   const {rows}=await request('search',{prefix:query});
   for(const row of rows){
    const item=document.createElement('li'),button=document.createElement('button');
    button.type='button';button.textContent=(row.name?row.name+' · ':'')+row.uid;
    button.addEventListener('click',()=>void run(async()=>{
     el('credit').textContent='';
     const credit=await request('credits',{uid:row.uid});
     el('credit').textContent=row.uid+' · '+(credit.plan==='premium'?'Premium':'Free')+
      ' · '+number.format(credit.remaining)+' créditos disponíveis'+(credit.busy?' · Em processamento':'');
    }));
    item.append(button);el('users').append(item);
   }
   if(!rows.length)return 'Nenhum usuário encontrado.';
  });
 });
 el('emergency').onclick=()=>{
  if(overview?.role!=='owner'||!overview.settings.enabled)return;
  config.elements.enabled.checked=false;
  config.requestSubmit();
 };
 config.addEventListener('submit',event=>{
  event.preventDefault();
  if(overview?.role!=='owner')return;
  void run(async()=>{
   const settings={enabled:config.elements.enabled.checked,day:config.elements.day.valueAsNumber,
    month:config.elements.month.valueAsNumber,expectedVersion:overview.settings.version};
   try{await request('configure',settings,true);}
   catch(error){if(error.message==='VERSION_CONFLICT')await load();throw error;}
   await load();return 'Configuração salva.';
  });
 });
 return {ready:run(load),refresh:()=>run(load)};
}
