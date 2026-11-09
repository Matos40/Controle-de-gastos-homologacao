/* Tutorial de primeiro acesso. Não altera appDb nem dados financeiros. */
(function () {
  'use strict';
  const KEY = 'controle_gastos_onboarding_v1';
  const DB_KEY = 'controle_gastos_multimonth_v3';
  const PIN_KEY = 'controle_gastos_pin_lock';
  const hadDatabaseBeforeStartup = localStorage.getItem(DB_KEY) !== null;
  const steps = [
    { icon: 'fa-wallet', title: 'Bem-vindo ao Controle de Gastos 2.0', body: 'Organize seu dinheiro, acompanhe seus gastos e planeje seus próximos meses com tranquilidade.' },
    { icon: 'fa-money-bill-wave', title: 'Comece pelas receitas', body: 'Na aba Contas, informe seu salário mensal e registre outras receitas. Você pode fazer isso depois.' },
    { icon: 'fa-receipt', title: 'Cadastre suas despesas', body: 'Adicione contas fixas e despesas do dia a dia. Os totais e o saldo são calculados a partir dos lançamentos.' },
    { icon: 'fa-credit-card', title: 'Acompanhe as parcelas', body: 'Na aba Cartão, registre compras parceladas e acompanhe cada parcela nos meses correspondentes.' },
    { icon: 'fa-shield-halved', title: 'Proteja seus dados', body: 'Os lançamentos ficam armazenados neste navegador. Exporte backups JSON regularmente e guarde-os em local seguro.' }
  ];
  let step = 0;
  let modal = null;
  let previousFocus = null;
  let checklist = null;
  const CHECK_KEY = 'controle_gastos_checklist_v1';
  const ELIGIBLE_KEY = 'controle_gastos_checklist_eligible_v1';
  function saved() { try { return JSON.parse(localStorage.getItem(KEY) || '{}') || {}; } catch (_) { return {}; } }
  function store(data) { try { localStorage.setItem(KEY, JSON.stringify(data)); } catch (_) {} }
  function build() {
    const help = document.createElement('button');
    help.type = 'button';
    help.id = 'onboardingHelpButton';
    help.setAttribute('aria-label', 'Abrir tutorial de ajuda');
    help.className = 'fixed right-4 bottom-20 sm:bottom-5 z-40 bg-emerald-700 hover:bg-emerald-600 text-white rounded-full shadow-xl px-4 py-3 text-sm font-bold focus:outline-none focus:ring-2 focus:ring-emerald-300';
    help.innerHTML = '<i class="fa-solid fa-circle-question" aria-hidden="true"></i> <span>Ajuda</span>';
    help.addEventListener('click', () => open(0));
    document.body.appendChild(help);
    checklist = document.createElement('section');
    checklist.id = 'onboardingChecklist';
    checklist.className = 'hidden max-w-6xl mx-auto px-3.5 sm:px-6 mt-5';
    checklist.innerHTML = '<div class="rounded-2xl bg-slate-900 border border-emerald-500/30 p-4 sm:p-5 text-slate-100 shadow-lg">'
      + '<div class="flex justify-between items-start gap-3"><div><h2 class="font-bold text-base"><i class="fa-solid fa-list-check text-emerald-400 mr-2"></i>Primeiros passos</h2><p id="onboardingChecklistProgress" class="text-xs text-slate-400 mt-1"></p></div><button id="onboardingChecklistHide" type="button" class="text-slate-300 text-xs hover:text-white px-2 py-1" aria-label="Ocultar primeiros passos">Ocultar</button></div>'
      + '<div id="onboardingChecklistItems" class="grid sm:grid-cols-3 gap-2 mt-4"></div>'
      + '<p class="text-xs text-slate-400 mt-3">O checklist é opcional. Nenhuma despesa de exemplo será criada.</p></div>';
    const main = document.querySelector('main');
    if (main && main.parentNode) main.parentNode.insertBefore(checklist, main);
    else document.body.appendChild(checklist);
    document.getElementById('onboardingChecklistHide').addEventListener('click', () => {
      try { localStorage.setItem(CHECK_KEY, 'hidden'); } catch (_) {}
      checklist.classList.add('hidden');
    });
    checklist.addEventListener('click', event => {
      const target = event.target.closest('button[data-check-action]');
      if (!target) return;
      const action = target.dataset.checkAction;
      if (action === 'backup') {
        try { localStorage.setItem(CHECK_KEY, 'backup-reviewed'); } catch (_) {}
        renderChecklist();
      } else if (action === 'income' || action === 'expense') {
        if (typeof switchTab === 'function') switchTab('general');
        const element = document.getElementById(action === 'income' ? 'salaryInput' : 'expensesContainer');
        element?.scrollIntoView({ behavior: 'smooth', block: 'center' });
        if (action === 'income') element?.focus();
      }
    });
    modal = document.createElement('div');
    modal.id = 'onboardingModal';
    modal.className = 'hidden fixed inset-0 z-[100] bg-slate-950/90 backdrop-blur-sm p-4 flex items-center justify-center';
    modal.setAttribute('role', 'dialog');
    modal.setAttribute('aria-modal', 'true');
    modal.setAttribute('aria-labelledby', 'onboardingTitle');
    modal.innerHTML = '<section class="w-full max-w-md rounded-2xl border border-emerald-500/30 bg-slate-900 text-white shadow-2xl p-5 sm:p-7 space-y-5">'
      + '<div class="flex items-center justify-between gap-3"><span id="onboardingProgress" class="text-xs font-semibold text-emerald-300"></span><button type="button" id="onboardingClose" aria-label="Fechar tutorial" class="text-slate-300 hover:text-white p-2 rounded-lg focus:ring-2 focus:ring-emerald-300"><i class="fa-solid fa-xmark"></i></button></div>'
      + '<div class="flex gap-1.5" id="onboardingDots" aria-hidden="true"></div>'
      + '<div class="text-center space-y-4 py-4"><div class="mx-auto w-20 h-20 flex items-center justify-center rounded-full bg-emerald-500/10 text-emerald-400"><i id="onboardingIcon" class="fa-solid fa-wallet text-4xl"></i></div><h2 id="onboardingTitle" class="text-xl font-bold"></h2><p id="onboardingBody" class="text-sm text-slate-300 leading-relaxed"></p></div>'
      + '<div class="flex items-center gap-2"><button type="button" id="onboardingSkip" class="text-sm text-slate-300 hover:text-white px-3 py-3">Pular</button><button type="button" id="onboardingBack" class="rounded-lg border border-slate-700 px-3 py-3 text-sm">Voltar</button><button type="button" id="onboardingNext" class="flex-1 rounded-lg bg-emerald-600 hover:bg-emerald-500 px-4 py-3 font-bold text-sm">Próximo</button></div>'
      + '</section>';
    document.body.appendChild(modal);
    document.getElementById('onboardingClose').addEventListener('click', close);
    document.getElementById('onboardingSkip').addEventListener('click', finish);
    document.getElementById('onboardingBack').addEventListener('click', () => { if (step > 0) { step--; render(); } });
    document.getElementById('onboardingNext').addEventListener('click', () => { if (step === steps.length - 1) finish(); else { step++; render(); } });
    modal.addEventListener('click', event => { if (event.target === modal) close(); });
    modal.addEventListener('keydown', event => {
      if (event.key === 'Escape') { event.preventDefault(); close(); }
      if (event.key !== 'Tab') return;
      const focusables = Array.from(modal.querySelectorAll('button:not([disabled])')).filter(el => el.offsetParent !== null);
      const first = focusables[0], last = focusables[focusables.length - 1];
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
    });
  }
  function render() {
    const current = steps[step];
    document.getElementById('onboardingProgress').textContent = 'Etapa ' + (step + 1) + ' de ' + steps.length;
    document.getElementById('onboardingTitle').textContent = current.title;
    document.getElementById('onboardingBody').textContent = current.body;
    document.getElementById('onboardingIcon').className = 'fa-solid ' + current.icon + ' text-4xl';
    document.getElementById('onboardingDots').innerHTML = steps.map((_, i) => '<span class="h-1.5 flex-1 rounded-full ' + (i <= step ? 'bg-emerald-500' : 'bg-slate-700') + '"></span>').join('');
    document.getElementById('onboardingBack').disabled = step === 0;
    document.getElementById('onboardingBack').classList.toggle('opacity-40', step === 0);
    document.getElementById('onboardingNext').textContent = step === steps.length - 1 ? 'Concluir' : 'Próximo';
  }
  function open(index) {
    if (!modal) return;
    previousFocus = document.activeElement;
    step = index;
    render();
    modal.classList.remove('hidden');
    document.getElementById('onboardingClose').focus();
  }
  function close() {
    if (!modal) return;
    modal.classList.add('hidden');
    if (previousFocus && typeof previousFocus.focus === 'function') previousFocus.focus();
  }
  function finish() {
    store({ completed: true });
    close();
    renderChecklist();
  }
  function renderChecklist() {
    if (!checklist) return;
    const state = saved();
    let checkState = '';
    try { checkState = localStorage.getItem(CHECK_KEY) || ''; } catch (_) {}
    let eligible = false;
    try { eligible = localStorage.getItem(ELIGIBLE_KEY) === 'yes'; } catch (_) {}
    if (!eligible || !state.completed || checkState === 'hidden') {
      checklist.classList.add('hidden');
      return;
    }
    const months = (typeof appDb !== 'undefined' && appDb && appDb.months) ? Object.values(appDb.months) : [];
    const hasIncome = months.some(m => m && (Number(m.salary) > 0 || (Array.isArray(m.extraIncomes) && m.extraIncomes.length > 0)));
    const hasExpense = months.some(m => m && ((Array.isArray(m.expenses) && m.expenses.length > 0) || (Array.isArray(m.cardExpenses) && m.cardExpenses.length > 0)));
    const hasBackupKnowledge = checkState === 'backup-reviewed';
    const items = [
      { title: 'Cadastre sua primeira receita', done: hasIncome, action: 'income', label: 'Ir para receitas' },
      { title: 'Registre uma despesa', done: hasExpense, action: 'expense', label: 'Ir para despesas' },
      { title: 'Conheça o backup JSON', done: hasBackupKnowledge, action: 'backup', label: 'Entendi como proteger meus dados' }
    ];
    const doneCount = items.filter(item => item.done).length;
    if (doneCount === items.length) {
      checklist.classList.add('hidden');
      return;
    }
    checklist.classList.remove('hidden');
    document.getElementById('onboardingChecklistProgress').textContent = doneCount + ' de 3 etapas concluídas';
    const grid = document.getElementById('onboardingChecklistItems');
    grid.replaceChildren();
    items.forEach(item => {
      const card = document.createElement('div');
      card.className = 'rounded-xl bg-slate-950 border border-slate-800 p-3 flex flex-col gap-2';
      const label = document.createElement('p');
      label.className = 'text-sm font-semibold';
      label.textContent = (item.done ? '✓ ' : '○ ') + item.title;
      card.appendChild(label);
      if (!item.done) {
        const btn = document.createElement('button');
        btn.type = 'button';
        btn.dataset.checkAction = item.action;
        btn.className = 'text-left text-xs text-emerald-300 hover:text-emerald-200 underline';
        btn.textContent = item.label;
        card.appendChild(btn);
      }
      grid.appendChild(card);
    });
  }
  document.addEventListener('DOMContentLoaded', () => {
    build();
    if (!hadDatabaseBeforeStartup) {
      try { localStorage.setItem(ELIGIBLE_KEY, 'yes'); } catch (_) {}
    }
    // Bancos preexistentes não recebem tutorial automático; não interferir no bloqueio por PIN.
    if (!hadDatabaseBeforeStartup && !saved().completed && !localStorage.getItem(PIN_KEY)) open(0);
    renderChecklist();
    document.addEventListener('input', () => setTimeout(renderChecklist, 0));
    document.addEventListener('click', () => setTimeout(renderChecklist, 0));
  });
})();
