/* Lista, filtros e edição de despesas gerais. */
    function renderExpensesList() {
      const currentData = getCurrentMonthData();
      const expenses = currentData.expenses || [];
      const searchQuery = (document.getElementById('generalSearchInput')?.value || '').trim().toLowerCase();
      const sortMode = document.getElementById('generalSortSelect')?.value || 'recent';

      let filtered = [...expenses];
      if (activeFilter !== 'all') {
        filtered = filtered.filter(e => e.type === activeFilter);
      }
      if (searchQuery) {
        filtered = filtered.filter(e => (e.title || '').toLowerCase().includes(searchQuery));
      }

      if (sortMode === 'amount_desc') {
        filtered.sort((a, b) => (Number(b.amount) || 0) - (Number(a.amount) || 0));
      } else if (sortMode === 'amount_asc') {
        filtered.sort((a, b) => (Number(a.amount) || 0) - (Number(b.amount) || 0));
      } else if (sortMode === 'pending') {
        filtered.sort((a, b) => Number(Boolean(a.paid)) - Number(Boolean(b.paid)));
      }

      countSummary.textContent = `${expenses.length} ${expenses.length === 1 ? 'conta registrada' : 'contas registradas'}`;

      const totalFiltered = filtered.reduce((acc, curr) => acc + (Number(curr.amount) || 0), 0);
      totalFilteredText.textContent = formatBRL(totalFiltered);

      const paidCount = expenses.filter(e => e.paid).length;
      const paidSummaryEl = document.getElementById('paidSummaryGeneral');
      if (paidSummaryEl) {
        paidSummaryEl.textContent = `${paidCount} de ${expenses.length} pagas`;
      }

      if (filtered.length === 0) {
        expensesContainer.innerHTML = '';
        emptyState.classList.remove('hidden');
        emptyState.classList.add('flex');
        return;
      }

      emptyState.classList.add('hidden');
      emptyState.classList.remove('flex');

      expensesContainer.innerHTML = filtered.map(item => {
        const isFixed = item.type === 'fixed';
        const isPaid = Boolean(item.paid);
        const catKey = item.category && CATEGORIES[item.category] ? item.category : inferCategoryFromTitle(item.title);
        const catInfo = CATEGORIES[catKey];

        const typeBadge = isFixed 
          ? `<span class="inline-flex items-center gap-1 text-[10px] sm:text-[11px] font-semibold text-indigo-300 bg-indigo-950/60 px-2 py-0.5 rounded-md border border-indigo-500/30 whitespace-nowrap"><i class="fa-solid fa-repeat text-[9px]"></i> Fixo</span>`
          : `<span class="inline-flex items-center gap-1 text-[10px] sm:text-[11px] font-semibold text-amber-300 bg-amber-950/60 px-2 py-0.5 rounded-md border border-amber-500/30 whitespace-nowrap"><i class="fa-solid fa-bolt text-[9px]"></i> Único</span>`;

        const catBadge = `<span class="inline-flex items-center gap-1 text-[10px] sm:text-[11px] font-medium px-2 py-0.5 rounded-md border ${catInfo.badgeClass} whitespace-nowrap">${catInfo.icon} ${catInfo.label}</span>`;

        const paidBadge = isPaid
          ? `<button onclick="toggleExpensePaid('${item.id}')" title="Clique para marcar como pendente" class="inline-flex items-center gap-1 text-[10px] sm:text-[11px] font-bold text-emerald-300 bg-emerald-950/70 px-2 py-0.5 rounded-md border border-emerald-500/40 hover:bg-emerald-900 transition whitespace-nowrap"><i class="fa-solid fa-circle-check text-emerald-400 text-[9px]"></i> Pago</button>`
          : `<button onclick="toggleExpensePaid('${item.id}')" title="Clique para marcar como pago" class="inline-flex items-center gap-1 text-[10px] sm:text-[11px] font-semibold text-slate-400 bg-slate-900 hover:text-slate-200 px-2 py-0.5 rounded-md border border-slate-700 transition whitespace-nowrap"><i class="fa-regular fa-clock text-[9px]"></i> A vencer</button>`;

        let formattedDate = 'Sem data';
        if (item.date) {
          const parts = item.date.split('-');
          if (parts.length === 3) {
            formattedDate = `${parts[2]}/${parts[1]}/${parts[0]}`;
          } else {
            formattedDate = item.date;
          }
        }

        const valueColor = isPaid ? 'text-emerald-400 line-through opacity-75' : (isFixed ? 'text-indigo-300' : 'text-amber-300');

        return `
          <div class="p-3 sm:p-3.5 ${isPaid ? 'bg-emerald-950/10 border-emerald-900/40' : 'bg-slate-950/60 border-slate-800/80'} hover:bg-slate-950 border hover:border-slate-700 rounded-xl transition group">
            
            <!-- Layout Mobile Exclusivo (2 andares organizados sem cortar texto) -->
            <div class="flex flex-col gap-2.5 sm:hidden">
              <div class="flex items-start justify-between gap-2.5">
                <div class="flex items-center gap-2.5 min-w-0 flex-1">
                  <button 
                    onclick="toggleExpensePaid('${item.id}')"
                    class="w-9 h-9 rounded-xl ${isPaid ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30' : (isFixed ? 'bg-indigo-500/10 text-indigo-400 border border-indigo-500/20' : 'bg-amber-500/10 text-amber-400 border border-amber-500/20')} flex items-center justify-center shrink-0"
                  >
                    <i class="fa-solid ${isPaid ? 'fa-check' : (isFixed ? 'fa-repeat' : 'fa-bolt')} text-xs"></i>
                  </button>
                  <div class="min-w-0 flex-1">
                    <h4 class="text-sm font-bold ${isPaid ? 'text-slate-400 line-through' : 'text-white'} leading-snug break-words">${escapeHtml(item.title)}</h4>
                    <span class="text-[11px] text-slate-400 flex items-center gap-1 mt-0.5">
                      <i class="fa-regular fa-calendar text-[10px]"></i> ${formattedDate}
                    </span>
                  </div>
                </div>
                <div class="text-right shrink-0">
                  <span class="text-sm font-extrabold ${valueColor} block">${formatBRL(item.amount)}</span>
                </div>
              </div>

              <div class="flex items-center justify-between gap-2 pt-2 border-t border-slate-800/60">
                <div class="flex items-center flex-wrap gap-1.5">
                  ${typeBadge}
                  ${catBadge}
                  ${paidBadge}
                </div>
                <div class="flex items-center gap-1 shrink-0">
                  <button 
                    onclick="openEditExpenseModal('${item.id}')" 
                    class="w-7 h-7 rounded-lg bg-slate-900 border border-slate-800 text-slate-300 hover:text-emerald-400 flex items-center justify-center text-xs"
                  >
                    <i class="fa-solid fa-pen text-[10px]"></i>
                  </button>
                  <button 
                    onclick="promptDeleteExpense('${item.id}')" 
                    class="w-7 h-7 rounded-lg bg-slate-900 border border-slate-800 text-slate-300 hover:text-rose-400 flex items-center justify-center text-xs"
                  >
                    <i class="fa-regular fa-trash-can text-[10px]"></i>
                  </button>
                </div>
              </div>
            </div>

            <!-- Layout Desktop Original (Mantido exatamente como no PC) -->
            <div class="hidden sm:flex items-center justify-between">
              <div class="flex items-center gap-3 min-w-0">
                <button 
                  onclick="toggleExpensePaid('${item.id}')"
                  title="${isPaid ? 'Desmarcar pagamento' : 'Marcar como pago'}"
                  class="w-9 h-9 rounded-xl ${isPaid ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30' : (isFixed ? 'bg-indigo-500/10 text-indigo-400 border border-indigo-500/20' : 'bg-amber-500/10 text-amber-400 border border-amber-500/20')} flex items-center justify-center shrink-0 transition hover:scale-105"
                >
                  <i class="fa-solid ${isPaid ? 'fa-check' : (isFixed ? 'fa-repeat' : 'fa-bolt')} text-sm"></i>
                </button>
                <div class="truncate">
                  <h4 class="text-sm font-bold ${isPaid ? 'text-slate-400 line-through' : 'text-white'} truncate">${escapeHtml(item.title)}</h4>
                  <div class="flex items-center flex-wrap gap-1.5 mt-1">
                    ${typeBadge}
                    ${catBadge}
                    ${paidBadge}
                    <span class="text-[11px] text-slate-500 flex items-center gap-1">
                      <i class="fa-regular fa-calendar text-[10px]"></i> ${formattedDate}
                    </span>
                  </div>
                </div>
              </div>

              <div class="flex items-center gap-3 shrink-0 ml-2">
                <span class="text-sm sm:text-base font-extrabold ${valueColor}">${formatBRL(item.amount)}</span>
                
                <div class="flex items-center gap-1">
                  <button 
                    onclick="openEditExpenseModal('${item.id}')" 
                    title="Editar despesa"
                    class="w-7 h-7 rounded-lg text-slate-400 hover:text-emerald-400 hover:bg-slate-800 transition flex items-center justify-center text-xs"
                  >
                    <i class="fa-solid fa-pen"></i>
                  </button>
                  <button 
                    onclick="promptDeleteExpense('${item.id}')" 
                    title="Excluir despesa"
                    class="w-7 h-7 rounded-lg text-slate-400 hover:text-rose-400 hover:bg-slate-800 transition flex items-center justify-center text-xs"
                  >
                    <i class="fa-regular fa-trash-can"></i>
                  </button>
                </div>
              </div>
            </div>

          </div>
        `;
      }).join('');
    }
    function openEditExpenseModal(id) {
      const currentData = getCurrentMonthData();
      const item = (currentData.expenses || []).find(e => e.id === id);
      if (!item) return;

      document.getElementById('editExpenseId').value = item.id;
      document.getElementById('editExpenseTitle').value = item.title;
      document.getElementById('editExpenseAmount').value = formatForInput(item.amount);
      document.getElementById('editExpenseDate').value = item.date || `${appDb.selectedMonth}-10`;
      document.getElementById('editExpenseCategory').value = item.category || inferCategoryFromTitle(item.title);

      const typeRadios = document.querySelectorAll('input[name="editExpenseType"]');
      typeRadios.forEach(radio => {
        radio.checked = (radio.value === item.type);
      });

      document.getElementById('editExpenseModal').classList.remove('hidden');
    }

    function closeEditExpenseModal() {
      document.getElementById('editExpenseModal').classList.add('hidden');
    }

    function handleEditExpenseSubmit(e) {
      e.preventDefault();
      const currentData = getCurrentMonthData();
      const id = document.getElementById('editExpenseId').value;
      const title = document.getElementById('editExpenseTitle').value.trim();
      const amount = parseCurrencyInput(document.getElementById('editExpenseAmount').value);
      const dateVal = document.getElementById('editExpenseDate').value || `${appDb.selectedMonth}-10`;
      const category = document.getElementById('editExpenseCategory').value || 'outros';
      const typeInput = document.querySelector('input[name="editExpenseType"]:checked');
      const type = typeInput ? typeInput.value : 'fixed';

      if (!title || amount <= 0) {
        showToast('Informe um nome e valor válido!', 'error');
        return;
      }

      const item = currentData.expenses.find(e => e.id === id);
      if (item) {
        item.title = title;
        item.amount = amount;
        item.date = dateVal;
        item.category = category;
        item.type = type;
        saveDatabase();
        renderAll();
        closeEditExpenseModal();
        showToast(`Despesa "${title}" atualizada!`, 'success');
      }
    }
