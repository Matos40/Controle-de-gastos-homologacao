/* Histórico mensal e operações relacionadas aos meses anteriores. */
    function renderHistoryList() {
      const historyGrid = document.getElementById('historyGrid');
      const historyEmptyState = document.getElementById('historyEmptyState');
      const historyCountBadge = document.getElementById('historyCountBadge');

      const monthsKeys = Object.keys(appDb.months).sort().reverse();
      historyCountBadge.textContent = monthsKeys.length;

      if (monthsKeys.length === 0) {
        historyGrid.innerHTML = '';
        historyEmptyState.classList.remove('hidden');
        historyEmptyState.classList.add('flex');
        return;
      }

      historyEmptyState.classList.add('hidden');
      historyEmptyState.classList.remove('flex');

      historyGrid.innerHTML = monthsKeys.map(ym => {
        const mData = appDb.months[ym];
        const sal = Number(mData.salary) || 0;
        const extraTotal = (mData.extraIncomes || []).reduce((acc, curr) => acc + (Number(curr.amount) || 0), 0);
        const totalExp = (mData.expenses || []).reduce((acc, curr) => acc + (Number(curr.amount) || 0), 0);
        const totalCard = (mData.cardExpenses || []).reduce((acc, curr) => acc + (Number(curr.installmentValue) || 0), 0);
        const totalSpent = totalExp + totalCard;
        const bal = calculateMonthNetBalance(ym);
        const isCurrent = (ym === appDb.selectedMonth);

        return `
          <div class="p-5 rounded-2xl border ${isCurrent ? 'border-emerald-500/50 bg-emerald-950/10' : 'border-slate-800 bg-slate-900/60'} shadow-lg flex flex-col justify-between gap-4">
            <div>
              <div class="flex items-center justify-between mb-3">
                <span class="text-sm font-bold capitalize text-white flex items-center gap-2">
                  <i class="fa-regular fa-calendar-days text-slate-400"></i> ${formatMonthYear(ym)}
                </span>
                ${isCurrent ? '<span class="text-[10px] uppercase font-extrabold px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">Mês Atual</span>' : ''}
              </div>

              <div class="space-y-2 text-xs">
                <div class="flex justify-between text-slate-400">
                  <span>Salário base:</span>
                  <strong class="text-white">${formatBRL(sal)}</strong>
                </div>
                ${extraTotal > 0 ? `
                <div class="flex justify-between text-emerald-400">
                  <span>Entradas Extras:</span>
                  <strong>+${formatBRL(extraTotal)}</strong>
                </div>` : ''}
                <div class="flex justify-between text-slate-400">
                  <span>Gastos gerais:</span>
                  <span class="text-slate-200">${formatBRL(totalExp)}</span>
                </div>
                <div class="flex justify-between text-slate-400">
                  <span>Cartão de crédito:</span>
                  <span class="text-purple-300 font-semibold">${formatBRL(totalCard)}</span>
                </div>
                <div class="flex justify-between text-slate-400 pt-2 border-t border-slate-800/80">
                  <span>Total gasto:</span>
                  <strong class="text-slate-100">${formatBRL(totalSpent)}</strong>
                </div>
              </div>
            </div>

            <div class="pt-3 border-t border-slate-800 flex items-center justify-between">
              <div>
                <span class="text-[10px] uppercase text-slate-500 font-bold block">Saldo Final Acumulado</span>
                <span class="text-base font-extrabold ${bal >= 0 ? 'text-emerald-400' : 'text-rose-400'}">
                  ${formatBRL(bal)}
                </span>
              </div>
              <div class="flex items-center gap-2">
                <button 
                  onclick="promptDeleteMonth('${ym}')" 
                  title="Excluir este mês do histórico"
                  class="w-8 h-8 rounded-xl border border-slate-800 hover:border-rose-500/50 bg-slate-950/60 hover:bg-rose-950/30 text-slate-400 hover:text-rose-400 transition flex items-center justify-center text-xs"
                >
                  <i class="fa-regular fa-trash-can"></i>
                </button>
                <button 
                  onclick="selectHistoricalMonth('${ym}')" 
                  class="px-3 py-1.5 rounded-xl border border-slate-700 hover:border-emerald-500 text-xs font-semibold text-slate-300 hover:text-white transition flex items-center gap-1.5"
                >
                  Abrir <i class="fa-solid fa-arrow-right text-[10px]"></i>
                </button>
              </div>
            </div>
          </div>
        `;
      }).join('');
    }

    function promptDeleteMonth(ym) {
      if (!appDb.months[ym]) return;
      const monthLabel = formatMonthYear(ym);

      showModal(
        `Excluir ${monthLabel}?`,
        `Tem certeza que deseja apagar permanentemente todos os dados e lançamentos do mês de ${monthLabel}? Esta ação recalculará os saldos acumulados e não pode ser desfeita.`,
        () => deleteHistoricalMonth(ym)
      );
    }

    function deleteHistoricalMonth(ym) {
      if (!appDb.months[ym]) return;
      const monthLabel = formatMonthYear(ym);
      delete appDb.months[ym];

      const remainingKeys = Object.keys(appDb.months).sort();

      if (remainingKeys.length === 0) {
        const currentYM = getTodayYM();
        appDb.selectedMonth = currentYM;
        appDb.months[currentYM] = {
          salary: 0,
          budgetLimit: 0,
          extraIncomes: [],
          expenses: [],
          cardExpenses: [],
          closed: false,
          closedAt: null
        };
      } else if (appDb.selectedMonth === ym) {
        appDb.selectedMonth = remainingKeys[remainingKeys.length - 1];
      }

      saveDatabase();
      updateMonthHeader();
      renderAll();
      showToast(`Mês de ${monthLabel} excluído com sucesso!`, 'info');
    }

    function selectHistoricalMonth(ym) {
      appDb.selectedMonth = ym;
      saveDatabase();
      updateMonthHeader();
      switchTab('general');
      renderAll();
      showToast(`Mês alterado para ${formatMonthYear(ym)}`, 'info');
    }
