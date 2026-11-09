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

      if (incomes.length === 0) {
        container.classList.add('hidden');
        chipsEl.innerHTML = '';
        return;
      }

      container.classList.remove('hidden');
      totalBadge.textContent = `Total Extra: ${formatBRL(totalExtras)}`;

      chipsEl.innerHTML = incomes.map(item => {
        let dateFormatted = '';
        if (item.date) {
          const parts = item.date.split('-');
          dateFormatted = parts.length === 3 ? `${parts[2]}/${parts[1]}` : item.date;
        }

        return `
          <div class="inline-flex items-center gap-2 bg-slate-950/80 border border-emerald-500/30 rounded-xl px-3 py-1.5 text-xs text-slate-200 shadow-sm">
            <span class="w-2 h-2 rounded-full bg-emerald-400"></span>
            <span class="font-bold text-white">${escapeHtml(item.description)}</span>
            <span class="text-emerald-400 font-bold">${formatBRL(item.amount)}</span>
            ${dateFormatted ? `<span class="text-[10px] text-slate-500">(${dateFormatted})</span>` : ''}
            <div class="flex items-center gap-1 ml-1 pl-1 border-l border-slate-800">
              <button onclick="openIncomeModal('${item.id}')" title="Editar entrada" class="text-slate-400 hover:text-emerald-300 p-0.5 transition">
                <i class="fa-solid fa-pen text-[10px]"></i>
              </button>
              <button onclick="promptDeleteIncome('${item.id}')" title="Excluir entrada" class="text-slate-400 hover:text-rose-400 p-0.5 transition">
                <i class="fa-regular fa-trash-can text-[10px]"></i>
              </button>
            </div>
          </div>
        `;
      }).join('');
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

      // Investimentos já fazem parte das despesas existentes: exibir o subtotal
      // informativo sem subtraí-lo novamente do saldo.
      const investedInExpenses = (currentData.expenses || [])
        .filter(item => item.category === 'investimentos')
        .reduce((sum, item) => sum + (Number(item.amount) || 0), 0);
      const investedOnCard = (currentData.cardExpenses || [])
        .filter(item => item.category === 'investimentos')
        .reduce((sum, item) => sum + (Number(item.installmentValue) || 0), 0);
      const investedTotal = investedInExpenses + investedOnCard;
      const investmentsSub = document.getElementById('cardInvestmentsSub');
      const investmentsText = document.getElementById('cardInvestmentsText');
      if (investmentsSub && investmentsText) {
        investmentsSub.classList.toggle('hidden', investedTotal <= 0);
        investmentsSub.classList.toggle('flex', investedTotal > 0);
        investmentsText.textContent = formatBRL(investedTotal) + ' destinados a investimentos';
      }

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
