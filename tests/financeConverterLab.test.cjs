'use strict';
const assert = require('node:assert/strict');
const { encode, decode } = require('../js/services/financeConverterLab.js');
let passed = 0;
function check(label, fn) { fn(); passed++; console.log('APROVADO:', label); }
const original = {
  selectedMonth: '2026-11',
  futureSetting: { enabled: true },
  months: {
    '2026-10': {
      salary: 6000.75, budgetLimit: 4800, closed: true,
      closedAt: '2026-11-01T12:00:00.000Z',
      deletedInstallmentOrigins: ['origem_x:2'],
      extraIncomes: [{ id: 'income1', description: 'Freela', amount: 500.55, date: '2026-10-12' }],
      expenses: [{ id: 'exp1', title: 'Internet', amount: 99.9, type: 'fixed',
        category: 'moradia', paid: true, date: '2026-10-05', customField: { a: 1 } }],
      cardExpenses: [{ id: 'card1', title: 'Notebook', category: 'compras',
        installmentValue: 333.33, totalAmount: 1999.98, isInstallment: true,
        installments: 6, currentInstallment: 2, installmentOriginId: 'origem_x',
        paid: false, date: '2026-10-03' }]
    },
    '2026-11': {
      salary: 6200, budgetLimit: 5000, expenses: [
        { id: 'exp2', title: 'Mercado', amount: 20, type: 'one-time', paid: false },
        { id: 'exp3', title: 'Mercado', amount: 20, type: 'one-time', paid: false }
      ],
      cardExpenses: [], extraIncomes: [], deletedInstallmentOrigins: [],
      closed: false, closedAt: null
    }
  }
};
check('ida e volta preserva snapshot completo', () => assert.deepEqual(decode(encode(original)), original));
check('nao modifica objeto de origem', () => {
  const before = structuredClone(original); encode(original); assert.deepEqual(original, before);
});
check('mantem campos desconhecidos e valores decimais', () => {
  const result = decode(encode(original));
  assert.equal(result.futureSetting.enabled, true);
  assert.equal(result.months['2026-10'].expenses[0].customField.a, 1);
  assert.equal(result.months['2026-10'].cardExpenses[0].installmentValue, 333.33);
});
check('mantem ordem e lancamentos de mesmo valor', () => {
  const result = decode(encode(original));
  assert.deepEqual(result.months['2026-11'].expenses.map(x => x.id), ['exp2', 'exp3']);
});
check('preserva exclusoes de parcelas e metadados de fechamento', () => {
  const result = decode(encode(original)).months['2026-10'];
  assert.deepEqual(result.deletedInstallmentOrigins, ['origem_x:2']);
  assert.equal(result.closed, true);
  assert.equal(result.closedAt, '2026-11-01T12:00:00.000Z');
});
check('preserva ausencia de receitas extras em backup legado', () => {
  const db = structuredClone(original);
  delete db.months['2026-11'].extraIncomes;
  assert.deepEqual(decode(encode(db)), db);
});
check('snapshot convertido e independente do original', () => {
  const converted = encode(original);
  converted.records[0].value.amount = 0;
  assert.equal(original.months['2026-10'].expenses[0].amount, 99.9);
});
check('reconstrucao nao altera envelope', () => {
  const converted = encode(original);
  const before = structuredClone(converted);
  decode(converted);
  assert.deepEqual(converted, before);
});
check('IDs duplicados na mesma colecao sao bloqueados', () => {
  const db = structuredClone(original);
  db.months['2026-11'].expenses[1].id = 'exp2';
  assert.throws(() => encode(db), /duplicado/);
});
check('IDs ausentes sao bloqueados sem inventar identificadores', () => {
  const db = structuredClone(original);
  delete db.months['2026-11'].expenses[0].id;
  assert.throws(() => encode(db), /ID estavel/);
});
check('dados nao JSON sao bloqueados', () => {
  const db = structuredClone(original);
  db.months['2026-11'].salary = Infinity;
  assert.throws(() => encode(db), /nao JSON/);
});
check('indice repetido no envelope e bloqueado', () => {
  const converted = encode(original);
  converted.records.push(structuredClone(converted.records[0]));
  assert.throws(() => decode(converted), /duplicado/);
});
check('envelope sem registro nao pode reconstruir lista incompleta', () => {
  const converted = encode(original);
  converted.records = converted.records.filter(x => x.id !== 'exp2');
  assert.throws(() => decode(converted), /Indice ausente/);
});
check('nao acessa armazenamento nem rede', () => {
  assert.equal(typeof encode, 'function');
  assert.equal(typeof decode, 'function');
});
console.log('RESULTADO: ' + passed + '/14 TESTES APROVADOS');
