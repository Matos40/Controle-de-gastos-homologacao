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
        const existingIndex = currentData.expenses.findIndex(e => e.type === 'fixed' && String(e.title || '').trim().toLowerCase() === String(pItem.title || '').trim().toLowerCase());
        if (existingIndex !== -1) {
          // Uma despesa ja existente pode ter sido editada neste mes: preservar seu valor.
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
            const originId = pCard.installmentOriginId || pCard.id;
            // Parcelas antigas nao possuem identificador de origem.
            // Nesse caso, evita duplicacao pelo conjunto titulo + parcela + valor.
            const deletedOrigins = currentData.deletedInstallmentOrigins || [];
            const deletedKey = String(originId) + ':' + String(nextInstallmentNum);
            if (deletedOrigins.includes(deletedKey)) return;
            const cardExists = currentData.cardExpenses.some(c => {
              if (!c.isInstallment || Number(c.currentInstallment) !== Number(nextInstallmentNum)) return false;
              if (c.installmentOriginId && originId) return c.installmentOriginId === originId;
              return String(c.title || '').trim().toLowerCase() === String(pCard.title || '').trim().toLowerCase()
                && Number(c.installments) === Number(totalInst);
            });

            if (!cardExists) {
              currentData.cardExpenses.push({
                ...pCard,
                id: 'card_sync_' + Date.now() + '_' + Math.random().toString(36).substr(2, 4),
                installmentOriginId: originId,
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
        
        const priorMonths = monthKeys.filter(key => key < ym);
        const fallbackYM = priorMonths.length ? priorMonths[priorMonths.length - 1] : null;
        const prevData = appDb.months[prevYM] || (fallbackYM ? appDb.months[fallbackYM] : null);
        const prevSalary = prevData ? (prevData.salary || 0) : 0;
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
                  installmentOriginId: item.installmentOriginId || item.id,
                  category: item.category || inferCategoryFromTitle(item.title),
                  currentInstallment: currentInst + 1,
                  date: `${ym}-${todayDayStr}`,
                  paid: false
                });
              }
            }
          });
        }

        appDb.months[ym] = {
          salary: prevSalary,
          budgetLimit: prevBudget,
          extraIncomes: [],
          expenses: inheritedFixedExpenses,
          cardExpenses: inheritedCardExpenses,
          deletedInstallmentOrigins: [],
          closed: false,
          closedAt: null
        };
      }
    }


    function validateBackupDatabase(db) {
      if (!db || typeof db !== 'object' || Array.isArray(db) ||
          !db.months || typeof db.months !== 'object' || Array.isArray(db.months) ||
          typeof db.selectedMonth !== 'string' ||
          !/^\d{4}-(0[1-9]|1[0-2])$/.test(db.selectedMonth) ||
          !Object.prototype.hasOwnProperty.call(db.months, db.selectedMonth)) {
        throw new Error('Backup invalido: estrutura de meses ou mes selecionado ausente.');
      }
      const keys = Object.keys(db.months);
      if (!keys.length) throw new Error('Backup invalido: nenhum mes encontrado.');
      for (const ym of keys) {
        const m = db.months[ym];
        if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(ym) ||
            !m || typeof m !== 'object' || Array.isArray(m) ||
            !Array.isArray(m.expenses) || !Array.isArray(m.cardExpenses) ||
            (m.extraIncomes !== undefined && !Array.isArray(m.extraIncomes)) ||
            (m.salary !== undefined && (!Number.isFinite(m.salary) || m.salary < 0)) ||
            (m.budgetLimit !== undefined && (!Number.isFinite(m.budgetLimit) || m.budgetLimit < 0))) {
          throw new Error('Backup invalido: dados inconsistentes em ' + ym);
        }
        for (const item of m.expenses) {
          if (!item || typeof item.title !== 'string' || !Number.isFinite(item.amount) || item.amount < 0)
            throw new Error('Backup invalido: despesa inconsistente em ' + ym);
        }
        for (const item of m.cardExpenses) {
          if (!item || typeof item.title !== 'string' || !Number.isFinite(item.installmentValue) ||
              item.installmentValue < 0 || (item.isInstallment &&
              (!Number.isInteger(item.installments) || item.installments < 2 ||
               !Number.isInteger(item.currentInstallment) || item.currentInstallment < 1 ||
               item.currentInstallment > item.installments)))
            throw new Error('Backup invalido: parcela inconsistente em ' + ym);
        }
      }
      return db;
    }

    function validateRestoreCandidate(candidate) {
      if (MAIN_WORKSPACE && localStorage.getItem('hml_smart326_raytech_cg_v2_main_sync_v1:raytech_production_v2_device') !== null) throw Error('Banco vinculado. Prepare a restauração revisada pelo painel Nuvem V2. Nenhum dado foi alterado.');
      const validated = validateBackupDatabase(candidate);
      if (CLEAN_WORKSPACE) {
        if (!cleanWorkspaceStore || window.productionCleanWorkspaceReady !== true) throw Error('Banco V2 não está pronto. Abra novamente o banco separado.');
        try { cleanWorkspaceStore.check(JSON.stringify(validated)); }
        catch { throw Error('Backup incompatível com o banco V2. Use um backup V2 válido; o arquivo legado exige migração separada. Nenhum dado foi alterado.'); }
      }
      return validated;
    }

    function restoreBackupDatabase(candidate) {
      const restored = validateRestoreCandidate(candidate);
      const previous = appDb;
      appDb = restored;
      try {
        saveDatabase();
      } catch (err) {
        appDb = previous;
        throw err;
      }
      updateMonthHeader();
      renderAll();
    }

    function loadDatabase() {
      if (CLEAN_WORKSPACE) {
        if (!cleanWorkspaceStore) throw Error('CLEAN_RECOVERY_REQUIRED');
        appDb = cleanWorkspaceStore.snapshot();
        return;
      }
      try {
        const saved = localStorage.getItem(STORAGE_DATABASE_KEY);
        if (saved) {
          appDb = JSON.parse(saved);
          if (!appDb.selectedMonth) appDb.selectedMonth = getTodayYM();
          Object.keys(appDb.months || {}).forEach(k => {
            const m = appDb.months[k];
            if (!m.extraIncomes) m.extraIncomes = [];
            if (!m.expenses) m.expenses = [];
            if (!m.cardExpenses) m.cardExpenses = [];
            if (m.budgetLimit === undefined) m.budgetLimit = 0;
            m.expenses.forEach(e => { if (!e.category) e.category = inferCategoryFromTitle(e.title); });
            m.cardExpenses.forEach(c => { if (!c.category) c.category = inferCategoryFromTitle(c.title); });
          });
        } else {
          const ym = getTodayYM();
          appDb.selectedMonth = ym;
          appDb.months = {
            [ym]: {
              salary: 0,
              budgetLimit: 0,
              extraIncomes: [],
              expenses: [],
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
      if (CLEAN_WORKSPACE) {
        if (!cleanWorkspaceStore || window.productionCleanWorkspaceReady !== true) throw Error('CLEAN_WORKSPACE_NOT_READY');
        try {
          cleanWorkspaceStore.save(JSON.stringify(appDb));
          if(MAIN_WORKSPACE) { window.updateMainCapacity?.(); window.dispatchEvent(new Event('raytech-finance-saved')); }
        } catch (err) {
          appDb = cleanWorkspaceStore.snapshot();
          const limit=String(err?.message||'').match(/(?:PAYLOAD_LIMIT|MONTH_LIMIT|ENTRY_LIMIT|DELETION_MARKS)/);
          showToast(limit?'Limite de armazenamento V2 atingido. Exporte um backup; o banco anterior foi preservado.':'Alteração não salva no V2. O último banco válido foi preservado.', 'error');
          throw Error('CLEAN_SAVE_REJECTED');
        }
        return;
      }
      localStorage.setItem(STORAGE_DATABASE_KEY, JSON.stringify(appDb));
    }

    function changeMonth(delta) {
      const [year, month] = appDb.selectedMonth.split('-').map(Number);
      const d = new Date(year, month - 1 + delta, 1);
      const targetYM = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;

      const navigate = () => {
        appDb.selectedMonth = targetYM;
        ensureMonthExists(targetYM);
        saveDatabase();
        updateMonthHeader();
        renderAll();
      };

      if (appDb.months[targetYM]) {
        navigate();
        return;
      }

      showModal(
        `Criar ${formatMonthYear(targetYM)}?`,
        `Este mês ainda não foi cadastrado. Deseja criá-lo agora? As despesas fixas e parcelas pendentes poderão ser herdadas do mês anterior.`,
        navigate
      );
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

    // Cloud candidate bridge: only synchronous compare-and-replace; original local database remains authoritative offline.
    function productionV2ApplyLocal(expected, payload) {
      if (typeof document === 'undefined' || document.getElementById('pinLockOverlay') && !document.getElementById('pinLockOverlay').classList.contains('hidden')) return false;
      if (document.querySelector('[id$="Modal"]:not(.hidden)') || document.activeElement?.matches('input,textarea,select,[contenteditable="true"]')) return false;
      if (localStorage.getItem(STORAGE_DATABASE_KEY) !== expected || JSON.stringify(appDb) !== expected) return false;
      if (!MAIN_WORKSPACE || window.productionCleanWorkspaceReady !== true || !cleanWorkspaceStore) return false;
      const candidate = validateBackupDatabase(JSON.parse(payload));
      try { cleanWorkspaceStore.replace(expected, payload); } catch { return false; }
      appDb = candidate;
      updateMonthHeader();
      renderAll();
      return true;
    }
