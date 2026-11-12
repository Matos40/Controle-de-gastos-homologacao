'use strict';
const assert = require('node:assert/strict');
const { createLocalRepository, DEFAULT_KEY } = require('../js/services/localRepository.js');

function fakeStorage() {
  const values = new Map();
  return {
    getItem: key => values.has(key) ? values.get(key) : null,
    setItem: (key, value) => values.set(key, String(value)),
    dump: () => new Map(values)
  };
}

const storage = fakeStorage();
const repo = createLocalRepository(storage);
const sample = {
  selectedMonth: '2026-11',
  months: {
    '2026-11': {
      salary: 5000, budgetLimit: 2500, expenses: [
        { id: 'e1', title: 'Internet', amount: 100, type: 'fixed' }
      ], cardExpenses: [], extraIncomes: [], deletedInstallmentOrigins: []
    },
    '2026-10': {
      salary: 4000, expenses: [], cardExpenses: [], extraIncomes: []
    }
  }
};
let count = 0;
function check(label, fn) { fn(); count++; console.log('APROVADO:', label); }

check('leitura ausente nao cria dados', () => {
  assert.equal(repo.readSnapshot(), null);
  assert.equal(storage.dump().size, 0);
});
check('substituicao sem confirmacao e bloqueada', () => {
  assert.throws(() => repo.replaceLocalSnapshot(sample), /confirmacao/);
});
check('banco invalido e rejeitado', () => {
  assert.throws(() => repo.replaceLocalSnapshot({ months: {} }, { confirmed: true }));
});
check('snapshot ficticio pode ser salvo com confirmacao', () => {
  assert.equal(repo.replaceLocalSnapshot(sample, { confirmed: true }), true);
  assert.ok(storage.getItem(DEFAULT_KEY));
});
check('meses sao listados em ordem', () => {
  assert.deepEqual(repo.listMonths(), ['2026-10', '2026-11']);
});
check('leitura de mes e isolada por copia', () => {
  const month = repo.getMonth('2026-11');
  month.expenses[0].amount = 999;
  assert.equal(repo.getMonth('2026-11').expenses[0].amount, 100);
});
check('exportacao e isolada por copia', () => {
  const backup = repo.exportSnapshot();
  backup.months['2026-11'].salary = 0;
  assert.equal(repo.readSnapshot().months['2026-11'].salary, 5000);
});
check('chaves de PIN e Gemini permanecem intocadas', () => {
  storage.setItem('gemini_user_api_key', 'chave-ficticia');
  storage.setItem('controle_gastos_pin_lock', 'pin-ficticio');
  repo.replaceLocalSnapshot(sample, { confirmed: true });
  assert.equal(storage.getItem('gemini_user_api_key'), 'chave-ficticia');
  assert.equal(storage.getItem('controle_gastos_pin_lock'), 'pin-ficticio');
});
check('mes invalido e rejeitado', () => {
  assert.throws(() => repo.getMonth('2026-13'), /Mes invalido/);
});
check('nenhum dado e alterado por consultas', () => {
  const before = storage.getItem(DEFAULT_KEY);
  repo.readSnapshot(); repo.listMonths(); repo.getMonth('2026-10');
  assert.equal(storage.getItem(DEFAULT_KEY), before);
});
console.log('RESULTADO: ' + count + '/10 TESTES APROVADOS');
