/* Estado compartilhado da aplicação. Scripts clássicos são carregados em ordem no index.html. */
    // Chaves de armazenamento
    const STORAGE_DATABASE_KEY = 'controle_gastos_multimonth_v3';
    const STORAGE_GEMINI_KEY = 'gemini_user_api_key';
    const STORAGE_PIN_KEY = 'controle_gastos_pin_lock';
    const DEFAULT_API_KEY = '';
    let base64InvoiceImage = null;
    let isPrivacyMode = false;
    let categoryChartInstance = null;
    let evolutionChartInstance = null;
    let deferredPwaPrompt = null;

    // Mapa de Categorias com Ícones, Cores e Nomes
    const CATEGORIES = {
      moradia:     { label: 'Moradia & Contas', icon: '🏠', color: '#6366f1', badgeClass: 'text-indigo-300 bg-indigo-950/60 border-indigo-500/30' },
      alimentacao: { label: 'Alimentação',      icon: '🍔', color: '#10b981', badgeClass: 'text-emerald-300 bg-emerald-950/60 border-emerald-500/30' },
      transporte:  { label: 'Transporte',       icon: '🚗', color: '#f59e0b', badgeClass: 'text-amber-300 bg-amber-950/60 border-amber-500/30' },
      compras:     { label: 'Compras',          icon: '🛍️', color: '#a855f7', badgeClass: 'text-purple-300 bg-purple-950/60 border-purple-500/30' },
      lazer:       { label: 'Lazer',            icon: '🎮', color: '#ec4899', badgeClass: 'text-pink-300 bg-pink-950/60 border-pink-500/30' },
      saude:       { label: 'Saúde',            icon: '🩺', color: '#06b6d4', badgeClass: 'text-cyan-300 bg-cyan-950/60 border-cyan-500/30' },
      outros:      { label: 'Outros',           icon: '📦', color: '#64748b', badgeClass: 'text-slate-300 bg-slate-800 border-slate-700' }
    };

    function inferCategoryFromTitle(title) {
      const t = (title || '').toLowerCase();
      if (t.includes('uber') || t.includes('shell') || t.includes('combust') || t.includes('gasolina') || t.includes('99')) return 'transporte';
      if (t.includes('luz') || t.includes('água') || t.includes('agua') || t.includes('fibra') || t.includes('claro') || t.includes('net') || t.includes('aluguel') || t.includes('condom')) return 'moradia';
      if (t.includes('shopee') || t.includes('shein') || t.includes('mercadolivre') || t.includes('loja') || t.includes('roupa')) return 'compras';
      if (t.includes('growth') || t.includes('farm') || t.includes('drogaria') || t.includes('medico') || t.includes('saude')) return 'saude';
      if (t.includes('mercado') || t.includes('organico') || t.includes('ifood') || t.includes('padaria') || t.includes('restaurante') || t.includes('santana')) return 'alimentacao';
      if (t.includes('villa cabana') || t.includes('cinema') || t.includes('netflix') || t.includes('spotify')) return 'lazer';
      return 'outros';
    }

    // Estado Geral da Aplicação
    let appDb = {
      selectedMonth: '',
      months: {}
    };

    let activeFilter = 'all';
    let activeCardFilter = 'all';
    let currentTab = 'general';
    let pendingModalAction = null;

    // Elementos da Interface
    const currentMonthDisplay = document.getElementById('currentMonthDisplay');
    const salaryInput = document.getElementById('salaryInput');
    const salaryNotice = document.getElementById('salarySavedNotice');
    const cardSalaryValue = document.getElementById('cardSalaryValue');
    const cardFixedValue = document.getElementById('cardFixedValue');
    const cardFixedSub = document.getElementById('cardFixedSub');
    const cardOneTimeValue = document.getElementById('cardOneTimeValue');
    const cardOneTimeSub = document.getElementById('cardOneTimeSub');
    const cardCreditValue = document.getElementById('cardCreditValue');
    const cardCreditSub = document.getElementById('cardCreditSub');
    const cardBalanceValue = document.getElementById('cardBalanceValue');
    const balanceCard = document.getElementById('balanceCard');
    const balanceBadge = document.getElementById('balanceBadge');
    const balanceTip = document.getElementById('balanceTip');
    const spentPercent = document.getElementById('spentPercent');
    const spentProgressBar = document.getElementById('spentProgressBar');

    const expensesContainer = document.getElementById('expensesContainer');
    const emptyState = document.getElementById('emptyState');
    const countSummary = document.getElementById('countSummary');
    const totalFilteredText = document.getElementById('totalFilteredText');
    const expenseDate = document.getElementById('expenseDate');

    const cardExpensesContainer = document.getElementById('cardExpensesContainer');
    const cardEmptyState = document.getElementById('cardEmptyState');
    const cardCountSummary = document.getElementById('cardCountSummary');
    const cardMonthlyTotalHeader = document.getElementById('cardMonthlyTotalHeader');

    function parseCurrencyInput(input) {
      if (typeof input === 'number') return isNaN(input) ? 0 : input;
      if (!input) return 0;
      
      let str = String(input).trim().replace(/[^\d,\.-]/g, '');

      if (str.includes('.') && str.includes(',')) {
        str = str.replace(/\./g, '').replace(',', '.');
      } else if (str.includes(',')) {
        str = str.replace(',', '.');
      } else if ((str.match(/\./g) || []).length > 1) {
        const lastDotIndex = str.lastIndexOf('.');
        str = str.substring(0, lastDotIndex).replace(/\./g, '') + '.' + str.substring(lastDotIndex + 1);
      }

      const num = parseFloat(str);
      return isNaN(num) ? 0 : num;
    }

    function formatForInput(val) {
      if (val === null || val === undefined || isNaN(val) || val === 0) return '';
      return Number(val).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    }

    function formatBRL(value) {
      if (isPrivacyMode) return 'R$ •••••';
      return (Number(value) || 0).toLocaleString('pt-BR', {
        style: 'currency',
        currency: 'BRL',
        minimumFractionDigits: 2,
        maximumFractionDigits: 2
      });
    }

    function formatMonthYear(ymString) {
      if (!ymString) return '';
      const [year, month] = ymString.split('-');
      const date = new Date(parseInt(year), parseInt(month) - 1, 1);
      return date.toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' });
    }

    function calculateMonthNetBalance(ym) {
      const data = appDb.months[ym];
      if (!data) return 0;
      const sal = Number(data.salary) || 0;
      const extraTotal = (data.extraIncomes || []).reduce((sum, item) => sum + (Number(item.amount) || 0), 0);
      const expTotal = (data.expenses || []).reduce((sum, item) => sum + (Number(item.amount) || 0), 0);
      const cardTotal = (data.cardExpenses || []).reduce((sum, item) => sum + (Number(item.installmentValue) || 0), 0);
      
      const prevYM = getPreviousMonthYM(ym);
      const carried = appDb.months[prevYM] ? calculateMonthNetBalance(prevYM) : 0;

      return (sal + extraTotal + carried) - (expTotal + cardTotal);
    }

    function getPreviousMonthYM(ym) {
      if (!ym) return '';
      const [year, month] = ym.split('-').map(Number);
      const d = new Date(year, month - 2, 1);
      return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
    }

    // Gestão de Entradas Extras de Dinheiro

    function getCurrentMonthData() {
      if (!appDb.selectedMonth) {
        appDb.selectedMonth = '2026-10';
      }
      ensureMonthExists(appDb.selectedMonth);
      return appDb.months[appDb.selectedMonth];
    }

    function getTodayYM() {
      const d = new Date();
      return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
    }

    function getTodayFullDate() {
      const d = new Date();
      return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    }
