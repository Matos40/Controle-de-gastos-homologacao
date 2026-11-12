'use strict';

const assert = require('node:assert/strict');
const {
  memoryDisk,
  open
} = require('../../js/services/installmentPersistenceRecoveryLab.js');

const initial = () => ({
  selectedMonth: '2026-10',
  months: {
    '2026-10': {
      cardExpenses: [{
        id: 'synthetic-1',
        title: 'Notebook Teste',
        isInstallment: true,
        installmentOriginId: 'synthetic-origin',
        currentInstallment: 1,
        installments: 3,
        installmentValue: 100,
        paid: true
      }]
    }
  },
  deletions: {}
});

let passed = 0;

function test(name, fn) {
  fn();
  passed++;
  console.log('APROVADO:', name);
}

function expectError(fn, code) {
  assert.throws(fn, error => error.code === code);
}

test('falha antes do commit preserva estado', () => {
  const disk = memoryDisk(initial());
  const session = open(disk);
  const before = disk.read();

  expectError(() =>
    session.mark('2026-11', 'synthetic-origin', 2,
      { failure: 'before' }), 'write_failed');

  assert.deepEqual(disk.read(), before);
});

test('falha parcial preserva estado apos reinicio', () => {
  const disk = memoryDisk(initial());
  const session = open(disk);
  const before = disk.read();

  expectError(() =>
    session.mark('2026-11', 'synthetic-origin', 2,
      { failure: 'partial' }), 'write_failed');

  assert.deepEqual(disk.read(), before);
  assert.deepEqual(open(disk).read(), initial());
});

test('duas sessoes nao sobrescrevem revisao', () => {
  const disk = memoryDisk(initial());
  const a = open(disk);
  const b = open(disk);

  a.mark('2026-11', 'synthetic-origin', 2);

  expectError(() =>
    b.mark('2026-12', 'synthetic-origin', 3),
    'revision_conflict');

  assert.equal(open(disk).revision(), 1);
});

test('sessao recuperada permite nova operacao', () => {
  const disk = memoryDisk(initial());
  const a = open(disk);
  const stale = open(disk);

  a.mark('2026-11', 'synthetic-origin', 2);

  expectError(() =>
    stale.mark('2026-12', 'synthetic-origin', 3),
    'revision_conflict');

  const recovered = open(disk);
  recovered.mark('2026-12', 'synthetic-origin', 3);

  assert.equal(open(disk).revision(), 2);
});

test('operacao repetida nao duplica marcador', () => {
  const disk = memoryDisk(initial());
  const session = open(disk);

  session.mark('2026-11', 'synthetic-origin', 2);
  const revision = session.revision();

  const result = session.mark(
    '2026-11', 'synthetic-origin', 2
  );

  assert.equal(result.changed, false);
  assert.equal(session.revision(), revision);
  assert.equal(
    session.read().deletions['2026-11'].length, 1
  );
});

test('marcadores persistem apos falha e recuperacao', () => {
  const disk = memoryDisk(initial());
  const session = open(disk);

  session.mark('2026-11', 'synthetic-origin', 2);

  expectError(() =>
    session.mark('2026-12', 'synthetic-origin', 3,
      { failure: 'after_prepare' }), 'write_failed');

  const recovered = open(disk);

  assert.deepEqual(
    recovered.read().deletions['2026-11'],
    ['synthetic-origin:2']
  );

  assert.equal(
    recovered.read().deletions['2026-12'],
    undefined
  );

  assert.equal(recovered.revision(), 1);
});

console.log(
  'RESULTADO: ' + passed + '/6 TESTES APROVADOS'
);
