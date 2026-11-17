/* Gráficos, metas e indicadores analíticos. */
    function handleBudgetLimitInput(e) {
      if (isPrivacyMode) return;
      const val = parseCurrencyInput(e.target.value);
      const currentData = getCurrentMonthData();
      currentData.budgetLimit = Math.max(0, val);
      saveDatabase();
      updateBudgetProgressBar();
    }

    function updateBudgetProgressBar() {
      const currentData = getCurrentMonthData();
      const budgetInput = document.getElementById('budgetLimitInput');
      if (budgetInput && document.activeElement !== budgetInput) {
        budgetInput.value = currentData.budgetLimit ? formatForInput(currentData.budgetLimit) : '';
      }

      const totalExp = (currentData.expenses || []).reduce((s, i) => s + (Number(i.amount) || 0), 0);
      const totalCard = (currentData.cardExpenses || []).reduce((s, i) => s + (Number(i.installmentValue) || 0), 0);
      const totalSpent = totalExp + totalCard;
      const limit = Number(currentData.budgetLimit) || 0;

      document.getElementById('budgetCurrentSpent').textContent = formatBRL(totalSpent);
      document.getElementById('budgetTargetDisplay').textContent = formatBRL(limit);

      const badge = document.getElementById('budgetStatusBadge');
      const statusText = document.getElementById('budgetStatusText');
      const bar = document.getElementById('budgetProgressBar');

      if (limit <= 0) {
        badge.className = 'text-xs font-bold px-2.5 py-0.5 rounded-full bg-slate-800 text-slate-400';
        badge.textContent = 'Sem meta definida';
        statusText.textContent = 'Defina um teto acima para receber alertas de limite.';
        bar.style.width = '0%';
        bar.className = 'h-full bg-slate-600 transition-all duration-500 rounded-full';
        return;
      }

      const pct = Math.round((totalSpent / limit) * 100);
      bar.style.width = `${Math.min(100, Math.max(0, pct))}%`;

      if (pct < 70) {
        badge.className = 'text-xs font-bold px-2.5 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/30';
        badge.textContent = `${pct}% do limite (Controlado)`;
        statusText.textContent = `Ainda restam ${formatBRL(limit - totalSpent)} dentro da sua meta planejada.`;
        bar.className = 'h-full bg-emerald-500 transition-all duration-500 rounded-full';
      } else if (pct <= 95) {
        badge.className = 'text-xs font-bold px-2.5 py-0.5 rounded-full bg-amber-500/20 text-amber-300 border border-amber-500/30';
        badge.textContent = `${pct}% do limite (Atenção)`;
        statusText.textContent = `Cuidado! Você está próximo do teto. Restam ${formatBRL(Math.max(0, limit - totalSpent))}.`;
        bar.className = 'h-full bg-amber-500 transition-all duration-500 rounded-full';
      } else {
        badge.className = 'text-xs font-bold px-2.5 py-0.5 rounded-full bg-rose-500/20 text-rose-300 border border-rose-500/30';
        badge.textContent = `${pct}% (Limite Ultrapassado!)`;
        const diff = totalSpent - limit;
        statusText.textContent = diff > 0 ? `Você excedeu o teto planejado em ${formatBRL(diff)}!` : `Você atingiu 100% do limite planejado.`;
        bar.className = 'h-full bg-rose-500 transition-all duration-500 rounded-full';
      }
    }

    function renderAnalyticsTab() {
      updateBudgetProgressBar();
      const currentData = getCurrentMonthData();

      const catTotals = {};
      Object.keys(CATEGORIES).forEach(k => catTotals[k] = 0);

      (currentData.expenses || []).forEach(e => {
        const c = e.category && CATEGORIES[e.category] ? e.category : inferCategoryFromTitle(e.title);
        catTotals[c] += Number(e.amount) || 0;
      });
      (currentData.cardExpenses || []).forEach(cItem => {
        const c = cItem.category && CATEGORIES[cItem.category] ? cItem.category : inferCategoryFromTitle(cItem.title);
        catTotals[c] += Number(cItem.installmentValue) || 0;
      });

      const activeCats = Object.keys(CATEGORIES).filter(k => catTotals[k] > 0);
      const totalSpentAll = activeCats.reduce((acc, k) => acc + catTotals[k], 0);

      const breakdownEl = document.getElementById('categoryBreakdownList');
      if (activeCats.length === 0) {
        breakdownEl.innerHTML = `<p class="text-slate-500 text-center py-2">Nenhum gasto registrado neste mês.</p>`;
      } else {
        breakdownEl.innerHTML = activeCats
          .sort((a, b) => catTotals[b] - catTotals[a])
          .map(k => {
            const info = CATEGORIES[k];
            const val = catTotals[k];
            const pct = totalSpentAll > 0 ? Math.round((val / totalSpentAll) * 100) : 0;
            return `
              <div class="flex items-center justify-between py-1">
                <div class="flex items-center gap-2">
                  <span class="w-2.5 h-2.5 rounded-full" style="background-color: ${info.color}"></span>
                  <span class="text-slate-200 font-medium">${info.icon} ${info.label}</span>
                </div>
                <div class="flex items-center gap-2">
                  <span class="text-slate-400">${pct}%</span>
                  <strong class="text-white">${formatBRL(val)}</strong>
                </div>
              </div>
            `;
          }).join('');
      }

      if (typeof Chart !== 'undefined') {
        const ctxDonut = document.getElementById('categoryDonutChart')?.getContext('2d');
        if (ctxDonut) {
          if (categoryChartInstance) categoryChartInstance.destroy();
          categoryChartInstance = new Chart(ctxDonut, {
            type: 'doughnut',
            data: {
              labels: activeCats.length ? activeCats.map(k => `${CATEGORIES[k].icon} ${CATEGORIES[k].label}`) : ['Sem gastos'],
              datasets: [{
                data: activeCats.length ? activeCats.map(k => catTotals[k]) : [1],
                backgroundColor: activeCats.length ? activeCats.map(k => CATEGORIES[k].color) : ['#1e293b'],
                borderColor: '#0f172a',
                borderWidth: 3
              }]
            },
            options: {
              responsive: true,
              maintainAspectRatio: false,
              cutout: '68%',
              plugins: {
                legend: { display: false }
              }
            }
          });
        }

        const ctxBar = document.getElementById('monthlyEvolutionChart')?.getContext('2d');
        if (ctxBar) {
          if (evolutionChartInstance) evolutionChartInstance.destroy();
          const sortedMonths = Object.keys(appDb.months).sort().slice(-6);
          const labels = sortedMonths.map(ym => formatMonthYear(ym));
          const incomesData = sortedMonths.map(ym => {
            const m = appDb.months[ym];
            const extra = (m.extraIncomes || []).reduce((a, b) => a + (Number(b.amount) || 0), 0);
            return (Number(m.salary) || 0) + extra;
          });
          const expensesData = sortedMonths.map(ym => {
            const m = appDb.months[ym];
            const exp = (m.expenses || []).reduce((a, b) => a + (Number(b.amount) || 0), 0);
            const card = (m.cardExpenses || []).reduce((a, b) => a + (Number(b.installmentValue) || 0), 0);
            return exp + card;
          });

          evolutionChartInstance = new Chart(ctxBar, {
            type: 'bar',
            data: {
              labels,
              datasets: [
                {
                  label: 'Renda do Mês (R$)',
                  data: incomesData,
                  backgroundColor: '#10b981',
                  borderRadius: 6
                },
                {
                  label: 'Total Gasto (R$)',
                  data: expensesData,
                  backgroundColor: '#f43f5e',
                  borderRadius: 6
                }
              ]
            },
            options: {
              responsive: true,
              maintainAspectRatio: false,
              scales: {
                x: { ticks: { color: '#94a3b8' }, grid: { display: false } },
                y: { ticks: { color: '#94a3b8' }, grid: { color: '#1e293b' } }
              },
              plugins: {
                legend: { labels: { color: '#e2e8f0' } }
              }
            }
          });
        }
      }
    }
