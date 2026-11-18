/* Inicialização, navegação, formulários, segurança e interações globais. */
function generatePwaIconDataUrl(size = 512) {
  try {
    const canvas = document.createElement('canvas'); canvas.width = size; canvas.height = size;
    const ctx = canvas.getContext('2d'); ctx.fillStyle = '#020617'; ctx.fillRect(0, 0, size, size);
    const pad = size * 0.08; ctx.fillStyle = '#0f172a'; ctx.strokeStyle = '#10b981'; ctx.lineWidth = size * 0.035;
    ctx.beginPath(); ctx.roundRect(pad, pad, size - pad * 2, size - pad * 2, size * 0.22); ctx.fill(); ctx.stroke();
    ctx.fillStyle = '#10b981'; ctx.font = `800 ${Math.round(size * 0.36)}px sans-serif`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText('R$', size / 2, size / 2);
    return canvas.toDataURL('image/png');
  } catch (e) { return ''; }
}
function initPwaEnvironment() {
  const appleLink = document.getElementById('appleTouchIconLink');
  if (appleLink) appleLink.href = './raytech-icon-192.png?v=32.4';
  const manifestLink = document.getElementById('pwaManifestLink');
  if (manifestLink) manifestLink.href = './manifest.json';
  const isStandalone = window.matchMedia('(display-mode: standalone)').matches || window.navigator.standalone === true;
  if (isStandalone) document.getElementById('pwaInstalledBadge')?.classList.remove('hidden');
  window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault(); deferredPwaPrompt = e;
    document.getElementById('directInstallSection')?.classList.remove('hidden');
  });
  window.addEventListener('appinstalled', () => {
    deferredPwaPrompt = null; document.getElementById('pwaInstalledBadge')?.classList.remove('hidden');
    closePwaModal(); showToast('Aplicativo instalado com sucesso na sua Tela Inicial!', 'success');
  });
  const updateOnlineStatus = () => {
    const banner = document.getElementById('offlineBanner'); if (!banner) return;
    banner.classList.toggle('hidden', navigator.onLine); banner.classList.toggle('flex', !navigator.onLine);
  };
  window.addEventListener('online', () => { updateOnlineStatus(); showToast('Conexão restabelecida!', 'success'); });
  window.addEventListener('offline', () => { updateOnlineStatus(); showToast('Você está offline. O aplicativo segue funcionando normalmente!', 'info'); });
  updateOnlineStatus();
}
function openPwaModal() { document.getElementById('pwaInstallModal').classList.remove('hidden'); }
function closePwaModal() { document.getElementById('pwaInstallModal').classList.add('hidden'); }
async function triggerNativePwaInstall() {
  if (!deferredPwaPrompt) { showToast('Siga as instruções abaixo para adicionar à tela inicial do seu aparelho.', 'info'); return; }
  deferredPwaPrompt.prompt(); const { outcome } = await deferredPwaPrompt.userChoice;
  if (outcome === 'accepted') { deferredPwaPrompt = null; closePwaModal(); }
}

    // Funções de Bloqueio por PIN
    function checkPinLockOnStartup() {
      const savedPin = (globalThis.raytechStorage??globalThis.localStorage).getItem(STORAGE_PIN_KEY);
      const pinIcon = document.getElementById('pinHeaderIcon');
      if (savedPin && savedPin.length === 4) {
        document.getElementById('pinLockOverlay').classList.remove('hidden');
        if (pinIcon) pinIcon.className = 'fa-solid fa-lock text-emerald-400 text-sm';
        setTimeout(() => document.getElementById('unlockPinInput')?.focus(), 100);
      } else {
        if (pinIcon) pinIcon.className = 'fa-solid fa-lock-open text-slate-400 text-sm';
      }
    }

    function handleUnlockPin(e) {
      e.preventDefault();
      const typed = document.getElementById('unlockPinInput').value.trim();
      const savedPin = (globalThis.raytechStorage??globalThis.localStorage).getItem(STORAGE_PIN_KEY);
      if (typed === savedPin) {
        document.getElementById('pinLockOverlay').classList.add('hidden');
        document.getElementById('unlockPinInput').value = '';
        document.getElementById('unlockPinError').classList.add('hidden');
      } else {
        document.getElementById('unlockPinError').classList.remove('hidden');
        document.getElementById('unlockPinInput').value = '';
      }
    }

    function openPinModal() {
      const savedPin = (globalThis.raytechStorage??globalThis.localStorage).getItem(STORAGE_PIN_KEY);
      document.getElementById('newPinInput').value = savedPin || '';
      const removeBtn = document.getElementById('removePinBtn');
      if (savedPin) {
        removeBtn.classList.remove('hidden');
      } else {
        removeBtn.classList.add('hidden');
      }
      document.getElementById('pinSetupModal').classList.remove('hidden');
    }

    function closePinModal() {
      document.getElementById('pinSetupModal').classList.add('hidden');
    }

    function savePinLock() {
      const val = document.getElementById('newPinInput').value.trim();
      if (!/^\d{4}$/.test(val)) {
        showToast('Digite exatamente 4 números para o PIN!', 'error');
        return;
      }
      (globalThis.raytechStorage??globalThis.localStorage).setItem(STORAGE_PIN_KEY, val);
      const pinIcon = document.getElementById('pinHeaderIcon');
      if (pinIcon) pinIcon.className = 'fa-solid fa-lock text-emerald-400 text-sm';
      closePinModal();
      showToast('Bloqueio por PIN ativado com sucesso!', 'success');
    }

    function removePinLock() {
      (globalThis.raytechStorage??globalThis.localStorage).removeItem(STORAGE_PIN_KEY);
      const pinIcon = document.getElementById('pinHeaderIcon');
      if (pinIcon) pinIcon.className = 'fa-solid fa-lock-open text-slate-400 text-sm';
      closePinModal();
      showToast('Bloqueio por PIN removido.', 'info');
    }

    // Alternar Modo Privacidade (Olho Mágico)
    function togglePrivacyMode() {
      isPrivacyMode = !isPrivacyMode;
      const icon = document.getElementById('privacyIcon');
      if (isPrivacyMode) {
        if (icon) icon.className = 'fa-solid fa-eye-slash text-amber-400';
        salaryInput.type = 'password';
      } else {
        if (icon) icon.className = 'fa-solid fa-eye text-emerald-400';
        salaryInput.type = 'text';
      }
      renderAll();
    }

    // Alternar status de Pago / Pendente
    function toggleExpensePaid(id) {
      const currentData = getCurrentMonthData();
      const item = (currentData.expenses || []).find(e => e.id === id);
      if (item) {
        item.paid = !item.paid;
        saveDatabase();
        renderExpensesList();
        showToast(item.paid ? `"${item.title}" marcada como PAGA!` : `"${item.title}" marcada como pendente.`, 'info');
      }
    }

    function toggleCardPaid(id) {
      const currentData = getCurrentMonthData();
      const item = (currentData.cardExpenses || []).find(e => e.id === id);
      if (item) {
        item.paid = !item.paid;
        saveDatabase();
        renderCardExpensesList();
      }
    }

    // Controle do Painel Expansível do Header (Gaveta de Categorias)
    function toggleHeaderDrawer(event) {
      if (event) event.stopPropagation();
      const drawer = document.getElementById('headerToolsDrawer');
      const arrow = document.getElementById('headerToolsArrow');
      const btn = document.getElementById('headerToolsToggleBtn');
      if (!drawer) return;

      const isHidden = drawer.classList.contains('hidden');
      if (isHidden) {
        drawer.classList.remove('hidden');
        drawer.scrollTop = 0;
        if (btn) btn.setAttribute('aria-expanded', 'true');
        if (arrow) arrow.classList.add('rotate-180');
        if (btn) btn.classList.add('border-emerald-500/50', 'bg-slate-800');
      } else {
        closeHeaderDrawer();
      }
    }

    function closeHeaderDrawer() {
      const drawer = document.getElementById('headerToolsDrawer');
      const arrow = document.getElementById('headerToolsArrow');
      const btn = document.getElementById('headerToolsToggleBtn');
      if (drawer) drawer.classList.add('hidden');
      if (btn) btn.setAttribute('aria-expanded', 'false');
      if (arrow) arrow.classList.remove('rotate-180');
      if (btn) btn.classList.remove('border-emerald-500/50');
    }

    function triggerExcelInput() {
      const fileInput = document.getElementById('excelImportInput');
      if (fileInput) fileInput.click();
    }

    window.addEventListener('click', (e) => {
      const drawer = document.getElementById('headerToolsDrawer');
      const btn = document.getElementById('headerToolsToggleBtn');
      if (drawer && !drawer.classList.contains('hidden')) {
        if (!drawer.contains(e.target) && (!btn || !btn.contains(e.target))) {
          closeHeaderDrawer();
        }
      }
    });

    window.addEventListener('keydown', (e) => {
      const drawer = document.getElementById('headerToolsDrawer');
      if (e.key === 'Escape' && drawer && !drawer.classList.contains('hidden')) {
        closeHeaderDrawer();
        document.getElementById('headerToolsToggleBtn')?.focus();
      }
    });

    function openDatePicker(elementId) {
      const input = document.getElementById(elementId);
      if (!input) return;
      try {
        if (typeof input.showPicker === 'function') {
          input.showPicker();
        } else {
          input.focus();
        }
      } catch (err) {
        input.focus();
      }
    }

    // Inicialização
    window.addEventListener('raytech-account-start', async () => {

      const gate = document.getElementById('cleanWorkspaceGate');
      const badge = document.getElementById('cleanWorkspaceBanner');
      if(WORKSPACE_MODE==='invalid'){
        gate?.classList.remove('hidden');
        document.getElementById('cleanWorkspaceGateStatus').textContent='Endereço de banco inválido. Nenhum banco foi aberto. Selecione um endereço válido.';
        return;
      }
      const modes=[
        ['cleanWorkspaceSwitch','v2-clean','Abrir banco V2 de testes','Os dados de teste são independentes. Nenhum dado será copiado.'],
        ['legacyWorkspaceSwitch','legacy','Abrir banco legado','Seu histórico original será aberto; nenhum dado será copiado.'],
        ['mainWorkspaceSwitch','v2-main','Abrir banco V2 principal (local)','Este é o banco principal independente. Nenhum dado será copiado.']
      ];
      for(const [id,mode,label,description] of modes){
        const button=document.getElementById(id);
        if(!button)continue;
        button.textContent=label;
        button.classList.toggle('hidden',WORKSPACE_MODE===mode);
        button.addEventListener('click',()=>{
          if(WORKSPACE_MODE===mode||document.getElementById('pinLockOverlay')&&!document.getElementById('pinLockOverlay').classList.contains('hidden'))return;
          const url=new URL(location.href);url.searchParams.set('workspace',mode);
          closeHeaderDrawer();
          showModal(label+'?',description+' As transferências financeiras continuam desativadas.',()=>location.assign(url.href));
        });
      }
      if(WORKSPACE_MODE==='legacy'&&badge){badge.textContent='BANCO LEGADO · histórico original · nuvem desativada';badge.classList.remove('hidden');}
      if (CLEAN_WORKSPACE) {
        if (MAIN_WORKSPACE && badge) {
          const maintenance = new URLSearchParams(location.search).get('maintenance') === '1';
          badge.textContent = 'BANCO V2 PRINCIPAL · Legado e testes preservados | Consulte o indicador de conexão';
          badge.classList.toggle('hidden', !maintenance);
        } else badge?.classList.remove('hidden');
        gate?.classList.remove('hidden');
        let release,workspace;
        try {
          workspace = await import('./productionV2/cleanWorkspace.mjs');
          const {openCleanStore,acquireCleanLease} = workspace;
          release = await acquireCleanLease(navigator.locks,location.search);
          cleanWorkspaceStore = openCleanStore((globalThis.raytechStorage??globalThis.localStorage),getTodayYM(),location.search);
          if(workspace.databaseKey(location.search)!==STORAGE_DATABASE_KEY||cleanWorkspaceStore.readCurrent()!==(globalThis.raytechStorage??globalThis.localStorage).getItem(STORAGE_DATABASE_KEY)) throw Error('CLEAN_WORKSPACE_SELECTION');
          window.productionCleanWorkspaceReady = true;
          window.addEventListener('pagehide', () => { window.productionCleanWorkspaceReady=false; release(); }, {once:true});
          window.addEventListener('pageshow', event => { if(event.persisted) location.reload(); });
          if(MAIN_WORKSPACE) window.updateMainCapacity=()=>{try{document.getElementById('mainCapacityStatus').textContent=workspace.capacityMessage(cleanWorkspaceStore.read());}catch{}};
          gate?.classList.add('hidden');
        } catch (err) {
          if(MAIN_WORKSPACE && release && workspace && err?.message==='CLEAN_RECOVERY_REQUIRED'){
            const expected=workspace.recoveryState((globalThis.raytechStorage??globalThis.localStorage));
            if(expected.available){
              const form=document.getElementById('mainRecoveryForm'),status=document.getElementById('cleanWorkspaceGateStatus');
              status.textContent='Banco V2 principal indisponível. Restaure somente um backup JSON identificado do principal. Legado e testes permanecem intactos.';
              form.classList.remove('hidden');form.hidden=false;
              const pin=document.getElementById('mainRecoveryPin'),requiresPin=(globalThis.raytechStorage??globalThis.localStorage).getItem(STORAGE_PIN_KEY)!==null;
              pin.hidden=!requiresPin;pin.required=requiresPin;
              let active=true;
              window.addEventListener('pagehide',()=>{active=false;release();},{once:true});
              form.addEventListener('submit',async event=>{
                event.preventDefault();const btn=document.getElementById('mainRecoverySubmit');
                if(btn.disabled||!active)return;btn.disabled=true;
                try{
                  const file=document.getElementById('mainRecoveryFile').files[0];
                  if(!file||file.size>2000000)throw Error('RECOVERY_FILE');
                  const backup=JSON.parse(await file.text());
                  if(!active)return;
                  workspace.recoverMainStore((globalThis.raytechStorage??globalThis.localStorage),{expected,backup,pin:pin.value,confirmed:document.getElementById('mainRecoveryConfirm').checked});
                  pin.value='';status.textContent='Recuperação concluída. Reabrindo o banco principal.';
                  active=false;release();location.reload();
                }catch(e){
                  const messages={RECOVERY_PIN:'PIN incorreto.',RECOVERY_CLOUD_BOUND:'Banco vinculado à nuvem: recuperação exige conciliação específica.',RECOVERY_ARCHIVE_OCCUPIED:'Já existe uma cópia de quarentena diferente. Não sobrescrevemos nenhuma cópia.',RECOVERY_CHANGED:'O banco mudou. Feche esta página e reabra para verificar.',RECOVERY_FILE:'Selecione um backup JSON de até 2 MB.'};
                  status.textContent=(messages[e?.message]||'Recuperação recusada. Verifique o arquivo e o espaço disponível.')+' Nenhum banco anterior foi descartado.';
                  pin.value='';btn.disabled=false;
                }
              });
              return;
            }
            if(expected.checkpoint!==null){release();document.getElementById('cleanWorkspaceGateStatus').textContent='Banco principal vinculado à nuvem. Recuperação exige conciliação específica; metadados preservados.';return;}
          }
          release?.();
          window.productionCleanWorkspaceReady = false;
          document.getElementById('cleanWorkspaceGateStatus').textContent = 'V2 indisponível. Feche outras abas V2 ou recupere o banco separado. Nenhum banco existente foi substituído.';
          return;
        }
      }
      loadDatabase();
      window.updateMainCapacity?.();
      updateMonthHeader();
      renderAll();
      bindSummaryNavigation();
      setupPasteAndDropEvents();
      updateApiKeyStatusBadge();
      checkPinLockOnStartup();

      salaryInput.addEventListener('input', (e) => {
        if (isPrivacyMode) return;
        const val = parseCurrencyInput(e.target.value);
        const currentData = getCurrentMonthData();
        currentData.salary = Math.max(0, val);
        saveDatabase();
        renderSummaryOnly();

        if (salaryNotice) {
          salaryNotice.style.opacity = '1';
          setTimeout(() => {
            salaryNotice.style.opacity = '0';
          }, 1500);
        }
      });
    });

    // Configuração de Drag & Drop e Colar Imagem
    function openIncomeModal(editId = null) {
      const modal = document.getElementById('incomeModal');
      const titleEl = document.getElementById('incomeModalTitle');
      const editIdInput = document.getElementById('incomeEditId');
      const descInput = document.getElementById('incomeDesc');
      const amountInput = document.getElementById('incomeAmount');
      const dateInput = document.getElementById('incomeDate');
      const currentData = getCurrentMonthData();

      if (editId) {
        const item = (currentData.extraIncomes || []).find(i => i.id === editId);
        if (item) {
          titleEl.textContent = 'Editar Entrada Extra';
          editIdInput.value = item.id;
          descInput.value = item.description;
          amountInput.value = formatForInput(item.amount);
          dateInput.value = item.date || getTodayFullDate();
        }
      } else {
        titleEl.textContent = 'Adicionar Entrada Extra';
        editIdInput.value = '';
        descInput.value = '';
        amountInput.value = '';
        dateInput.value = getTodayFullDate();
      }

      modal.classList.remove('hidden');
      descInput.focus();
    }

    function closeIncomeModal() {
      document.getElementById('incomeModal').classList.add('hidden');
    }

    function handleIncomeSubmit(e) {
      e.preventDefault();
      const currentData = getCurrentMonthData();
      if (!currentData.extraIncomes) currentData.extraIncomes = [];

      const editId = document.getElementById('incomeEditId').value;
      const desc = document.getElementById('incomeDesc').value.trim();
      const amount = parseCurrencyInput(document.getElementById('incomeAmount').value);
      const dateVal = document.getElementById('incomeDate').value || getTodayFullDate();

      if (!desc || amount <= 0) {
        showToast('Informe a descrição e um valor recebido válido!', 'error');
        return;
      }

      if (editId) {
        const item = currentData.extraIncomes.find(i => i.id === editId);
        if (item) {
          item.description = desc;
          item.amount = amount;
          item.date = dateVal;
          showToast(`Entrada "${desc}" atualizada!`, 'success');
        }
      } else {
        currentData.extraIncomes.push({
          id: 'inc_' + Date.now() + '_' + Math.random().toString(36).substr(2, 4),
          description: desc,
          amount: amount,
          date: dateVal
        });
        showToast(`Recebimento de ${formatBRL(amount)} adicionado!`, 'success');
      }

      saveDatabase();
      renderAll();
      closeIncomeModal();
    }

    function promptDeleteIncome(id) {
      const currentData = getCurrentMonthData();
      const item = (currentData.extraIncomes || []).find(i => i.id === id);
      if (!item) return;

      showModal(
        'Remover Entrada Extra',
        `Deseja excluir o recebimento "${item.description}" no valor de ${formatBRL(item.amount)}?`,
        () => {
          currentData.extraIncomes = currentData.extraIncomes.filter(i => i.id !== id);
          saveDatabase();
          renderAll();
          showToast(`Entrada "${item.description}" removida.`, 'info');
        }
      );
    }
    // Summary shortcuts are UI only; they never modify the selected month or financial data.
    function bindSummaryNavigation() {
      let highlighted = null, highlightTimer = null, navigationToken = 0;
      const routes = {
        income: { id: 'summaryIncomeDestination', color: '#34d399' },
        fixed: { id: 'summaryExpensesDestination', tab: 'general', filter: 'fixed', color: '#a5b4fc' },
        'one-time': { id: 'summaryExpensesDestination', tab: 'general', filter: 'one-time', color: '#facc15' },
        card: { id: 'summaryCardDestination', tab: 'card', filter: 'all', color: '#d8b4fe' }
      };
      function navigate(key) {
        const route = routes[key], destination = route && document.getElementById(route.id);
        if (!destination || window.raytechSessionRevoked || document.getElementById('smartAccountApp')?.hidden || (document.getElementById('pinLockOverlay') && !document.getElementById('pinLockOverlay').classList.contains('hidden'))) return;
        if (route.tab) switchTab(route.tab);
        if (route.tab === 'general') {
          const search = document.getElementById('generalSearchInput');
          if (search) search.value = '';
          setFilter(route.filter);
          const rows = document.getElementById('expensesContainer');
          if (rows) rows.scrollTop = 0;
        } else if (route.tab === 'card') {
          const search = document.getElementById('cardSearchInput');
          if (search) search.value = '';
          setCardFilter('all');
          const rows = document.getElementById('cardExpensesContainer');
          if (rows) rows.scrollTop = 0;
        }
        clearTimeout(highlightTimer);
        highlighted?.classList.remove('raytech-summary-destination-active');
        highlighted = destination;
        destination.style.setProperty('--raytech-shortcut-color',route.color);
        const token = ++navigationToken;
        requestAnimationFrame(() => {
          if (token !== navigationToken || window.raytechSessionRevoked) return;
          const header = document.querySelector('.raytech-header-shell');
          const offset = Math.max(0,header?.getBoundingClientRect().height || 0) + 12;
          destination.style.scrollMarginTop = offset + 'px';
          destination.classList.add('raytech-summary-destination-active');
          destination.focus({preventScroll:true});
          destination.scrollIntoView({block:'start',inline:'nearest',behavior:matchMedia('(prefers-reduced-motion: reduce)').matches?'instant':'smooth'});
          highlightTimer = setTimeout(()=>destination.classList.remove('raytech-summary-destination-active'),2200);
        });
      }
      for (const card of document.querySelectorAll('[data-summary-shortcut]')) {
        card.addEventListener('click',()=>navigate(card.dataset.summaryShortcut));
        card.addEventListener('keydown',event=>{
          if(event.key==='Enter'||event.key===' '){event.preventDefault();if(!event.repeat)navigate(card.dataset.summaryShortcut);}
        });
      }
    }

    function switchTab(tab) {
      currentTab = tab;
      const tabBtnGeneral = document.getElementById('tabBtnGeneral');
      const tabBtnCard = document.getElementById('tabBtnCard');
      const tabBtnAnalytics = document.getElementById('tabBtnAnalytics');
      const tabBtnHistory = document.getElementById('tabBtnHistory');

      const mobTabGeneral = document.getElementById('mobTabGeneral');
      const mobTabCard = document.getElementById('mobTabCard');
      const mobTabAnalytics = document.getElementById('mobTabAnalytics');
      const mobTabHistory = document.getElementById('mobTabHistory');

      const tabContentGeneral = document.getElementById('tabContentGeneral');
      const tabContentCard = document.getElementById('tabContentCard');
      const tabContentAnalytics = document.getElementById('tabContentAnalytics');
      const tabContentHistory = document.getElementById('tabContentHistory');

      const inactiveClass = "pb-3 px-4 font-bold text-sm sm:text-base border-b-2 border-transparent text-slate-400 hover:text-slate-200 flex items-center gap-2 transition whitespace-nowrap";

      if (tabBtnGeneral) tabBtnGeneral.className = tab === 'general' ? "pb-3 px-4 font-bold text-sm sm:text-base border-b-2 text-emerald-400 border-emerald-500 flex items-center gap-2 transition whitespace-nowrap" : inactiveClass;
      if (tabBtnCard) tabBtnCard.className = tab === 'card' ? "pb-3 px-4 font-bold text-sm sm:text-base border-b-2 text-purple-400 border-purple-500 flex items-center gap-2 transition whitespace-nowrap" : inactiveClass;
      if (tabBtnAnalytics) tabBtnAnalytics.className = tab === 'analytics' ? "pb-3 px-4 font-bold text-sm sm:text-base border-b-2 text-amber-400 border-amber-500 flex items-center gap-2 transition whitespace-nowrap" : inactiveClass;
      if (tabBtnHistory) tabBtnHistory.className = tab === 'history' ? "pb-3 px-4 font-bold text-sm sm:text-base border-b-2 text-cyan-400 border-cyan-500 flex items-center gap-2 transition whitespace-nowrap" : inactiveClass;

      if (mobTabGeneral) mobTabGeneral.className = `flex flex-col items-center justify-center py-1 px-3 rounded-xl transition ${tab === 'general' ? 'text-emerald-400 bg-emerald-950/40' : 'text-slate-400'}`;
      if (mobTabCard) mobTabCard.className = `flex flex-col items-center justify-center py-1 px-3 rounded-xl transition ${tab === 'card' ? 'text-purple-400 bg-purple-950/40' : 'text-slate-400'}`;
      if (mobTabAnalytics) mobTabAnalytics.className = `flex flex-col items-center justify-center py-1 px-3 rounded-xl transition ${tab === 'analytics' ? 'text-amber-400 bg-amber-950/40' : 'text-slate-400'}`;
      if (mobTabHistory) mobTabHistory.className = `flex flex-col items-center justify-center py-1 px-3 rounded-xl transition ${tab === 'history' ? 'text-cyan-400 bg-cyan-950/40' : 'text-slate-400'}`;

      tabContentGeneral.classList.toggle('hidden', tab !== 'general');
      tabContentCard.classList.toggle('hidden', tab !== 'card');
      tabContentAnalytics.classList.toggle('hidden', tab !== 'analytics');
      tabContentAnalytics.classList.toggle('flex', tab === 'analytics');
      tabContentHistory.classList.toggle('hidden', tab !== 'history');

      if (tab === 'analytics') {
        renderAnalyticsTab();
      } else if (tab === 'history') {
        renderHistoryList();
      }
    }
    function promptAdvanceMonth() {
      const currentYM = appDb.selectedMonth;
      const [year, month] = currentYM.split('-').map(Number);
      const nextDate = new Date(year, month, 1);
      const nextYM = `${nextDate.getFullYear()}-${String(nextDate.getMonth() + 1).padStart(2, '0')}`;
      const todayDayStr = String(new Date().getDate()).padStart(2, '0');

      showModal(
        `Fechar ${formatMonthYear(currentYM)} e Avançar?`,
        `O mês de ${formatMonthYear(currentYM)} será gravado no Histórico. Para ${formatMonthYear(nextYM)}, traremos as contas fixas e as parcelas restantes do cartão de crédito com vencimento no dia atual.`,
        () => {
          const currentData = getCurrentMonthData();
          currentData.closed = true;
          currentData.closedAt = new Date().toISOString();

          const nextExpenses = currentData.expenses
            .filter(item => item.type === 'fixed')
            .map(item => ({
              ...item,
              id: 'exp_' + Date.now() + '_' + Math.random().toString(36).substr(2, 4),
              date: `${nextYM}-${todayDayStr}`,
              paid: false
            }));

          // Nao sobrescrever um mes ja existente nem ressuscitar parcelas excluidas.
          const existingNext = appDb.months[nextYM];
          const nextCardExpenses = existingNext ? [...(existingNext.cardExpenses || [])] : [];
          const deletedNext = existingNext && Array.isArray(existingNext.deletedInstallmentOrigins) ? existingNext.deletedInstallmentOrigins : [];
          currentData.cardExpenses.forEach(item => {
            if (item.isInstallment) {
              const currentInst = item.currentInstallment || 1;
              const originId = item.installmentOriginId || item.id;
              const nextNum = currentInst + 1;
              const alreadyPresent = nextCardExpenses.some(c => c.isInstallment && Number(c.currentInstallment) === nextNum &&
                (String(c.installmentOriginId || c.id) === String(originId) ||
                  (!CLEAN_WORKSPACE && String(c.title || '').trim().toLowerCase() === String(item.title || '').trim().toLowerCase() && Number(c.installments) === Number(item.installments))));
              if (currentInst < item.installments && !deletedNext.includes(String(originId) + ':' + nextNum) && !alreadyPresent) {
                nextCardExpenses.push({
                  ...item,
                  installmentOriginId: originId,
                  id: 'card_' + Date.now() + '_' + Math.random().toString(36).substr(2, 4),
                  currentInstallment: currentInst + 1,
                  date: `${nextYM}-${todayDayStr}`,
                  paid: false
                });
              }
            }
          });

          appDb.months[nextYM] = {
            ...(existingNext || {}),
            salary: existingNext ? existingNext.salary : currentData.salary,
            budgetLimit: existingNext ? existingNext.budgetLimit : (currentData.budgetLimit || 0),
            extraIncomes: existingNext ? (existingNext.extraIncomes || []) : [],
            expenses: existingNext ? (existingNext.expenses || []) : nextExpenses,
            cardExpenses: nextCardExpenses,
            deletedInstallmentOrigins: [...deletedNext],
            closed: false,
            closedAt: null
          };

          appDb.selectedMonth = nextYM;
          saveDatabase();
          updateMonthHeader();
          renderAll();
          showToast(`Mês de ${formatMonthYear(nextYM)} aberto com sucesso!`, 'success');
        }
      );
    }

    function toggleInstallmentFields() {
      const isChecked = document.getElementById('isInstallmentCheckbox').checked;
      const oneTimeFields = document.getElementById('oneTimeCardFields');
      const installmentFields = document.getElementById('installmentCardFields');
      const cardTotalAmount = document.getElementById('cardTotalAmount');
      const cardInstallmentValue = document.getElementById('cardInstallmentValue');

      if (isChecked) {
        oneTimeFields.classList.add('hidden');
        installmentFields.classList.remove('hidden');
        cardTotalAmount.removeAttribute('required');
        cardInstallmentValue.setAttribute('required', 'required');
        calcInstallmentTotal();
      } else {
        oneTimeFields.classList.remove('hidden');
        installmentFields.classList.add('hidden');
        cardTotalAmount.setAttribute('required', 'required');
        cardInstallmentValue.removeAttribute('required');
      }
    }

    function calcInstallmentTotal() {
      const val = parseCurrencyInput(document.getElementById('cardInstallmentValue').value);
      const count = parseInt(document.getElementById('cardInstallmentCount').value) || 1;
      const total = val * count;
      document.getElementById('installmentTotalPreview').textContent = formatBRL(total);
    }

    function handleFormSubmit(e) {
      e.preventDefault();
      const currentData = getCurrentMonthData();
      if (!currentData.expenses) currentData.expenses = [];

      const titleInput = document.getElementById('expenseTitle');
      const amountInput = document.getElementById('expenseAmount');
      const categoryInput = document.getElementById('expenseCategory');
      const typeInput = document.querySelector('input[name="expenseType"]:checked');
      const todayDayStr = String(new Date().getDate()).padStart(2, '0');
      const dateVal = expenseDate.value || `${appDb.selectedMonth}-${todayDayStr}`;

      const title = titleInput.value.trim();
      const amount = parseCurrencyInput(amountInput.value);
      const type = typeInput ? typeInput.value : 'fixed';
      const category = categoryInput ? categoryInput.value : inferCategoryFromTitle(title);

      if (!title || amount <= 0) {
        showToast('Informe o nome da despesa e um valor válido!', 'error');
        return;
      }

      currentData.expenses.unshift({
        id: 'exp_' + Date.now() + '_' + Math.random().toString(36).substr(2, 4),
        title,
        category,
        amount,
        type,
        date: dateVal,
        paid: false
      });

      activeFilter = 'all';
      const filterBtns = {
        'all': document.getElementById('filterAll'),
        'fixed': document.getElementById('filterFixed'),
        'one-time': document.getElementById('filterOneTime')
      };
      if (filterBtns.all) {
        filterBtns.all.className = 'px-3 py-1.5 rounded-lg bg-slate-800 text-white transition';
        if (filterBtns.fixed) filterBtns.fixed.className = 'px-3 py-1.5 rounded-lg text-slate-400 hover:text-white transition';
        if (filterBtns['one-time']) filterBtns['one-time'].className = 'px-3 py-1.5 rounded-lg text-slate-400 hover:text-white transition';
      }

      saveDatabase();
      renderAll();

      titleInput.value = '';
      amountInput.value = '';
      titleInput.focus();
      showToast(`Despesa "${title}" adicionada!`, 'success');
    }

    function handleCardFormSubmit(e) {
      e.preventDefault();
      const currentData = getCurrentMonthData();
      if (!currentData.cardExpenses) currentData.cardExpenses = [];

      const titleInput = document.getElementById('cardItemTitle');
      const categoryInput = document.getElementById('cardItemCategory');
      const isInstallment = document.getElementById('isInstallmentCheckbox').checked;
      const title = titleInput.value.trim();
      const category = categoryInput ? categoryInput.value : inferCategoryFromTitle(title);

      if (!title) {
        showToast('Informe o que comprou no cartão!', 'error');
        return;
      }

      let installmentValue = 0;
      let totalAmount = 0;
      let installments = 1;
      let dateVal = '';

      if (isInstallment) {
        installmentValue = parseCurrencyInput(document.getElementById('cardInstallmentValue').value);
        installments = parseInt(document.getElementById('cardInstallmentCount').value) || 2;
        const todayDayStr = String(new Date().getDate()).padStart(2, '0');
        dateVal = document.getElementById('cardInstallmentDate').value || `${appDb.selectedMonth}-${todayDayStr}`;

        if (installmentValue <= 0 || isNaN(installments) || installments < 2) {
          showToast('Preencha o valor da parcela e o número de parcelas!', 'error');
          return;
        }
        totalAmount = installmentValue * installments;
      } else {
        totalAmount = parseCurrencyInput(document.getElementById('cardTotalAmount').value);
        installmentValue = totalAmount;
        installments = 1;
        const todayDayStr = String(new Date().getDate()).padStart(2, '0');
        dateVal = document.getElementById('cardDate').value || `${appDb.selectedMonth}-${todayDayStr}`;

        if (totalAmount <= 0) {
          showToast('Preencha o valor da compra!', 'error');
          return;
        }
      }

      const newCardId = 'card_' + Date.now() + '_' + Math.random().toString(36).substr(2, 4);
      currentData.cardExpenses.unshift({
        id: newCardId,
        installmentOriginId: isInstallment ? newCardId : undefined,
        title,
        category,
        isInstallment,
        installmentValue,
        totalAmount,
        installments,
        currentInstallment: 1,
        date: dateVal,
        paid: false
      });

      activeCardFilter = 'all';
      const cardFilterBtns = {
        'all': document.getElementById('cardFilterAll'),
        'fixed': document.getElementById('cardFilterFixed'),
        'one-time': document.getElementById('cardFilterOneTime')
      };
      if (cardFilterBtns.all) {
        cardFilterBtns.all.className = 'px-2.5 sm:px-3 py-1.5 rounded-lg bg-slate-800 text-white transition';
        if (cardFilterBtns.fixed) cardFilterBtns.fixed.className = 'px-2.5 sm:px-3 py-1.5 rounded-lg text-slate-400 hover:text-white transition';
        if (cardFilterBtns['one-time']) cardFilterBtns['one-time'].className = 'px-2.5 sm:px-3 py-1.5 rounded-lg text-slate-400 hover:text-white transition';
      }

      saveDatabase();
      renderAll();

      titleInput.value = '';
      document.getElementById('cardTotalAmount').value = '';
      document.getElementById('cardInstallmentValue').value = '';
      document.getElementById('cardInstallmentCount').value = '2';
      document.getElementById('isInstallmentCheckbox').checked = false;
      toggleInstallmentFields();
      titleInput.focus();

      showToast(`Compra "${title}" incluída na fatura!`, 'success');
    }

    function setFilter(type) {
      activeFilter = type;
      const filterBtns = {
        'all': document.getElementById('filterAll'),
        'fixed': document.getElementById('filterFixed'),
        'one-time': document.getElementById('filterOneTime')
      };

      Object.keys(filterBtns).forEach(key => {
        const btn = filterBtns[key];
        if (btn) {
          if (key === type) {
            btn.className = 'px-3 py-1.5 rounded-lg bg-slate-800 text-white transition';
          } else {
            btn.className = 'px-3 py-1.5 rounded-lg text-slate-400 hover:text-white transition';
          }
        }
      });

      renderExpensesList();
    }

    function setCardFilter(type) {
      activeCardFilter = type;
      const filterBtns = {
        'all': document.getElementById('cardFilterAll'),
        'fixed': document.getElementById('cardFilterFixed'),
        'one-time': document.getElementById('cardFilterOneTime')
      };

      Object.keys(filterBtns).forEach(key => {
        const btn = filterBtns[key];
        if (btn) {
          if (key === type) {
            btn.className = 'px-2.5 sm:px-3 py-1.5 rounded-lg bg-slate-800 text-white transition';
          } else {
            btn.className = 'px-2.5 sm:px-3 py-1.5 rounded-lg text-slate-400 hover:text-white transition';
          }
        }
      });

      renderCardExpensesList();
    }

    function deleteExpense(id) {
      const currentData = getCurrentMonthData();
      const item = currentData.expenses.find(e => e.id === id);
      if (!item) return;
      currentData.expenses = currentData.expenses.filter(e => e.id !== id);
      saveDatabase();
      renderAll();
      showToast(`"${item.title}" removido.`, 'info');
    }

    function deleteCardExpense(id) {
      const currentData = getCurrentMonthData();
      const item = currentData.cardExpenses.find(e => e.id === id);
      if (!item) return;
      if (item.isInstallment) {
        if (!Array.isArray(currentData.deletedInstallmentOrigins)) currentData.deletedInstallmentOrigins = [];
        const origin = item.installmentOriginId || item.id;
        const key = String(origin) + ':' + String(item.currentInstallment || 1);
        if (!currentData.deletedInstallmentOrigins.includes(key)) currentData.deletedInstallmentOrigins.push(key);
      }
      currentData.cardExpenses = currentData.cardExpenses.filter(e => e.id !== id);
      saveDatabase();
      renderAll();
      showToast(`Compra "${item.title}" removida do cartão.`, 'info');
    }
    function promptDeleteExpense(id) {
      const currentData = getCurrentMonthData();
      const item = currentData.expenses.find(e => e.id === id);
      if (!item) return;

      showModal(
        'Excluir Despesa',
        `Tem certeza que deseja apagar a despesa "${item.title}" no valor de ${formatBRL(item.amount)}?`,
        () => deleteExpense(id)
      );
    }

    function promptDeleteCardExpense(id) {
      const currentData = getCurrentMonthData();
      const item = currentData.cardExpenses.find(e => e.id === id);
      if (!item) return;

      showModal(
        'Excluir Compra do Cartão',
        `Deseja remover "${item.title}" (${formatBRL(item.installmentValue)}) da sua fatura?`,
        () => deleteCardExpense(id)
      );
    }

    function promptClearAll(target) {
      if (target === 'expenses') {
        showModal(
          'Limpar Despesas Gerais',
          'Deseja remover todas as despesas gerais deste mês? Esta ação não pode ser desfeita.',
          () => {
            const currentData = getCurrentMonthData();
            currentData.expenses = [];
            saveDatabase();
            renderAll();
            showToast('Todas as despesas gerais foram removidas.', 'info');
          }
        );
      } else if (target === 'card') {
        showModal(
          'Limpar Fatura do Cartão',
          'Deseja zerar todas as compras da fatura do cartão para este mês?',
          () => {
            const currentData = getCurrentMonthData();
            if (!Array.isArray(currentData.deletedInstallmentOrigins)) currentData.deletedInstallmentOrigins = [];
            currentData.cardExpenses.forEach(item => {
              if (!item.isInstallment) return;
              const key = String(item.installmentOriginId || item.id) + ':' + String(item.currentInstallment || 1);
              if (!currentData.deletedInstallmentOrigins.includes(key)) currentData.deletedInstallmentOrigins.push(key);
            });
            currentData.cardExpenses = [];
            saveDatabase();
            renderAll();
            showToast('Fatura do cartão foi limpa.', 'info');
          }
        );
      }
    }

    function showModal(title, description, onConfirm) {
      const modal = document.getElementById('confirmModal');
      document.getElementById('modalTitle').textContent = title;
      document.getElementById('modalDesc').textContent = description;
      pendingModalAction = onConfirm;
      modal.classList.remove('hidden');

      const confirmBtn = document.getElementById('modalConfirmBtn');
      const cancelBtn = document.getElementById('modalCancelBtn');

      const cleanup = () => {
        confirmBtn.onclick = null;
        cancelBtn.onclick = null;
        modal.classList.add('hidden');
        pendingModalAction = null;
      };

      confirmBtn.onclick = () => {
        if (typeof pendingModalAction === 'function') {
          pendingModalAction();
        }
        cleanup();
      };

      cancelBtn.onclick = () => {
        cleanup();
      };
    }
    function showToast(message, type = 'info') {
      const toast = document.getElementById('toast');
      const toastMsg = document.getElementById('toastMsg');
      const toastIcon = document.getElementById('toastIcon');

      toastMsg.textContent = message;
      toast.className = 'fixed bottom-20 sm:bottom-6 right-6 z-50 transition-all duration-300 flex items-center gap-3 px-4 py-3 rounded-xl shadow-2xl border text-sm font-medium pointer-events-none ';

      if (type === 'success') {
        toast.className += 'bg-emerald-950/90 border-emerald-500/40 text-emerald-200';
        toastIcon.className = 'fa-solid fa-circle-check text-emerald-400';
      } else if (type === 'error') {
        toast.className += 'bg-rose-950/90 border-rose-500/40 text-rose-200';
        toastIcon.className = 'fa-solid fa-circle-exclamation text-rose-400';
      } else {
        toast.className += 'bg-slate-900/90 border-slate-700 text-slate-200';
        toastIcon.className = 'fa-solid fa-circle-info text-blue-400';
      }

      toast.classList.remove('opacity-0', 'translate-y-20');
      toast.classList.add('opacity-100', 'translate-y-0');

      setTimeout(() => {
        toast.classList.remove('opacity-100', 'translate-y-0');
        toast.classList.add('opacity-0', 'translate-y-20');
      }, 3500);
    }

    function escapeHtml(text) {
      if (!text) return '';
      return String(text)
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");
    }
