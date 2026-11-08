/* Persistência local, criação de meses e sincronização de despesas. */
    function syncFromPreviousMonth(isManual = false) {
      const currentYM = appDb.selectedMonth;
      const prevYM = getPreviousMonthYM(currentYM);
      const prevData = appDb.months[prevYM];

      if (!prevData) {
        if (isManual) {
          showToast(`Não há dados cadastrados em ${formatMonthYear(prevYM)} para sincronizar.`, 'info');
        }
        return false;
      }

      const currentData = getCurrentMonthData();
      const todayDayStr = String(new Date().getDate()).padStart(2, '0');

      const syncIcon = document.getElementById('syncBtnIcon');
      if (syncIcon) syncIcon.classList.add('fa-spin');

      let addedFixedCount = 0;
      let updatedFixedCount = 0;

      if (!currentData.expenses) currentData.expenses = [];
      const prevFixed = (prevData.expenses || []).filter(e => e.type === 'fixed');

      prevFixed.forEach(pItem => {
        const existingIndex = currentData.expenses.findIndex(e => e.title.trim().toLowerCase() === pItem.title.trim().toLowerCase());
        if (existingIndex !== -1) {
          if (currentData.expenses[existingIndex].amount !== pItem.amount) {
            currentData.expenses[existingIndex].amount = pItem.amount;
            updatedFixedCount++;
          }
        } else {
          currentData.expenses.push({
            id: 'exp_sync_' + Date.now() + '_' + Math.random().toString(36).substr(2, 4),
            title: pItem.title,
            category: pItem.category || inferCategoryFromTitle(pItem.title),
            amount: pItem.amount,
            type: 'fixed',
            date: `${currentYM}-${todayDayStr}`,
            paid: false
          });
          addedFixedCount++;
        }
      });

      if (!currentData.salary && prevData.salary > 0) {
        currentData.salary = prevData.salary;
      }

      if (!currentData.cardExpenses) currentData.cardExpenses = [];
      let addedCardCount = 0;

      (prevData.cardExpenses || []).forEach(pCard => {
        if (pCard.isInstallment) {
          const nextInstallmentNum = (pCard.currentInstallment || 1) + 1;
          const totalInst = pCard.installments || 1;

          if (nextInstallmentNum <= totalInst) {
            const cardExists = currentData.cardExpenses.some(c => 
              c.title.trim().toLowerCase() === pCard.title.trim().toLowerCase() && 
              c.isInstallment && 
              c.currentInstallment === nextInstallmentNum
            );

            if (!cardExists) {
              currentData.cardExpenses.push({
                ...pCard,
                id: 'card_sync_' + Date.now() + '_' + Math.random().toString(36).substr(2, 4),
                category: pCard.category || inferCategoryFromTitle(pCard.title),
                currentInstallment: nextInstallmentNum,
                date: `${currentYM}-${todayDayStr}`,
                paid: false
              });
              addedCardCount++;
            }
          }
        }
      });

      saveDatabase();
      renderAll();

      setTimeout(() => {
        if (syncIcon) syncIcon.classList.remove('fa-spin');
      }, 500);

      if (isManual) {
        if (addedFixedCount > 0 || updatedFixedCount > 0 || addedCardCount > 0) {
          showToast(`Sincronizado de ${formatMonthYear(prevYM)}: ${addedFixedCount} fixos adicionados, ${updatedFixedCount} atualizados e ${addedCardCount} parcelas inseridas!`, 'success');
        } else {
          showToast(`Tudo atualizado! Nenhum novo gasto fixo pendente em ${formatMonthYear(prevYM)}.`, 'info');
        }
      }

      return true;
    }
    function ensureMonthExists(ym) {
      if (!appDb.months[ym]) {
        const monthKeys = Object.keys(appDb.months).sort();
        const prevYM = getPreviousMonthYM(ym);
        
        const prevData = appDb.months[prevYM] || (monthKeys.length > 0 ? appDb.months[monthKeys[monthKeys.length - 1]] : null);
        const prevSalary = prevData ? (prevData.salary || 0) : 3500;
        const prevBudget = prevData ? (prevData.budgetLimit || 0) : 0;
        const todayDayStr = String(new Date().getDate()).padStart(2, '0');

        const inheritedFixedExpenses = prevData && prevData.expenses
          ? prevData.expenses
              .filter(item => item.type === 'fixed')
              .map((item, idx) => {
                return {
                  ...item,
                  id: 'exp_inherited_' + Date.now() + '_' + idx + '_' + Math.random().toString(36).substr(2, 4),
                  category: item.category || inferCategoryFromTitle(item.title),
                  date: `${ym}-${todayDayStr}`,
                  paid: false
                };
              })
          : [];

        let inheritedCardExpenses = [];
        if (prevData && prevData.cardExpenses) {
          prevData.cardExpenses.forEach((item, idx) => {
            if (item.isInstallment) {
              const currentInst = item.currentInstallment || 1;
              if (currentInst < item.installments) {
                inheritedCardExpenses.push({
                  ...item,
                  id: 'card_inherited_' + Date.now() + '_' + idx + '_' + Math.random().toString(36).substr(2, 4),
                  category: item.category || inferCategoryFromTitle(item.title),
                  currentInstallment: currentInst + 1,
                  date: `${ym}-${todayDayStr}`,
                  paid: false
                });
              }
            }
          });
        } else {
          inheritedCardExpenses = [];
        }

        appDb.months[ym] = {
          salary: prevSalary,
          budgetLimit: prevBudget,
          extraIncomes: [],
          expenses: inheritedFixedExpenses,
          cardExpenses: inheritedCardExpenses,
          closed: false,
          closedAt: null
        };
      }
    }

    function loadDatabase() {
      try {
        const saved = localStorage.getItem(STORAGE_DATABASE_KEY);
        if (saved) {
          appDb = JSON.parse(saved);
          if (!appDb.selectedMonth) appDb.selectedMonth = '2026-10';
          Object.keys(appDb.months || {}).forEach(k => {
            const m = appDb.months[k];
            if (!m.extraIncomes) m.extraIncomes = [];
            if (!m.expenses) m.expenses = [];
            if (!m.cardExpenses) m.cardExpenses = [];
            if (m.budgetLimit === undefined) m.budgetLimit = 0;
            m.expenses.forEach(e => { if (!e.category) e.category = inferCategoryFromTitle(e.title); });
            m.cardExpenses.forEach(c => { if (!c.category) c.category = inferCategoryFromTitle(c.title); });
          });
          if (appDb.months && appDb.months['2026-10'] && (!appDb.months['2026-10'].cardExpenses || appDb.months['2026-10'].cardExpenses.length === 0)) {
            appDb.months['2026-10'].cardExpenses = [];
            saveDatabase();
          }
        } else {
          const ym = '2026-10';
          appDb.selectedMonth = ym;
          appDb.months = {
            [ym]: {
              salary: 3500.00,
              budgetLimit: 3200.00,
              extraIncomes: [],
              expenses: [
                { id: '1', title: 'Conta de Luz', category: 'moradia', amount: 180.00, type: 'fixed', date: `${ym}-10`, paid: false },
                { id: '2', title: 'Água e Esgoto', category: 'moradia', amount: 95.50, type: 'fixed', date: `${ym}-12`, paid: false }
              ],
              cardExpenses: [],
              closed: false,
              closedAt: null
            }
          };
          saveDatabase();
        }
      } catch (e) {
        console.error('Erro ao ler DB:', e);
      }
    }

    function saveDatabase() {
      localStorage.setItem(STORAGE_DATABASE_KEY, JSON.stringify(appDb));
    }

    function changeMonth(delta) {
      const [year, month] = appDb.selectedMonth.split('-').map(Number);
      const d = new Date(year, month - 1 + delta, 1);
      appDb.selectedMonth = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
      ensureMonthExists(appDb.selectedMonth);

      const curData = appDb.months[appDb.selectedMonth];
      if (curData && (!curData.expenses || curData.expenses.length === 0)) {
        syncFromPreviousMonth(false);
      }

      saveDatabase();
      updateMonthHeader();
      renderAll();
    }

    function updateMonthHeader() {
      if (currentMonthDisplay) {
        currentMonthDisplay.textContent = formatMonthYear(appDb.selectedMonth);
      }
      const todayDate = getTodayFullDate();
      const currentYM = appDb.selectedMonth;
      const todayYM = getTodayYM();

      let initialDate = todayDate;
      if (currentYM !== todayYM) {
        const todayDay = String(new Date().getDate()).padStart(2, '0');
        initialDate = `${currentYM}-${todayDay}`;
      }

      if (expenseDate) expenseDate.value = initialDate;
      const cDate = document.getElementById('cardDate');
      const cInstDate = document.getElementById('cardInstallmentDate');
      if (cDate) cDate.value = initialDate;
      if (cInstDate) cInstDate.value = initialDate;
    }
