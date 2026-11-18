import {accountLabel, filterAccounts} from './smartAdminIdentity.mjs';

const keys=['minute','day','month'];
const names={minute:'Minuto',day:'Dia',month:'Mês'};
const plans = {owner: 'Owner', admin: 'Admin', premium: 'Premium', free: 'Free'};
function el(tag, text = '', cls = '') {
  const node = document.createElement(tag);
  node.textContent = text;
  node.className = cls;
  return node;
}
function button(text, click) {
  const node = el('button', text, 'admin-action');
  node.type = 'button';
  node.onclick = click;
  return node;
}
function selector(label, options) {
  const node = el('select');
  node.setAttribute('aria-label', label);
  for (const [value, text] of options) {
    const option = el('option', text);
    option.value = value;
    node.append(option);
  }
  return node;
}
function renderConsumption(account) {
  if (!account.usage) {
    const unavailable=el('div','','v345-usage');
    unavailable.append(el('p',account.usageUnavailable?'Consumo indisponível · leitor desativado no Spark online':'Sem cota de leitor'));
    if(account.limits)for(const key of keys)unavailable.append(el('p',names[key]+' UTC · limite configurado: '+account.limits[key]));
    return unavailable;
  }
  if(!account.limits)return el('p','Sem cota de leitor');
  const node = el('div', '', 'v345-usage');
  node.setAttribute('aria-label', 'Consumo do leitor simulado');
  if(account.readerEnabled===false)node.append(el('p','Leitor indisponível · histórico de consumo'));
  if(account.outcome){const x=account.outcome.month;node.append(el('p','Reservadas: '+x.reserved+' · Concluídas: '+x.completed+' · Falhas: '+x.failed+' · Pendentes: '+x.pending));}
  for (const key of keys) {
    const count = account.usage[key];
    const cap = account.limits[key];
    const label = el('label', names[key] + ' UTC · ' + count + '/' + cap);
    const meter = document.createElement('progress');
    meter.setAttribute('aria-label', names[key] + ' UTC');
    meter.max = cap;
    meter.value = count;
    label.append(meter);
    node.append(label);
  }
  return node;
}
function safeDate(v){try{const d=v?.toDate?.();return d instanceof Date&&Number.isFinite(d.getTime())?d.toLocaleString('pt-BR'):'—';}catch{return '—';}}
export function mountAdmin({api, role, uid}) {
  const host = document.getElementById('smartAdminHost');
  const open = document.getElementById('smartAdminOpen');
  let serial = 0, alive = true;
  let filters = {search:'',plan:'',state:'',admins:false};
  const close = () => {
    serial++;
    host.querySelectorAll('dialog[open]').forEach(d=>d.close());
    host.hidden = true;
    host.replaceChildren();
    const profile = open.closest('details');
    if (profile) profile.querySelector('summary')?.focus();
    else open.focus();
  };

  function edit(account, status, epoch) {
    const dialog = el('dialog', '', 'v345-dialog');
    const title = el('h2', accountLabel(account));
    title.id = 'v345EditTitle';
    dialog.setAttribute('aria-labelledby', title.id);
    const locked = account.protected || account.uid === uid || ['owner','admin'].includes(account.role);
    const details = el('dl','','v3467-details');
    const date=safeDate;
    for(const [label,value] of [['E-mail',account.email||'—'],['UID',account.uid],['Função',plans[account.role]||'Usuário'],['Plano',plans[account.plan]||'—'],['Situação',account.blocked?'Bloqueada':'Ativa'],['Cadastro',date(account.createdAt)],['Último acesso',date(account.lastAccess)]]){details.append(el('dt',label),el('dd',value));}
    const usage=el('section','','v3467-ai');usage.append(el('h3','Smart AI Usage'),renderConsumption(account));
    const form = el('form', '', 'v345-edit');
    const plan = selector('Plano', [['free', 'Free'], ['premium', 'Premium']]);
    plan.value = account.plan;
    const blocked = selector('Situação', [['false', 'Ativa'], ['true', 'Bloqueada']]);
    blocked.value = String(account.blocked);

    const limits = Object.fromEntries(keys.map(key => {
      const input = el('input');
      input.type = 'number';
      input.min = 1;
      input.max = 10000;
      input.required = true;
      input.value = account.limits?.[key] ?? {minute: 3, day: 20, month: 100}[key];
      const label = el('label', names[key] + ' UTC');
      label.append(input);
      return [key, {input, label}];
    }));
    const message = el('p');
    message.setAttribute('role', 'status');
    const cancel = button('Cancelar', () => dialog.close());
    const save = button('Salvar alterações');
    save.type = 'submit';
    form.append(plan, blocked, message, cancel, save);
    form.onsubmit = async event => {
      event.preventDefault();
      if (locked || save.disabled || !alive || epoch!==serial) return;
      const values=Object.fromEntries(keys.map(key=>[key,limits[key].input.valueAsNumber]));
      if(!keys.every(key=>Number.isInteger(values[key])&&values[key]>=1&&values[key]<=10000)||values.minute>values.day||values.day>values.month){message.textContent='Cotas inválidas: minuto ≤ dia ≤ mês.';return;}
      save.disabled = true;
      cancel.disabled = true;
      try {
        await api.change(account.uid, {plan: plan.value, blocked: blocked.value === 'true',limits:values});
        if (epoch === serial) {
          dialog.close();
          await load('Alterações salvas.');
        }
      } catch {
        message.textContent = 'A alteração foi recusada ou a conexão está indisponível.';
      } finally { save.disabled = false; cancel.disabled = false; }
    };
    dialog.addEventListener('close', () => dialog.remove(), {once: true});
    dialog.append(title, details, usage);
    if(locked) dialog.append(el('p','Conta protegida','v345-protected'),button('Fechar',()=>dialog.close()));
    else {const pl=el('label','Plano');pl.append(plan);const st=el('label','Situação');st.append(blocked);form.replaceChildren(pl,st,...keys.map(key=>limits[key].label),message,cancel,save);dialog.append(form);}
    status.after(dialog);
    dialog.showModal();
  }

  async function load(message) {
    if(!alive)return;
    const epoch = ++serial;
    host.hidden = false;
    const status = el('p', 'Carregando…');
    status.setAttribute('role', 'status');
    const exit = button('Fechar', close);
    exit.classList.add('v345-admin-close');
    exit.textContent = '×';
    exit.setAttribute('aria-label', 'Fechar painel administrativo');
    const heading = el('div', '', 'v345-admin-heading');
    const title = el('div');
    title.append(el('h2', 'Smart Admin · ' + plans[role]), el('p', 'Gerenciamento de usuários e acesso', 'v345-admin-subtitle'));
    heading.append(title, exit);
    host.replaceChildren(heading, status);
    exit.focus();
    try {
      if (!await api.role()) throw Error('ADMIN_DENIED');
      const [accounts,auditResult,metrics]=await Promise.all([api.list(),api.audit().then(value=>({value}),()=>({unavailable:true})),api.monitor().catch(()=>({unavailable:true}))]);
      const audit=auditResult.value??[];
      if (epoch !== serial) return;
      status.textContent = (typeof message === 'string' ? message + ' ' : '') + accounts.length + ' contas nesta amostra, até 100.';
      const stats = el('div', '', 'admin-stats');
      for (const [label, value] of [
        ['Usuários', accounts.length],
        ['Ativas', accounts.filter(a => !a.blocked).length],
        ['Bloqueadas', accounts.filter(a => a.blocked).length],
        ['Administradores', accounts.filter(a => a.role === 'owner' || a.role === 'admin').length],
        ['Free', accounts.filter(a => a.plan === 'free').length],
        ['Premium', accounts.filter(a => a.plan === 'premium').length],
      ]) {
        const card = el('button', '', 'admin-stat');
        card.type='button';card.dataset.filter=label;card.setAttribute('aria-pressed','false');
        card.append(el('small', label), el('strong', String(value)));
        stats.append(card);
      }
      const search = el('input');
      search.type = 'search';
      search.placeholder = 'Buscar nome ou e-mail';
      search.setAttribute('aria-label', 'Buscar contas');
      const plan = selector('Plano', [['', 'Todos os planos'], ['free', 'Free'], ['premium', 'Premium']]);
      const state = selector('Situação', [['', 'Todas as situações'], ['active', 'Ativas'], ['blocked', 'Bloqueadas']]);
      const tools = el('div', '', 'admin-tools');
      const roleFilter=selector('Função',[['','Todas as funções'],['admins','Administradores']]);
      tools.append(search, plan, state, roleFilter);
      search.value=filters.search;plan.value=filters.plan;state.value=filters.state;roleFilter.value=filters.admins?'admins':'';
      const monitor=el('details','','v3467-ai v3467-monitor');monitor.append(el('summary','Smart AI Monitor'));
      const consumption=el('section','','admin-stats');consumption.id='v3473Monitor';
      if(metrics?.unavailable||!metrics?.outcomes?.month||!metrics?.global?.used||!metrics?.global?.limits)consumption.append(el('p','Consumo e orçamento indisponíveis.'));
      else{const month=metrics.outcomes.month;for(const [label,value] of [['Reservadas',month.reserved],['Concluídas',month.completed],['Falhas',month.failed],['Pendentes',month.pending]]){const card=el('div','','admin-stat');card.append(el('small',label+' · mês UTC'),el('strong',String(value)));consumption.append(card);}monitor.append(el('p','Orçamento global simulado · mês: R$ '+(metrics.global.used.month/1000000).toFixed(2)+' / R$ '+(metrics.global.limits.month/1000000).toFixed(2)));}monitor.append(consumption);
      const rows = el('div');
      const render = () => {
        rows.replaceChildren();
        filters={search:search.value,plan:plan.value,state:state.value,admins:roleFilter.value==='admins'};
        const active=filters.admins&&!filters.plan&&!filters.state?'Administradores':!filters.admins&&filters.plan&&!filters.state?plans[filters.plan]:!filters.admins&&!filters.plan&&filters.state?(filters.state==='active'?'Ativas':'Bloqueadas'):!filters.admins&&!filters.plan&&!filters.state&&!filters.search?'Usuários':'';
        for(const card of stats.children)card.setAttribute('aria-pressed',String(card.dataset.filter===active));
        for (const account of filterAccounts(accounts, search.value, plan.value, state.value).filter(a=>!filters.admins||['owner','admin'].includes(a.role))) {
          const row = el('article', '', 'admin-row');
          row.dataset.plan = account.role || account.plan;
          
          const identity = el('div', '', 'v345-admin-identity');
          const initials = accountLabel(account).trim().split(/\s+/).slice(0, 2).map(part => part[0]).join('').toUpperCase();
          const avatar = el('span', initials, 'v345-admin-avatar');
          avatar.setAttribute('aria-hidden', 'true');
          const name = el('div', '', 'v345-admin-name');
          name.append(el('strong', accountLabel(account)));name.title=accountLabel(account);
          if(account.photo){try{const url=new URL(account.photo);if(url.protocol==='https:'&&/(^|\.)googleusercontent\.com$/.test(url.hostname)&&!url.username&&!url.password){const img=el('img');img.alt='';img.referrerPolicy='no-referrer';img.loading='lazy';img.onload=()=>avatar.replaceChildren(img);img.src=url.href;}}catch{}}
          identity.append(avatar, name);
          const email=el('span',account.email||'—','v3467-email');email.title=account.email||'';
          const planTag=el('span',plans[account.plan]||'—','v3467-plan');planTag.dataset.value=account.plan;
          const stateTag=el('span',account.blocked?'Bloqueada':'Ativa','v3467-state');stateTag.dataset.blocked=String(account.blocked);
          const usage=el('span',account.usage&&account.limits?account.usage.month+'/'+account.limits.month:'—','v3467-usage');usage.title=account.usage&&account.limits?'Consumo mensal UTC':'Consumo de IA indisponível';
          const detailButton=button('Exibir detalhes',()=>edit(account,status,epoch));detailButton.setAttribute('aria-label','Exibir detalhes de '+accountLabel(account));
          row.append(identity,email,planTag,stateTag,usage,detailButton);
          rows.append(row);
        }
        if (!rows.childElementCount) rows.append(el('p', 'Nenhuma conta encontrada.'));
      };
      search.oninput = plan.onchange = state.onchange = roleFilter.onchange = render;
      for(const card of stats.children)card.onclick=()=>{search.value='';plan.value='';state.value='';roleFilter.value='';switch(card.dataset.filter){case 'Ativas':state.value='active';break;case 'Bloqueadas':state.value='blocked';break;case 'Administradores':roleFilter.value='admins';break;case 'Free':plan.value='free';break;case 'Premium':plan.value='premium';break;}render();};
      render();
      rows.className = 'v345-admin-rows';
      const auditPanel = el('section', '', 'v345-audit');
      auditPanel.append(el('h3', 'Auditoria · últimos 100 registros'));
      const columns=el('div','','v3467-columns');for(const label of ['Usuário','E-mail','Plano','Situação','Uso IA','Ação'])columns.append(el('span',label));
      host.append(stats, tools, monitor, columns, rows, auditPanel);
      const labels = new Map(accounts.map(a => [a.uid, accountLabel(a)]));
      for (const event of audit) {
        if(!event||typeof event.target!=='string'||typeof event.actor!=='string'||!['free','premium'].includes(event.beforePlan)||!['free','premium'].includes(event.afterPlan)||typeof event.afterBlocked!=='boolean'){auditPanel.append(el('p','Registro de auditoria inválido.'));continue;}
        const item = el('details');
        item.append(el('summary', (labels.get(event.target) || 'Conta') + ' · ' + event.beforePlan + ' → ' +
          event.afterPlan + ' · ' + (event.afterBlocked ? 'Bloqueada' : 'Ativa')),
          el('small', 'Operador ' + (labels.get(event.actor)||'Conta não identificada') + ' · ' + safeDate(event.at)));
        auditPanel.append(item);
      }
      if(auditResult.unavailable)auditPanel.append(el('p','Auditoria temporariamente indisponível. Reabra o painel para tentar novamente.'));
      else if (!audit.length) auditPanel.append(el('p', 'Nenhuma alteração registrada.', 'v345-audit-empty'));
    } catch (error) {
      if (epoch === serial) {
        const code=String(error?.code??error?.message??'');
        const denied=['ADMIN_DENIED','ACCESS_DENIED','permission-denied','UNAUTHENTICATED','SESSION_CHANGED'].includes(code);
        const transport=['unavailable','deadline-exceeded','AI_UNAVAILABLE','ADMIN_UNAVAILABLE','UNAVAILABLE'].includes(code);
        status.textContent=denied?'Acesso administrativo não autorizado.':transport?'Serviço administrativo temporariamente indisponível.':'Não foi possível carregar o painel administrativo. Reabra para tentar novamente.';
        console.warn('[Smart Admin] '+(denied?'AUTHORIZATION':transport?'SERVICE_UNAVAILABLE':'PANEL_LOAD_FAILED'));
      }
    }
  }

  open.hidden = false;
  const launch = () => { const profile = open.closest('details'); if (profile) profile.open = false; void load(); };
  open.addEventListener('click', launch);
  return () => {
    alive=false;
    close();
    open.hidden = true;
    open.removeEventListener('click', launch);
  };
}
