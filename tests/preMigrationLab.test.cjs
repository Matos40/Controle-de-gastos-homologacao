'use strict';
const assert = require('node:assert/strict');
const { normalizeSnapshot, report, preflight, migrateStep, createMemoryDestination, recordKey } =
  require('../js/services/preMigrationLab.js');
const { decode } = require('../js/services/financeConverterLab.js');
let count = 0;
function check(label, fn) { fn(); count++; console.log('APROVADO:', label); }
const source = {
  selectedMonth: '2026-11',
  months: {
    '2026-11': {
      salary: 5500, budgetLimit: 4000, closed: false,
      deletedInstallmentOrigins: ['origem:3'],
      expenses: [
        { title: 'Aluguel', amount: 1400, type: 'fixed', paid: false },
        { id: 'exp_existente', title: 'Cafe', amount: 20, type: 'one-time' }
      ],
      cardExpenses: [{ title: 'Notebook', installmentValue: 250, totalAmount: 1500,
        isInstallment: true, installments: 6, currentInstallment: 2, installmentOriginId: 'origem' }],
      extraIncomes: [{ description: 'Extra', amount: 300.45 }]
    }
  }
};
const original = structuredClone(source);
const plan = normalizeSnapshot(source);
check('origem permanece intacta', () => assert.deepEqual(source, original));
check('IDs ausentes sao criados apenas na copia', () => {
  assert.equal(plan.assigned.length, 3);
  assert.equal(source.months['2026-11'].expenses[0].id, undefined);
});
check('ID existente e preservado', () => {
  assert.equal(plan.snapshot.months['2026-11'].expenses[1].id, 'exp_existente');
});
check('normalizacao repetida gera IDs estaveis', () => {
  const other = normalizeSnapshot(source);
  assert.deepEqual(other.assigned, plan.assigned);
  assert.equal(other.checksum, plan.checksum);
});
check('reconstrucao integral apos normalizacao', () => {
  assert.deepEqual(decode(plan.envelope), plan.snapshot);
});
check('relatorio de contagens e checksum', () => {
  const result = report(plan);
  assert.equal(result.months, 1);
  assert.equal(result.totalRecords, 4);
  assert.equal(result.generatedIds, 3);
  assert.equal(result.counts.cardExpenses, 1);
  assert.match(result.checksum, /^[a-f0-9]{64}$/);
});
check('destino inicialmente vazio', () => {
  const remote = createMemoryDestination();
  assert.deepEqual(preflight(plan, remote), { conflicts: [], alreadyPresent: 0, missing: 4 });
});
check('migracao parcial escreve apenas limite', () => {
  const remote = createMemoryDestination();
  const result = migrateStep(plan, remote, 2);
  assert.equal(result.status, 'partial');
  assert.equal(result.written, 2);
  assert.equal(remote.count(), 2);
});
check('retomada nao duplica registros', () => {
  const remote = createMemoryDestination();
  migrateStep(plan, remote, 2);
  const result = migrateStep(plan, remote, 10);
  assert.equal(result.status, 'complete');
  assert.equal(remote.count(), 4);
  assert.equal(migrateStep(plan, remote, 10).written, 0);
});
check('conteudo remoto igual e reconhecido', () => {
  const remote = createMemoryDestination();
  migrateStep(plan, remote, 10);
  assert.equal(preflight(plan, remote).alreadyPresent, 4);
});
check('conflito remoto bloqueia qualquer gravacao', () => {
  const remote = createMemoryDestination();
  const rec = plan.envelope.records[0];
  remote.put(recordKey(rec), { ...rec.value, amount: 9999 });
  const result = migrateStep(plan, remote, 10);
  assert.equal(result.status, 'conflict');
  assert.equal(result.written, 0);
  assert.equal(remote.count(), 1);
});
check('colisao de ID existente e bloqueada', () => {
  const broken = structuredClone(source);
  broken.months['2026-11'].expenses[0].id = 'exp_existente';
  assert.throws(() => normalizeSnapshot(broken), /duplicado/);
});
check('ID legado invalido nao e substituido silenciosamente', () => {
  const broken = structuredClone(source);
  broken.months['2026-11'].expenses[0].id = 'a/b';
  assert.throws(() => normalizeSnapshot(broken), /revisao manual/);
});
check('limite invalido nao modifica destino', () => {
  const remote = createMemoryDestination();
  assert.throws(() => migrateStep(plan, remote, 0), /Limite invalido/);
  assert.equal(remote.count(), 0);
});
check('namespace altera IDs gerados sem alterar origem', () => {
  const alternate = normalizeSnapshot(source, 'outro-lab');
  assert.notEqual(alternate.assigned[0].id, plan.assigned[0].id);
  assert.deepEqual(source, original);
});
check('dados mensais e parcelas excluidas preservados', () => {
  assert.deepEqual(plan.snapshot.months['2026-11'].deletedInstallmentOrigins, ['origem:3']);
  assert.equal(plan.snapshot.months['2026-11'].salary, 5500);
});
console.log('RESULTADO: ' + count + '/16 TESTES APROVADOS');
