// Testes isolados: nunca acessam o armazenamento do navegador do usuario.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');

function setup(initial) {
  const memory = new Map();
  if (initial !== undefined) memory.set('controle_gastos_multimonth_v3', JSON.stringify(initial));
  const context = vm.createContext({
    console, Date, Math, setTimeout, renderAll: () => {}, updateMonthHeader: () => {}, showToast: () => {},
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

test('backup integral preserva meses, receitas, despesas e parcelas', () => {
  const original = {selectedMonth:'2026-11',months:{
    '2026-10':{salary:3000,budgetLimit:1000,extraIncomes:[{id:'r',amount:50}],expenses:[{id:'e',title:'Luz',amount:120,type:'fixed'}],cardExpenses:[]},
    '2026-11':{salary:3200,budgetLimit:1500,extraIncomes:[],expenses:[],cardExpenses:[{id:'c',title:'Compra',isInstallment:true,installments:3,currentInstallment:2,installmentValue:100,paid:true}]}
  }};
  const t=setup(original);
  t.run('loadDatabase()');
  const normalized = JSON.parse(t.run('JSON.stringify(appDb)'));
  t.run('restoreBackupDatabase(JSON.parse(JSON.stringify(appDb)))');
  const saved=JSON.parse(t.memory.get('controle_gastos_multimonth_v3'));
  assert.deepEqual(saved, normalized);
});

test('backup corrompido e rejeitado sem alterar dados salvos', () => {
  const t=setup();
  t.run('loadDatabase()');
  const before=t.memory.get('controle_gastos_multimonth_v3');
  assert.throws(()=>t.run('restoreBackupDatabase({selectedMonth:"2026-11",months:{"2026-11":{expenses:[],cardExpenses:[{title:"X",installmentValue:100,isInstallment:true,installments:2,currentInstallment:9}]}}})'),/Backup invalido/);
  assert.equal(t.memory.get('controle_gastos_multimonth_v3'),before);
});

test('backup sem mes selecionado valido nao substitui o banco', () => {
  const t=setup();
  t.run('loadDatabase()');
  const before=t.memory.get('controle_gastos_multimonth_v3');
  assert.throws(()=>t.run('restoreBackupDatabase({selectedMonth:"2026-12",months:{"2026-11":{expenses:[],cardExpenses:[]}}})'),/Backup invalido/);
  assert.equal(t.memory.get('controle_gastos_multimonth_v3'),before);
});

test('sincronizacao preserva valor de despesa fixa editada no mes atual', () => {
  const t=setup({selectedMonth:'2026-11',months:{
    '2026-10':{salary:0,expenses:[{id:'a',title:'Luz',type:'fixed',amount:100}],cardExpenses:[]},
    '2026-11':{salary:0,expenses:[{id:'b',title:'Luz',type:'fixed',amount:180}],cardExpenses:[]}
  }});
  t.run('loadDatabase(); syncFromPreviousMonth(true)');
  assert.equal(t.run('appDb.months["2026-11"].expenses[0].amount'),180);
  assert.equal(t.run('appDb.months["2026-11"].expenses.length'),1);
});

test('sincronizacao nao recria parcela excluida com marcador de exclusao', () => {
  const t=setup({selectedMonth:'2026-11',months:{
    '2026-10':{salary:0,expenses:[],cardExpenses:[{id:'compra1',title:'Notebook',isInstallment:true,installments:3,currentInstallment:1,installmentValue:100}]},
    '2026-11':{salary:0,expenses:[],cardExpenses:[],deletedInstallmentOrigins:['compra1:2']}
  }});
  t.run('loadDatabase(); syncFromPreviousMonth(true)');
  assert.equal(t.run('appDb.months["2026-11"].cardExpenses.length'),0);
});

test('mes criado automaticamente preserva origem e sincronizacao nao duplica parcela', () => {
  const t=setup({selectedMonth:'2026-11',months:{
    '2026-11':{salary:0,expenses:[],cardExpenses:[{id:'compra1',title:'Notebook',isInstallment:true,installments:3,currentInstallment:1,installmentValue:300}]}
  }});
  t.run('loadDatabase(); ensureMonthExists("2026-12"); appDb.selectedMonth="2026-12"; syncFromPreviousMonth(true); syncFromPreviousMonth(true)');
  assert.equal(t.run('getCurrentMonthData().cardExpenses.length'),1);
  assert.equal(t.run('getCurrentMonthData().cardExpenses[0].currentInstallment'),2);
  assert.equal(t.run('getCurrentMonthData().cardExpenses[0].installmentOriginId'),'compra1');
});

test('parcela excluida em mes criado automaticamente nao reaparece na sincronizacao', () => {
  const t=setup({selectedMonth:'2026-11',months:{
    '2026-11':{salary:0,expenses:[],cardExpenses:[{id:'compra1',title:'Notebook',isInstallment:true,installments:3,currentInstallment:1,installmentValue:300}]}
  }});
  t.run('loadDatabase(); ensureMonthExists("2026-12"); appDb.selectedMonth="2026-12"; getCurrentMonthData().cardExpenses=[]; getCurrentMonthData().deletedInstallmentOrigins=["compra1:2"]; syncFromPreviousMonth(true)');
  assert.equal(t.run('getCurrentMonthData().cardExpenses.length'),0);
});

function setupAdvance(initial) {
  const t = setup(initial);
  t.context.window = { addEventListener: () => {} };
  vm.runInContext(fs.readFileSync('js/app.js', 'utf8'), t.context, {filename:'js/app.js'});
  // Sobrescrever o modal definido no app: confirmar diretamente sem DOM.
  t.context.showModal = (_title, _message, confirm) => confirm();
  // Funcoes de UI do app nao devem acessar o DOM real durante o teste.
  t.run('showToast = () => {}; renderAll = () => {}; updateMonthHeader = () => {};');
  return t;
}

test('promptAdvanceMonth preserva mes existente, despesas editadas e receitas', () => {
  const t = setupAdvance({selectedMonth:'2026-11',months:{
    '2026-11':{salary:3000,budgetLimit:1000,expenses:[{id:'luz',title:'Luz',type:'fixed',amount:100}],extraIncomes:[],cardExpenses:[{id:'compra1',installmentOriginId:'compra1',title:'Notebook',isInstallment:true,installments:3,currentInstallment:1,installmentValue:300}]},
    '2026-12':{salary:4500,budgetLimit:1200,expenses:[{id:'luz2',title:'Luz',type:'fixed',amount:180}],extraIncomes:[{id:'bonus',amount:100}],cardExpenses:[]}
  }});
  t.run('loadDatabase(); promptAdvanceMonth()');
  assert.equal(t.run('appDb.selectedMonth'),'2026-12');
  assert.equal(t.run('appDb.months["2026-12"].expenses[0].amount'),180);
  assert.equal(t.run('appDb.months["2026-12"].extraIncomes.length'),1);
  assert.equal(t.run('appDb.months["2026-12"].salary'),4500);
  assert.equal(t.run('appDb.months["2026-12"].cardExpenses.length'),1);
  assert.equal(t.run('appDb.months["2026-12"].cardExpenses[0].currentInstallment'),2);
});

test('promptAdvanceMonth nao duplica parcela ja existente', () => {
  const t = setupAdvance({selectedMonth:'2026-11',months:{
    '2026-11':{salary:0,expenses:[],cardExpenses:[{id:'compra1',installmentOriginId:'compra1',title:'Notebook',isInstallment:true,installments:3,currentInstallment:1,installmentValue:300}]},
    '2026-12':{salary:0,expenses:[],cardExpenses:[{id:'parcela2',installmentOriginId:'compra1',title:'Notebook',isInstallment:true,installments:3,currentInstallment:2,installmentValue:300}]}
  }});
  t.run('loadDatabase(); promptAdvanceMonth()');
  assert.equal(t.run('appDb.months["2026-12"].cardExpenses.length'),1);
});

test('promptAdvanceMonth respeita exclusao registrada da parcela seguinte', () => {
  const t = setupAdvance({selectedMonth:'2026-11',months:{
    '2026-11':{salary:0,expenses:[],cardExpenses:[{id:'compra1',installmentOriginId:'compra1',title:'Notebook',isInstallment:true,installments:3,currentInstallment:1,installmentValue:300}]},
    '2026-12':{salary:0,expenses:[],cardExpenses:[],deletedInstallmentOrigins:['compra1:2']}
  }});
  t.run('loadDatabase(); promptAdvanceMonth()');
  assert.equal(t.run('appDb.months["2026-12"].cardExpenses.length'),0);
  assert.deepEqual(Array.from(t.run('appDb.months["2026-12"].deletedInstallmentOrigins')),['compra1:2']);
});
