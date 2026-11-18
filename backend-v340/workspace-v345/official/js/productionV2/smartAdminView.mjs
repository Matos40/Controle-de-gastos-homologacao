import {accountLabel, filterAccounts} from './smartAdminIdentity.mjs';

const keys = ['minute', 'day', 'month'];
const names = {minute: 'Minuto', day: 'Dia', month: 'Mês'};
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
  if (!account.limits) return el('p', account.usageUnavailable ? 'Consumo indisponível' : 'Sem cota de leitor');
  const node = el('div', '', 'v345-usage');
  node.setAttribute('aria-label', 'Consumo do leitor simulado');
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
export function mountAdmin({api, role, uid}) {
  const host = document.getElementById('smartAdminHost');
  const open = document.getElementById('smartAdminOpen');
  let serial = 0;
  const close = () => {
    serial++;
    host.querySelector('dialog')?.close();
    host.hidden = true;
    host.replaceChildren();
    const profile = open.closest('details');
    if (profile) profile.querySelector('summary')?.focus();
    else open.focus();
  };

  function edit(account, status, epoch) {
    const dialog = el('dialog', '', 'v345-dialog');
    const title = el('h2', 'Editar ' + accountLabel(account));
    title.id = 'v345EditTitle';
    dialog.setAttribute('aria-labelledby', title.id);
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
    form.append(plan, blocked, ...keys.map(key => limits[key].label), message, cancel, save);
    form.onsubmit = async event => {
      event.preventDefault();
      if (save.disabled) return;
      const values = Object.fromEntries(keys.map(key => [key, limits[key].input.valueAsNumber]));
      if (values.minute > values.day || values.day > values.month) {
        message.textContent = 'A cota por minuto deve ser menor ou igual à diária, e a diária à mensal.';
        return;
      }
      save.disabled = true;
      cancel.disabled = true;
      try {
        await api.change(account.uid, {plan: plan.value, blocked: blocked.value === 'true', limits: values});
        if (epoch === serial) {
          dialog.close();
          await load('Alterações salvas.');
        }
      } catch {
        message.textContent = 'A alteração foi recusada ou a conexão está indisponível.';
      } finally { save.disabled = false; cancel.disabled = false; }
    };
    dialog.addEventListener('close', () => dialog.remove(), {once: true});
    dialog.append(title, form);
    status.after(dialog);
    dialog.showModal();
  }

  async function load(message) {
    const epoch = ++serial;
    host.hidden = false;
    const status = el('p', 'Carregando…');
    status.setAttribute('role', 'status');
    const exit = button('Fechar', close);
    exit.classList.add('v345-admin-close');
    const heading = el('div', '', 'v345-admin-heading');
    const title = el('div');
    title.append(el('h2', 'Smart Admin · ' + plans[role]), el('p', 'Gerenciamento de usuários e consumo', 'v345-admin-subtitle'));
    heading.append(title, exit);
    host.replaceChildren(heading, status);
    exit.focus();
    try {
      if (!await api.role()) throw Error('ADMIN_DENIED');
      const [accounts, audit] = await Promise.all([api.list(), api.audit()]);
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
        const card = el('div', '', 'admin-stat');
        card.append(el('small', label), el('strong', String(value)));
        stats.append(card);
      }
      const search = el('input');
      search.type = 'search';
      search.placeholder = 'Buscar nome, e-mail ou UID';
      search.setAttribute('aria-label', 'Buscar contas');
      const plan = selector('Plano', [['', 'Todos os planos'], ['free', 'Free'], ['premium', 'Premium']]);
      const state = selector('Situação', [['', 'Todas as situações'], ['active', 'Ativas'], ['blocked', 'Bloqueadas']]);
      const tools = el('div', '', 'admin-tools');
      tools.append(search, plan, state);
      const rows = el('div');
      const render = () => {
        rows.replaceChildren();
        for (const account of filterAccounts(accounts, search.value, plan.value, state.value)) {
          const row = el('article', '', 'admin-row');
          row.dataset.plan = account.role || account.plan;
          const details = el('details');
          details.append(el('summary', 'Detalhes técnicos'), el('small', account.uid));
          const info = el('div', '', 'admin-info');
          const identity = el('div', '', 'v345-admin-identity');
          const initials = accountLabel(account).trim().split(/\s+/).slice(0, 2).map(part => part[0]).join('').toUpperCase();
          const avatar = el('span', initials, 'v345-admin-avatar');
          avatar.setAttribute('aria-hidden', 'true');
          const name = el('div', '', 'v345-admin-name');
          name.append(el('strong', accountLabel(account)));
          if (account.email) name.append(el('small', account.email));
          identity.append(avatar, name);
          const tags = el('div', '', 'v345-admin-tags');
          tags.append(el('span', plans[row.dataset.plan], 'v345-role-tag'));
          if (account.role) tags.append(el('span', plans[account.plan], 'v345-plan-tag'));
          tags.append(el('span', account.blocked ? 'Bloqueada' : 'Ativa', 'v345-state-tag'));
          info.append(identity, tags, details);
          row.append(info, renderConsumption(account));
          row.append(account.protected || account.uid === uid
            ? el('small', 'Conta protegida', 'v345-protected') : button('Editar cotas e acesso', () => edit(account, status, epoch)));
          rows.append(row);
        }
        if (!rows.childElementCount) rows.append(el('p', 'Nenhuma conta encontrada.'));
      };
      search.oninput = plan.onchange = state.onchange = render;
      render();
      rows.className = 'v345-admin-rows';
      const auditPanel = el('section', '', 'v345-audit');
      auditPanel.append(el('h3', 'Auditoria · últimos 100 registros'));
      host.append(stats, tools, rows, auditPanel);
      const labels = new Map(accounts.map(a => [a.uid, accountLabel(a)]));
      for (const event of audit) {
        const item = el('details');
        item.append(el('summary', (labels.get(event.target) || 'Conta') + ' · ' + event.beforePlan + ' → ' +
          event.afterPlan + ' · ' + (event.afterBlocked ? 'Bloqueada' : 'Ativa')),
          el('small', 'Operador ' + event.actor + ' · ' + event.at.toDate().toISOString()));
        auditPanel.append(item);
      }
      if (!audit.length) auditPanel.append(el('p', 'Nenhuma alteração registrada.', 'v345-audit-empty'));
    } catch {
      if (epoch === serial) status.textContent = 'Acesso administrativo não autorizado ou conexão indisponível.';
    }
  }

  open.hidden = false;
  open.addEventListener('click', load);
  return () => {
    close();
    open.hidden = true;
    open.removeEventListener('click', load);
  };
}
