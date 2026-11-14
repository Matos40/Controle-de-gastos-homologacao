/* Exportação e importação Excel otimizada para migração e versão mobile sem perdas. */
async function exportToExcel() {
  if (typeof XLSX === 'undefined') {
    showToast('Biblioteca do Excel ainda carregando. Aguarde um instante.', 'error');
    return;
  }

  try {
    if(typeof window.raytechSyntheticExport !== "function") throw Error("Aguarde a autorização da conta de teste.");
    const snapshot=JSON.stringify(appDb);
    const wb = XLSX.utils.book_new();
    const monthKeys = Object.keys(appDb.months || {}).sort();
    if (!monthKeys.length && appDb.selectedMonth) monthKeys.push(appDb.selectedMonth);

    const moneyFmt = 'R$ #,##0.00;[Red]-R$ #,##0.00';
    const safe = (v) => v === undefined || v === null ? '' : v;
    const categoryLabel = (item) => {
      const key = item.category && CATEGORIES[item.category]
        ? item.category
        : inferCategoryFromTitle(item.title || item.description || '');
      return CATEGORIES[key]?.label || 'Outros';
    };

    const addSheet = (name, rows, widths, freeze = 'A2') => {
      const ws = XLSX.utils.aoa_to_sheet(rows);
      ws['!cols'] = widths.map(w => ({ wch: w }));
      ws['!freeze'] = { xSplit: 0, ySplit: freeze === 'A1' ? 0 : 1, topLeftCell: freeze === 'A1' ? 'A1' : 'A2', state: 'frozen' };
      const range = XLSX.utils.decode_range(ws['!ref'] || 'A1');
      for (let c = range.s.c; c <= range.e.c; c++) {
        const cell = ws[XLSX.utils.encode_cell({ r: 0, c })];
        if (cell) cell.s = { font: { bold: true, color: { rgb: 'FFFFFF' } }, fill: { fgColor: { rgb: '0F766E' } } };
      }
      XLSX.utils.book_append_sheet(wb, ws, name.slice(0, 31));
      return ws;
    };

    const applyMoney = (ws, cols, firstRow = 1) => {
      const range = XLSX.utils.decode_range(ws['!ref'] || 'A1');
      for (let r = firstRow; r <= range.e.r; r++) cols.forEach(c => {
        const cell = ws[XLSX.utils.encode_cell({ r, c })];
        if (cell && typeof cell.v === 'number') cell.z = moneyFmt;
      });
    };

    const summaryRows = [[
      'Mês', 'Salário base (R$)', 'Entradas extras (R$)', 'Renda total (R$)',
      'Orçamento planejado (R$)', 'Despesas gerais (R$)', 'Cartão no mês (R$)',
      'Total de gastos (R$)', 'Saldo do mês (R$)', 'Status'
    ]];

    const expenseRows = [['Mês', 'ID', 'Data', 'Descrição', 'Categoria', 'Tipo (Fixo/Único)', 'Status (Pago/Pendente)', 'Valor (R$)']];
    const cardRows = [['Mês', 'ID', 'Data', 'Descrição da compra', 'Categoria', 'Modalidade', 'Parcela atual', 'Total de parcelas', 'Valor da parcela (R$)', 'Valor total (R$)', 'Status']];
    const incomeRows = [['Mês', 'ID', 'Data', 'Descrição', 'Valor (R$)']];

    monthKeys.forEach(ym => {
      const data = appDb.months[ym] || {};
      const expenses = data.expenses || [];
      const cards = data.cardExpenses || [];
      const incomes = data.extraIncomes || [];
      const salary = Number(data.salary) || 0;
      const extra = incomes.reduce((s, x) => s + (Number(x.amount) || 0), 0);
      const general = expenses.reduce((s, x) => s + (Number(x.amount) || 0), 0);
      const card = cards.reduce((s, x) => s + (Number(x.installmentValue) || 0), 0);
      const total = general + card;
      const balance = calculateMonthNetBalance(ym);

      summaryRows.push([ym, salary, extra, salary + extra, Number(data.budgetLimit) || 0, general, card, total, balance, balance >= 0 ? 'Positivo' : 'Negativo']);

      expenses.forEach(e => {
        expenseRows.push([ym, safe(e.id), safe(e.date), safe(e.title), categoryLabel(e), e.type === 'fixed' ? 'Fixo' : 'Único', e.paid ? 'Pago' : 'Pendente', Number(e.amount) || 0]);
      });

      cards.forEach(c => {
        cardRows.push([
          ym, safe(c.id), safe(c.date), safe(c.title), categoryLabel(c), 
          c.isInstallment ? 'Parcelado (Fixo)' : 'À vista (Único)', 
          Number(c.currentInstallment) || 1, Number(c.installments) || 1, 
          Number(c.installmentValue) || 0, Number(c.totalAmount) || Number(c.installmentValue) || 0, 
          c.paid ? 'Pago' : 'Pendente'
        ]);
      });

      incomes.forEach(i => {
        incomeRows.push([ym, safe(i.id), safe(i.date), safe(i.description), Number(i.amount) || 0]);
      });
    });

    const wsSummary = addSheet('Resumo mensal', summaryRows, [13, 18, 19, 18, 22, 21, 19, 19, 22, 14]);
    applyMoney(wsSummary, [1, 2, 3, 4, 5, 6, 7, 8]);

    const wsExpenses = addSheet('Despesas gerais', expenseRows, [13, 28, 14, 38, 24, 16, 18, 18]);
    applyMoney(wsExpenses, [7]);

    const wsCards = addSheet('Cartao de credito', cardRows, [13, 28, 14, 38, 24, 18, 15, 17, 22, 22, 14]);
    applyMoney(wsCards, [8, 9]);

    const wsIncomes = addSheet('Entradas extras', incomeRows, [13, 28, 18, 38, 18]);
    applyMoney(wsIncomes, [4]);

    // Aba de Backup JSON integral para restauração sem perdas
    const backupJson = JSON.stringify(appDb);
    const chunkSize = 30000;
    const chunks = [];
    for (let offset = 0; offset < backupJson.length; offset += chunkSize) {
      chunks.push(backupJson.slice(offset, offset + chunkSize));
    }
    const restoreRows = [
      ['Formato', 'Versão', 'Parte', 'Total', 'JSON'],
      ...chunks.map((chunk, index) => ['RAYTECH_BACKUP', 1, index + 1, chunks.length, chunk])
    ];
    addSheet('Backup restauracao', restoreRows, [30, 10, 10, 10, 100]);

    const pack=await window.raytechSyntheticExport(snapshot);
    if(!pack)throw Error("Conta de teste mudou.");
    addSheet("Raytech Teste",pack.rows,[34,70,10,10,100]);
    const filename = `Raytech_Teste_${JSON.parse(snapshot).selectedMonth}.xlsx`;
    XLSX.writeFile(wb, filename, { compression: true });
    showToast('Planilha de backup completo exportada com sucesso!', 'success');
  } catch (err) {
    console.error('Erro ao exportar:', err);
    showToast('Erro ao exportar planilha: ' + err.message, 'error');
  }
}

async function exportData() {
  try{if(typeof window.raytechSyntheticExport!=="function")throw Error("Conta de teste indisponível.");const pack=await window.raytechSyntheticExport(JSON.stringify(appDb));if(!pack)throw Error("Conta de teste mudou.");const url=URL.createObjectURL(new Blob([JSON.stringify(pack.backup,null,2)],{type:"application/json"})),a=document.createElement("a");a.href=url;a.download="Raytech_Teste_"+JSON.parse(pack.backup.payload).selectedMonth+".json";a.click();setTimeout(()=>URL.revokeObjectURL(url),3000);showToast("Backup fictício JSON exportado!","success");}catch(e){showToast("Exportação não concluída: "+e.message,"error");}
}
