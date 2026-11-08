// Testes isolados: nunca acessam o armazenamento do navegador do usuario.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');

function setup(initial) {
  const memory = new Map();
  if (initial !== undefined) memory.set('controle_gastos_multimonth_v3', JSON.stringify(initial));
  const context = vm.createContext({
    console, Date, Math, setTimeout, renderAll: () => {}, showToast: () => {},
    document: { getElementById: () => null },
    localStorage: {
      getItem: key => memory.get(key) ?? null,
      setItem: (key, value) => memory.set(key, value)
    }
  });
  for (const path of ['js/state.js', 'js/services/storageService.js']) {
    vm.runInContext(fs.readFileSync(path, 'utf8'), context, { filename: path });
  }
  return { context, memory, run: code => vm.runInContext(code, context) };
}

test('primeiro acesso inicia sem despesas, renda ou cartoes ficticios', () => {
  const t = setup();
  t.run('loadDatabase()');
  const db = JSON.parse(t.memory.get('controle_gastos_multimonth_v3'));
  assert.match(db.selectedMonth, /^\d{4}-\d{2}$/);
  assert.equal(db.months[db.selectedMonth].salary, 0);
  assert.equal(db.months[db.selectedMonth].budgetLimit, 0);
  assert.deepEqual(db.months[db.selectedMonth].expenses, []);
  assert.deepEqual(db.months[db.selectedMonth].cardExpenses, []);
});

test('carrega despesas existentes sem substitui-las por exemplos', () => {
  const saved = { selectedMonth: '2026-10', months: { '2026-10': {
    salary: 4200, budgetLimit: 2500, expenses: [{ id: 'abc', title: 'Teste', amount: 33, type: 'one-time' }],
    cardExpenses: [], extraIncomes: []
  } } };
  const t = setup(saved);
  t.run('loadDatabase()');
  assert.equal(t.run('appDb.months["2026-10"].salary'), 4200);
  assert.equal(t.run('appDb.months["2026-10"].expenses[0].amount'), 33);
  assert.equal(t.run('appDb.months["2026-10"].cardExpenses.length'), 0);
});

test('salva e recupera uma despesa em armazenamento simulado', () => {
  const t = setup();
  t.run('loadDatabase()');
  t.run('getCurrentMonthData().expenses.push({id:"teste",title:"Homologacao",amount:1,type:"one-time"}); saveDatabase()');
  t.run('appDb = {selectedMonth:"",months:{}}; loadDatabase()');
  assert.equal(t.run('getCurrentMonthData().expenses[0].amount'), 1);
});

test('novo mes herda apenas fixas e parcelas pendentes', () => {
  const t = setup({ selectedMonth: '2026-10', months: { '2026-10': {
    salary: 3000, budgetLimit: 2000, extraIncomes: [],
    expenses: [{id:'a',title:'Luz',amount:100,type:'fixed'}, {id:'b',title:'Lanche',amount:20,type:'one-time'}],
    cardExpenses: [{id:'c',title:'Compra',isInstallment:true,currentInstallment:1,installments:3,installmentValue:50}]
  } } });
  t.run('loadDatabase(); ensureMonthExists("2026-11")');
  assert.equal(t.run('appDb.months["2026-11"].expenses.length'), 1);
  assert.equal(t.run('appDb.months["2026-11"].cardExpenses[0].currentInstallment'), 2);
  assert.equal(t.run('appDb.months["2026-11"].salary'), 3000);
});

test('saldo considera renda, despesas e cartao', () => {
  const t = setup({ selectedMonth: '2026-11', months: { '2026-11': {
    salary: 100, extraIncomes: [], expenses: [{amount:20}], cardExpenses: [{installmentValue:10}]
  } } });
  t.run('loadDatabase()');
  assert.equal(t.run('calculateMonthNetBalance("2026-11")'), 70);
});

test('sincronizacao manual acrescenta parcela em mes ja existente sem duplicar', () => {
  const t = setup({ selectedMonth:'2026-11', months: {
    '2026-10': {salary:0, expenses:[], cardExpenses:[{id:'compra1',title:'Notebook',isInstallment:true,installments:2,currentInstallment:1,installmentValue:100}]},
    '2026-11': {salary:0, expenses:[], cardExpenses:[]}
  }});
  t.run('loadDatabase(); syncFromPreviousMonth(true); syncFromPreviousMonth(true)');
  assert.equal(t.run('appDb.months["2026-11"].cardExpenses.length'), 1);
  assert.equal(t.run('appDb.months["2026-11"].cardExpenses[0].currentInstallment'), 2);
});

test('sincronizacao nao sobrescreve parcela existente editada', () => {
  const t = setup({ selectedMonth:'2026-11', months: {
    '2026-10': {salary:0, expenses:[], cardExpenses:[{id:'compra1',title:'Notebook',isInstallment:true,installments:2,currentInstallment:1,installmentValue:100}]},
    '2026-11': {salary:0, expenses:[], cardExpenses:[{id:'editado',installmentOriginId:'compra1',title:'Notebook editado',isInstallment:true,installments:2,currentInstallment:2,installmentValue:80}]}
  }});
  t.run('loadDatabase(); syncFromPreviousMonth(true)');
  assert.equal(t.run('appDb.months["2026-11"].cardExpenses.length'), 1);
  assert.equal(t.run('appDb.months["2026-11"].cardExpenses[0].installmentValue'), 80);
});
