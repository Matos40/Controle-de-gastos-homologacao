(() => {
  const dialog = document.getElementById('ocrModal');
  const stage = document.getElementById('simulatedReview');
  const confirm = document.getElementById('simulatedConfirm');
  const status = document.getElementById('simulatedStatus');
  const open = document.getElementById('premiumInvoiceButton');
  let review = null, turn = 0, busy = false;
  const entitled = () => window.raytechCanUseInvoiceAI() && !window.raytechSessionRevoked;
  const close = () => { review = null; dialog.close(); };
  window.openOcrModal = () => {
    if (!entitled()) return;
    review = null;
    stage.replaceChildren();
    confirm.disabled = true;
    status.textContent = 'Gere uma amostra para revisar antes de lançar.';
    dialog.showModal();
  };
  document.getElementById('simulatedClose').onclick = close;
  dialog.addEventListener('close', () => { review = null; turn++; });
  const extract = document.getElementById('simulatedExtract');
  extract.onclick = async () => {
    if (busy) return;
    const id = ++turn;
    if (!entitled()) { close(); return; }
    review=null;stage.replaceChildren();
    confirm.disabled = extract.disabled = busy = true;
    const month = appDb.selectedMonth;
    let result;
    try {
      result=await window.raytechExtractInvoice();
      if(result.simulated!==true||result.requiresReview!==true||!Array.isArray(result.items))throw Error('INVALID_RESPONSE');
    } catch (error) {
      if (id === turn) status.textContent = error.message === 'QUOTA_EXCEEDED'
        ? 'Cota atingida. Tente novamente na próxima janela UTC.'
        : error.message==='GLOBAL_BUDGET_EXCEEDED'?'Orçamento global atingido.':'Não foi possível autorizar a leitura simulada.';
      return;
    } finally { busy = extract.disabled = false; }
    if (id !== turn || !dialog.open) return;
    if (!entitled()) { close(); return; }
    if(month!==appDb.selectedMonth){status.textContent='O mês mudou. Gere uma nova revisão.';return;}
    review = {month, items: result.items.map((item,i)=>({
      id:'simulated_v345_'+month+'_'+i,
      title:item.title, category:i===0?'alimentacao':'transporte',
      installmentValue:item.installmentValue,totalAmount:item.totalAmount,
      installments:item.installments,currentInstallment:item.currentInstallment,
      isInstallment:item.isInstallment,paid:false,date:month+'-01',
    }))};
    stage.replaceChildren(...review.items.map((item, i) => {
      const row = document.createElement('label');
      const checked = document.createElement('input');
      checked.type = 'checkbox';
      checked.checked = true;
      checked.dataset.invoiceIndex = String(i);
      row.append(checked, ' ' + item.title + ' · ' + formatBRL(item.totalAmount));
      return row;
    }));
    confirm.disabled = false;
    status.textContent = 'Revise os lançamentos para ' + month + '.';
  };
  confirm.onclick = async () => {
    if(busy)return;
    const original=review,stamp=turn;
    if(!original)return;
    busy=confirm.disabled=true;
    try{await window.raytechAuthorizeInvoice();}
    catch{if(stamp===turn)status.textContent='Acesso à leitura não autorizado.';return;}
    finally{busy=false;if(stamp===turn&&review===original)confirm.disabled=false;}
    if(stamp!==turn||review!==original||!dialog.open)return;
    if (!entitled()) { close(); return; }
    if (!review || review.month !== appDb.selectedMonth) {
      confirm.disabled = true;
      status.textContent = 'O mês mudou. Gere uma nova revisão.';
      return;
    }
    const month = appDb.months[review.month];
    if (!month || month.closed) { status.textContent = 'O mês está fechado.'; return; }
    const chosen = [...stage.querySelectorAll('input:checked')].map(box => review.items[Number(box.dataset.invoiceIndex)]);
    if (!chosen.length) { status.textContent = 'Selecione pelo menos um lançamento.'; return; }
    const prior = month.cardExpenses;
    const fresh = chosen.filter(item => !prior.some(existing => existing.id === item.id));
    if (!fresh.length) { status.textContent = 'A amostra selecionada já foi lançada neste mês.'; return; }
    month.cardExpenses = [...fresh, ...prior];
    try { saveDatabase(); }
    catch { month.cardExpenses = prior; status.textContent = 'Não foi possível salvar a amostra.'; return; }
    renderAll();
    close();
    showToast('Lançamentos simulados adicionados à fatura.', 'success');
  };
  function paint() {
    open?.classList.toggle('hidden', !entitled());
    if (!entitled() && dialog.open) close();
  }
  window.addEventListener('raytech-ai-entitlement-changed', paint);
  window.addEventListener('offline', paint);
  window.addEventListener('online', paint);
  paint();
})();
