/* Lista e edição das compras do cartão de crédito. */
    function renderCardExpensesList() {
      const currentData = getCurrentMonthData();
      const cardExpenses = currentData.cardExpenses || [];
      const searchQuery = (document.getElementById('cardSearchInput')?.value || '').trim().toLowerCase();
      const sortMode = document.getElementById('cardSortSelect')?.value || 'recent';

      let filtered = [...cardExpenses];
      if (activeCardFilter === 'fixed') {
        filtered = filtered.filter(item => Boolean(item.isInstallment));
      } else if (activeCardFilter === 'one-time') {
        filtered = filtered.filter(item => !item.isInstallment);
      }
      if (searchQuery) {
        filtered = filtered.filter(item => (item.title || '').toLowerCase().includes(searchQuery));
      }

      if (sortMode === 'amount_desc') {
        filtered.sort((a, b) => (Number(b.installmentValue) || 0) - (Number(a.installmentValue) || 0));
      } else if (sortMode === 'amount_asc') {
        filtered.sort((a, b) => (Number(a.installmentValue) || 0) - (Number(b.installmentValue) || 0));
      } else if (sortMode === 'pending') {
        filtered.sort((a, b) => Number(Boolean(a.paid)) - Number(Boolean(b.paid)));
      }

      cardCountSummary.textContent = `${cardExpenses.length} ${cardExpenses.length === 1 ? 'compra registrada' : 'compras registradas'}${activeCardFilter !== 'all' || searchQuery ? ` (${filtered.length} exibidas)` : ''}`;

      const totalFiltered = filtered.reduce((acc, curr) => acc + (Number(curr.installmentValue) || 0), 0);
      const headerLabel = document.getElementById('cardMonthlyHeaderLabel');
      if (headerLabel) {
        headerLabel.textContent = activeCardFilter === 'all' 
          ? 'Fatura Total deste Mês' 
          : activeCardFilter === 'fixed' 
            ? 'Total Fixos (Parcelados)' 
            : 'Total Únicos (À Vista)';
      }
      cardMonthlyTotalHeader.textContent = formatBRL(totalFiltered);

      if (filtered.length === 0) {
        cardExpensesContainer.innerHTML = '';
        cardEmptyState.classList.remove('hidden');
        cardEmptyState.classList.add('flex');
        return;
      }

      cardEmptyState.classList.add('hidden');
      cardEmptyState.classList.remove('flex');

      cardExpensesContainer.innerHTML = filtered.map(item => {
        let formattedDate = 'Sem data';
        if (item.date) {
          const parts = item.date.split('-');
          if (parts.length === 3) {
            formattedDate = `${parts[2]}/${parts[1]}/${parts[0]}`;
          } else {
            formattedDate = item.date;
          }
        }

        const isParcelado = Boolean(item.isInstallment);
        const currentInst = item.currentInstallment || 1;
        const totalInst = item.installments || 1;
        const isPaid = Boolean(item.paid);
        const catKey = item.category && CATEGORIES[item.category] ? item.category : inferCategoryFromTitle(item.title);
        const catInfo = CATEGORIES[catKey];

        const badgeHtml = isParcelado
          ? `<span class="inline-flex items-center gap-1 text-[10px] sm:text-[11px] font-semibold text-indigo-300 bg-indigo-950/60 px-2 py-0.5 rounded-md border border-indigo-500/30 whitespace-nowrap">
               <i class="fa-solid fa-repeat text-[9px]"></i> Parcela ${currentInst}/${totalInst}
             </span>`
          : `<span class="inline-flex items-center gap-1 text-[10px] sm:text-[11px] font-semibold text-amber-300 bg-amber-950/60 px-2 py-0.5 rounded-md border border-amber-500/30 whitespace-nowrap">
               <i class="fa-solid fa-bolt text-[9px]"></i> À vista
             </span>`;

        const badgeDesktopHtml = isParcelado
          ? `<span class="inline-flex items-center gap-1 text-[11px] font-semibold text-indigo-300 bg-indigo-950/60 px-2 py-0.5 rounded-md border border-indigo-500/30">
               <i class="fa-solid fa-repeat text-[10px]"></i> Parcela ${currentInst} de ${totalInst} (Fixo)
             </span>`
          : `<span class="inline-flex items-center gap-1 text-[11px] font-semibold text-amber-300 bg-amber-950/60 px-2 py-0.5 rounded-md border border-amber-500/30">
               <i class="fa-solid fa-bolt text-[10px]"></i> À vista (Único)
             </span>`;

        const catBadge = `<span class="inline-flex items-center gap-1 text-[10px] sm:text-[11px] font-medium px-2 py-0.5 rounded-md border ${catInfo.badgeClass} whitespace-nowrap">${catInfo.icon} ${catInfo.label}</span>`;

        const paidBadge = isPaid
          ? `<button onclick="toggleCardPaid('${item.id}')" class="inline-flex items-center gap-1 text-[10px] sm:text-[11px] font-bold text-emerald-300 bg-emerald-950/70 px-2 py-0.5 rounded-md border border-emerald-500/40 whitespace-nowrap"><i class="fa-solid fa-circle-check text-emerald-400 text-[9px]"></i> Verificado</button>`
          : `<button onclick="toggleCardPaid('${item.id}')" class="inline-flex items-center gap-1 text-[10px] sm:text-[11px] font-semibold text-slate-400 bg-slate-900 hover:text-slate-200 px-2 py-0.5 rounded-md border border-slate-700 whitespace-nowrap"><i class="fa-regular fa-circle-check text-[9px]"></i> Conferir</button>`;

        const iconBg = isParcelado
          ? 'bg-indigo-500/10 text-indigo-400 border border-indigo-500/20'
          : 'bg-amber-500/10 text-amber-400 border border-amber-500/20';

        const valueTextColor = isParcelado ? 'text-indigo-300' : 'text-amber-300';
        const editHoverColor = isParcelado ? 'hover:text-indigo-400' : 'hover:text-amber-400';

        return `
          <div class="p-3 sm:p-3.5 bg-slate-950/60 hover:bg-slate-950 border border-slate-800/80 hover:border-slate-700 rounded-xl transition group">
            
            <!-- Layout Mobile Exclusivo (2 andares organizados sem cortar títulos nem badges) -->
            <div class="flex flex-col gap-2.5 sm:hidden">
              <div class="flex items-start justify-between gap-2.5">
                <div class="flex items-center gap-2.5 min-w-0 flex-1">
                  <div class="w-9 h-9 rounded-xl ${iconBg} flex items-center justify-center shrink-0">
                    <i class="fa-solid ${isParcelado ? 'fa-repeat' : 'fa-bolt'} text-xs"></i>
                  </div>
                  <div class="min-w-0 flex-1">
                    <h4 class="text-sm font-bold text-white leading-snug break-words">${escapeHtml(item.title)}</h4>
                    <span class="text-[11px] text-slate-400 flex items-center gap-1 mt-0.5">
                      <i class="fa-regular fa-calendar text-[10px]"></i> ${formattedDate}
                    </span>
                  </div>
                </div>
                <div class="text-right shrink-0">
                  <span class="text-sm font-extrabold ${valueTextColor} block">${formatBRL(item.installmentValue)}</span>
                  ${isParcelado ? `<div class="text-[10px] text-slate-500">Total: ${formatBRL(item.totalAmount)}</div>` : ''}
                </div>
              </div>

              <div class="flex items-center justify-between gap-2 pt-2 border-t border-slate-800/60">
                <div class="flex items-center flex-wrap gap-1.5">
                  ${badgeHtml}
                  ${catBadge}
                  ${paidBadge}
                </div>
                <div class="flex items-center gap-1 shrink-0">
                  <button 
                    onclick="openEditCardModal('${item.id}')" 
                    class="w-7 h-7 rounded-lg bg-slate-900 border border-slate-800 text-slate-300 ${editHoverColor} flex items-center justify-center text-xs"
                  >
                    <i class="fa-solid fa-pen text-[10px]"></i>
                  </button>
                  <button 
                    onclick="promptDeleteCardExpense('${item.id}')" 
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
                <div class="w-9 h-9 rounded-xl ${iconBg} flex items-center justify-center shrink-0">
                  <i class="fa-solid ${isParcelado ? 'fa-repeat' : 'fa-bolt'} text-sm"></i>
                </div>
                <div class="truncate">
                  <h4 class="text-sm font-bold text-white truncate">${escapeHtml(item.title)}</h4>
                  <div class="flex items-center flex-wrap gap-1.5 mt-1">
                    ${badgeDesktopHtml}
                    ${catBadge}
                    ${paidBadge}
                    <span class="text-[11px] text-slate-500 flex items-center gap-1">
                      <i class="fa-regular fa-calendar text-[10px]"></i> ${formattedDate}
                    </span>
                  </div>
                </div>
              </div>

              <div class="flex items-center gap-3 shrink-0 ml-2">
                <div class="text-right">
                  <span class="text-sm sm:text-base font-extrabold ${valueTextColor}">${formatBRL(item.installmentValue)}</span>
                  ${isParcelado ? `<div class="text-[10px] text-slate-500">Total: ${formatBRL(item.totalAmount)}</div>` : ''}
                </div>

                <div class="flex items-center gap-1">
                  <button 
                    onclick="openEditCardModal('${item.id}')" 
                    title="Editar compra"
                    class="w-7 h-7 rounded-lg text-slate-400 ${editHoverColor} hover:bg-slate-800 transition flex items-center justify-center text-xs"
                  >
                    <i class="fa-solid fa-pen"></i>
                  </button>
                  <button 
                    onclick="promptDeleteCardExpense('${item.id}')" 
                    title="Excluir compra do cartão"
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
    function openEditCardModal(id) {
      const currentData = getCurrentMonthData();
      const item = (currentData.cardExpenses || []).find(e => e.id === id);
      if (!item) return;

      document.getElementById('editCardId').value = item.id;
      document.getElementById('editCardTitle').value = item.title;
      document.getElementById('editCardInstallmentValue').value = formatForInput(item.installmentValue);
      document.getElementById('editCardDate').value = item.date || `${appDb.selectedMonth}-10`;
      document.getElementById('editCardCategory').value = item.category || inferCategoryFromTitle(item.title);

      const installmentsSection = document.getElementById('editCardInstallmentsSection');
      if (item.isInstallment) {
        installmentsSection.classList.remove('hidden');
        document.getElementById('editCardCurrentInstallment').value = item.currentInstallment || 1;
        document.getElementById('editCardTotalInstallments').value = item.installments || 2;
      } else {
        installmentsSection.classList.add('hidden');
        document.getElementById('editCardCurrentInstallment').value = 1;
        document.getElementById('editCardTotalInstallments').value = 1;
      }

      document.getElementById('editCardModal').classList.remove('hidden');
    }

    function closeEditCardModal() {
      document.getElementById('editCardModal').classList.add('hidden');
    }

    function handleEditCardSubmit(e) {
      e.preventDefault();
      const currentData = getCurrentMonthData();
      const id = document.getElementById('editCardId').value;
      const title = document.getElementById('editCardTitle').value.trim();
      const installmentValue = parseCurrencyInput(document.getElementById('editCardInstallmentValue').value);
      const dateVal = document.getElementById('editCardDate').value || `${appDb.selectedMonth}-10`;
      const category = document.getElementById('editCardCategory').value || 'compras';

      if (!title || installmentValue <= 0) {
        showToast('Preencha um título e valor válidos!', 'error');
        return;
      }

      const item = currentData.cardExpenses.find(e => e.id === id);
      if (item) {
        item.title = title;
        item.installmentValue = installmentValue;
        item.date = dateVal;
        item.category = category;

        if (item.isInstallment) {
          const curInst = parseInt(document.getElementById('editCardCurrentInstallment').value) || 1;
          const totInst = parseInt(document.getElementById('editCardTotalInstallments').value) || 2;
          item.currentInstallment = curInst;
          item.installments = totInst;
          item.totalAmount = installmentValue * totInst;
        } else {
          item.totalAmount = installmentValue;
        }

        saveDatabase();
        renderAll();
        closeEditCardModal();
        showToast(`Compra "${title}" atualizada!`, 'success');
      }
    }
