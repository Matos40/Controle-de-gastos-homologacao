/* Cards de resumo, entradas extras e atualização geral da interface. */
    function renderIncomesList() {
      const currentData = getCurrentMonthData();
      const container = document.getElementById('incomesListContainer');
      const chipsEl = document.getElementById('incomesChips');
      const totalBadge = document.getElementById('incomesTotalBadge');
      const extrasSub = document.getElementById('cardIncomeExtrasSub');
      const extrasText = document.getElementById('cardIncomeExtrasText');
      const incomes = currentData.extraIncomes || [];

      const totalExtras = incomes.reduce((sum, item) => sum + (Number(item.amount) || 0), 0);

      if (extrasSub && extrasText) {
        if (totalExtras > 0) {
          extrasSub.classList.remove('hidden');
          extrasSub.classList.add('flex');
          extrasText.textContent = `+${formatBRL(totalExtras)} em extras`;
        } else {
          extrasSub.classList.add('hidden');
          extrasSub.classList.remove('flex');
        }
      }

      if (!container || !chipsEl || !totalBadge) return;
      const investmentsChips = document.getElementById('investmentsChips');
      const investmentsBadge = document.getElementById('investmentsTotalBadge');
      const incomeEmpty = document.getElementById('incomesEmptyState');
      const investmentsEmpty = document.getElementById('investmentsEmptyState');
      const investments = [
        ...(currentData.expenses || []).filter(item => item.category === 'investimentos')
          .map(item => ({ ...item, investedAmount: Number(item.amount) || 0, source: 'general' })),
        ...(currentData.cardExpenses || []).filter(item => item.category === 'investimentos')
          .map(item => ({ ...item, investedAmount: Number(item.installmentValue) || 0, source: 'card' }))
      ];
      const investedTotal = investments.reduce((sum, item) => sum + item.investedAmount, 0);
      // O painel só aparece quando há lançamentos de extras ou investimentos.
      const hasMovements = incomes.length > 0 || investments.length > 0;
      container.classList.toggle('hidden', !hasMovements);
      if (!hasMovements) return;
      const mobileExtra = document.getElementById('mobileExtraTotal');
      const mobileInvestment = document.getElementById('mobileInvestmentTotal');
      if (mobileExtra) {
        mobileExtra.textContent = 'Entradas: +' + formatBRL(totalExtras);
        mobileExtra.classList.toggle('hidden', incomes.length === 0);
      }
      if (mobileInvestment) {
        mobileInvestment.textContent = 'Investimentos: -' + formatBRL(investedTotal);
        mobileInvestment.classList.toggle('hidden', investments.length === 0);
      }
      const mobileToggle = document.getElementById('mobileMovementToggle');
      const mobileDetails = document.getElementById('mobileMovementDetails');
      if (mobileToggle && mobileDetails && !mobileToggle.dataset.initialized) {
        mobileToggle.dataset.initialized = 'true';
        mobileToggle.addEventListener('click', () => {
          const expanded = mobileToggle.getAttribute('aria-expanded') === 'true';
          mobileToggle.setAttribute('aria-expanded', String(!expanded));
          mobileDetails.classList.toggle('hidden', expanded);
          mobileDetails.classList.toggle('grid', !expanded);
          document.getElementById('mobileMovementToggleLabel').textContent = expanded ? 'Ver detalhes' : 'Ocultar';
          document.getElementById('mobileMovementToggleIcon').className = 'fa-solid ' + (expanded ? 'fa-chevron-down' : 'fa-chevron-up');
        });
      }
      totalBadge.textContent = 'Total Extra: ' + formatBRL(totalExtras);
      if (investmentsBadge) investmentsBadge.textContent = 'Total: ' + formatBRL(investedTotal);
      incomeEmpty?.classList.toggle('hidden', incomes.length > 0);
      investmentsEmpty?.classList.toggle('hidden', investments.length > 0);
      chipsEl.innerHTML = incomes.map(item => {
        const dateFormatted = item.date && /^\\d{4}-\\d{2}-\\d{2}$/.test(item.date)
          ? item.date.slice(8, 10) + '/' + item.date.slice(5, 7) : (item.date || '');
        return `
          <div class="flex flex-wrap items-center gap-2 bg-slate-950/80 border border-emerald-500/30 rounded-xl px-3 py-2 text-xs text-slate-200 min-w-0">
            <span class="w-2 h-2 rounded-full bg-emerald-400 shrink-0"></span>
            <span class="font-bold text-white break-words min-w-0">${escapeHtml(item.description)}</span>
            <span class="text-emerald-400 font-bold whitespace-nowrap">${formatBRL(item.amount)}</span>
            ${dateFormatted ? `<span class="text-[10px] text-slate-500">(${escapeHtml(dateFormatted)})</span>` : ''}
            <div class="flex items-center gap-1 ml-auto">
              <button onclick="openIncomeModal('${item.id}')" title="Editar entrada" aria-label="Editar entrada" class="text-slate-400 hover:text-emerald-300 p-1"><i class="fa-solid fa-pen text-[10px]"></i></button>
              <button onclick="promptDeleteIncome('${item.id}')" title="Excluir entrada" aria-label="Excluir entrada" class="text-slate-400 hover:text-rose-400 p-1"><i class="fa-regular fa-trash-can"></i></button>
            </div>
          </div>`;
      }).join('');
      if (investmentsChips) {
        investmentsChips.innerHTML = investments.map(item => {
          const dateFormatted = item.date && /^\\d{4}-\\d{2}-\\d{2}$/.test(item.date)
            ? item.date.slice(8, 10) + '/' + item.date.slice(5, 7) : (item.date || '');
          return `
            <div class="flex flex-wrap items-center gap-2 bg-slate-950/80 border border-teal-500/30 rounded-xl px-3 py-2 text-xs text-slate-200 min-w-0">
              <span class="w-2 h-2 rounded-full bg-teal-400 shrink-0"></span>
              <span class="font-bold text-white break-words min-w-0">${escapeHtml(item.title || 'Investimento')}</span>
              <span class="text-teal-300 font-bold whitespace-nowrap">-${formatBRL(item.investedAmount)}</span>
              ${dateFormatted ? `<span class="text-[10px] text-slate-500">(${escapeHtml(dateFormatted)})</span>` : ''}
              <span class="text-[10px] text-slate-400">${item.source === 'card' ? 'Cartão' : 'Mensal'}</span>
              <button type="button" data-investment-source="${item.source}" data-investment-id="${escapeHtml(String(item.id || ''))}" class="ml-auto text-teal-300 hover:text-teal-200 underline text-[11px]">Ver lançamento</button>
            </div>`;
        }).join('');
        investmentsChips.querySelectorAll('button[data-investment-source]').forEach(btn => {
          btn.addEventListener('click', () => {
            const tab = btn.dataset.investmentSource === 'card' ? 'card' : 'general';
            if (typeof switchTab === 'function') switchTab(tab);
            document.getElementById(tab === 'card' ? 'cardExpensesContainer' : 'expensesContainer')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
          });
        });
      }
    }
    function renderSummaryOnly() {
      const currentData = getCurrentMonthData();
      const currentYM = appDb.selectedMonth;
      const salary = Number(currentData.salary) || 0;
      const extraIncomesTotal = (currentData.extraIncomes || []).reduce((sum, item) => sum + (Number(item.amount) || 0), 0);

      const totalMonthIncome = salary + extraIncomesTotal;

      const prevYM = getPreviousMonthYM(currentYM);
      const hasPrevMonth = Boolean(appDb.months[prevYM]);
      const prevBalance = hasPrevMonth ? calculateMonthNetBalance(prevYM) : 0;

      const generalFixedItems = (currentData.expenses || []).filter(item => item.type === 'fixed');
      const generalOneTimeItems = (currentData.expenses || []).filter(item => item.type === 'one-time');

      const generalFixed = generalFixedItems.reduce((sum, item) => sum + (Number(item.amount) || 0), 0);
      const generalOneTime = generalOneTimeItems.reduce((sum, item) => sum + (Number(item.amount) || 0), 0);

      const cardFixedItems = (currentData.cardExpenses || []).filter(item => item.isInstallment);
      const cardOneTimeItems = (currentData.cardExpenses || []).filter(item => !item.isInstallment);

      const cardFixed = cardFixedItems.reduce((sum, item) => sum + (Number(item.installmentValue) || 0), 0);
      const cardOneTime = cardOneTimeItems.reduce((sum, item) => sum + (Number(item.installmentValue) || 0), 0);

      const totalFixed = generalFixed + cardFixed;
      const totalOneTime = generalOneTime + cardOneTime;
      const countFixed = generalFixedItems.length + cardFixedItems.length;
      const countOneTime = generalOneTimeItems.length + cardOneTimeItems.length;

      const totalCreditMonthly = (currentData.cardExpenses || []).reduce((sum, item) => sum + (Number(item.installmentValue) || 0), 0);
      const countCreditTotal = (currentData.cardExpenses || []).length;

      const totalSpent = totalFixed + totalOneTime;
      
      const totalAvailable = totalMonthIncome + prevBalance;
      const remainingBalance = totalAvailable - totalSpent;

      const prevHeaderBadge = document.getElementById('previousBalanceHeaderBadge');
      if (prevHeaderBadge) {
        if (hasPrevMonth && prevBalance !== 0) {
          prevHeaderBadge.classList.remove('hidden');
          prevHeaderBadge.classList.add('inline-flex');
          if (prevBalance > 0) {
            prevHeaderBadge.className = "inline-flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-emerald-300 bg-emerald-950/50 px-2.5 py-1 rounded-md border border-emerald-500/40";
            prevHeaderBadge.innerHTML = `<i class="fa-solid fa-arrow-turn-up text-emerald-400"></i> Mês anterior sobrou: +${formatBRL(prevBalance)}`;
          } else {
            prevHeaderBadge.className = "inline-flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-rose-300 bg-rose-950/50 px-2.5 py-1 rounded-md border border-rose-500/40";
            prevHeaderBadge.innerHTML = `<i class="fa-solid fa-arrow-turn-down text-rose-400"></i> Mês anterior faltou: -${formatBRL(Math.abs(prevBalance))}`;
          }
        } else {
          prevHeaderBadge.classList.add('hidden');
          prevHeaderBadge.classList.remove('inline-flex');
        }
      }

      cardSalaryValue.textContent = formatBRL(totalMonthIncome);
      
      const prevBalSubEl = document.getElementById('cardPrevBalValue');
      if (prevBalSubEl) {
        if (!hasPrevMonth) {
          prevBalSubEl.textContent = 'Sem histórico';
          prevBalSubEl.className = 'font-bold text-slate-500';
        } else if (prevBalance > 0) {
          prevBalSubEl.textContent = `+${formatBRL(prevBalance)}`;
          prevBalSubEl.className = 'font-bold text-emerald-400';
        } else if (prevBalance < 0) {
          prevBalSubEl.textContent = `-${formatBRL(Math.abs(prevBalance))}`;
          prevBalSubEl.className = 'font-bold text-rose-400';
        } else {
          prevBalSubEl.textContent = formatBRL(0);
          prevBalSubEl.className = 'font-bold text-slate-400';
        }
      }

      cardFixedValue.textContent = formatBRL(totalFixed);
      cardFixedSub.textContent = `${countFixed} ${countFixed === 1 ? 'item fixo' : 'itens fixos'}${cardFixedItems.length > 0 ? ` (${cardFixedItems.length} cartão)` : ''}`;

      cardOneTimeValue.textContent = formatBRL(totalOneTime);
      cardOneTimeSub.textContent = `${countOneTime} ${countOneTime === 1 ? 'item avulso' : 'itens avulsos'}${cardOneTimeItems.length > 0 ? ` (${cardOneTimeItems.length} cartão)` : ''}`;

      cardCreditValue.textContent = formatBRL(totalCreditMonthly);
      cardCreditSub.textContent = `${countCreditTotal} ${countCreditTotal === 1 ? 'compra ativa' : 'compras ativas'}`;
      cardMonthlyTotalHeader.textContent = formatBRL(totalCreditMonthly);

      cardBalanceValue.textContent = formatBRL(remainingBalance);

      let effectiveBase = totalMonthIncome + (prevBalance > 0 ? prevBalance : 0);
      let percentUsed = 0;
      if (effectiveBase > 0) {
        percentUsed = Math.round((totalSpent / effectiveBase) * 100);
      } else if (totalSpent > 0 || remainingBalance < 0) {
        percentUsed = 100;
      }
      spentPercent.textContent = `${percentUsed}%`;
      spentProgressBar.style.width = `${Math.min(100, Math.max(0, percentUsed))}%`;

      balanceCard.className = "rounded-2xl p-4 flex flex-col justify-between shadow-xl relative overflow-hidden transition-all duration-300 col-span-2 lg:col-span-1 border-2";

      if (remainingBalance >= 0) {
        balanceCard.classList.add('bg-emerald-950/20', 'border-emerald-500/50');
        cardBalanceValue.className = "text-2xl font-black tracking-tight text-emerald-400";
        balanceBadge.className = "text-[10px] font-bold px-2 py-0.5 rounded-full uppercase bg-emerald-500/20 text-emerald-300 border border-emerald-500/30";
        balanceBadge.innerHTML = `<i class="fa-solid fa-arrow-trend-up"></i> Positivo (No Azul)`;
        
        if (totalMonthIncome <= 0 && prevBalance > 0) {
          balanceTip.textContent = `Saldo vindo do mês anterior`;
        } else {
          balanceTip.textContent = `Sobrando ${formatBRL(remainingBalance)}`;
        }
        balanceTip.className = "text-[10px] mt-0.5 font-medium text-emerald-300/80";
        spentProgressBar.className = "h-full bg-emerald-500 transition-all duration-500 rounded-full";
      } else {
        const negativeAmount = Math.abs(remainingBalance);
        balanceCard.classList.add('bg-rose-950/20', 'border-rose-500/50');
        cardBalanceValue.className = "text-2xl font-black tracking-tight text-rose-400";
        balanceBadge.className = "text-[10px] font-bold px-2 py-0.5 rounded-full uppercase bg-rose-500/20 text-rose-300 border border-rose-500/30";
        balanceBadge.innerHTML = `<i class="fa-solid fa-triangle-exclamation"></i> Negativo (No Vermelho)`;
        
        if (totalMonthIncome <= 0 && prevBalance < 0) {
          balanceTip.textContent = `Dívida herdada do mês anterior`;
        } else {
          balanceTip.textContent = `Faltando ${formatBRL(negativeAmount)}!`;
        }
        balanceTip.className = "text-[10px] mt-0.5 font-medium text-rose-300/80";
        spentProgressBar.className = "h-full bg-rose-500 transition-all duration-500 rounded-full";
      }

      renderIncomesList();
      if (currentTab === 'analytics') {
        renderAnalyticsTab();
      }
    }

    function renderAll() {
      const currentData = getCurrentMonthData();
      if (document.activeElement !== salaryInput) {
        salaryInput.value = currentData.salary ? formatForInput(currentData.salary) : '';
      }
      renderSummaryOnly();
      renderExpensesList();
      renderCardExpensesList();
      if (currentTab === 'analytics') {
        renderAnalyticsTab();
      } else if (currentTab === 'history') {
        renderHistoryList();
      }
    }

    // =========================================================================
    // RENDERIZAÇÃO RESPONSIVA (MOBILE 2 ANDARES SEM CORTES / PC HORIZONTAL)
    // =========================================================================
