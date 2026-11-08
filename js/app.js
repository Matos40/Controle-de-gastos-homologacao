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
  const icon192 = generatePwaIconDataUrl(192);
  const appleLink = document.getElementById('appleTouchIconLink');
  if (appleLink && icon192) appleLink.href = icon192;
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
  if ('serviceWorker' in navigator && (location.protocol === 'https:' || location.hostname === 'localhost')) {
    navigator.serviceWorker.register('./sw.js').catch(err => console.warn('Falha ao registrar Service Worker:', err));
  }
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
      const savedPin = localStorage.getItem(STORAGE_PIN_KEY);
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
      const savedPin = localStorage.getItem(STORAGE_PIN_KEY);
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
      const savedPin = localStorage.getItem(STORAGE_PIN_KEY);
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
      localStorage.setItem(STORAGE_PIN_KEY, val);
      const pinIcon = document.getElementById('pinHeaderIcon');
      if (pinIcon) pinIcon.className = 'fa-solid fa-lock text-emerald-400 text-sm';
      closePinModal();
      showToast('Bloqueio por PIN ativado com sucesso!', 'success');
    }

    function removePinLock() {
      localStorage.removeItem(STORAGE_PIN_KEY);
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
    window.addEventListener('DOMContentLoaded', () => {
      if (DEFAULT_API_KEY && !localStorage.getItem(STORAGE_GEMINI_KEY)) {
        localStorage.setItem(STORAGE_GEMINI_KEY, DEFAULT_API_KEY);
      }

      initPwaEnvironment();
      loadDatabase();
      updateMonthHeader();
      renderAll();
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

          const nextCardExpenses = [];
          currentData.cardExpenses.forEach(item => {
            if (item.isInstallment) {
              const currentInst = item.currentInstallment || 1;
              if (currentInst < item.installments) {
                nextCardExpenses.push({
                  ...item,
                  id: 'card_' + Date.now() + '_' + Math.random().toString(36).substr(2, 4),
                  currentInstallment: currentInst + 1,
                  date: `${nextYM}-${todayDayStr}`,
                  paid: false
                });
              }
            }
          });

          appDb.months[nextYM] = {
            salary: currentData.salary,
            budgetLimit: currentData.budgetLimit || 0,
            extraIncomes: [],
            expenses: nextExpenses,
            cardExpenses: nextCardExpenses,
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

      currentData.cardExpenses.unshift({
        id: 'card_' + Date.now() + '_' + Math.random().toString(36).substr(2, 4),
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
