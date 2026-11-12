'use strict';

const assert = require('node:assert/strict');

const {syntheticHistory, fingerprint} =
  require('../../js/services/financeIntegrityE2ELab.js');

const {audit} =
  require('../../js/services/deepFinanceContractI08Lab.js');

const {migrate, createSession, balances} =
  require('../../js/services/reversibleFinanceMigrationLab.js');

const {createBackup, verifyBackup} =
  require('../../js/services/backupRecoveryLab.js');

const {memoryDisk, open} =
  require('../../js/services/installmentPersistenceRecoveryLab.js');

const clone = x => JSON.parse(JSON.stringify(x));

const persistenceState = () => ({
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

function error(fn, code) {
  assert.throws(fn, e => e.code === code);
}

test('falhas consecutivas preservam estado', () => {
  const disk = memoryDisk(persistenceState());
  const session = open(disk);
  const before = disk.read();

  for (const failure of ['before', 'partial', 'after_prepare']) {
    error(() => session.mark(
      '2026-11', 'synthetic-origin', 2, {failure}
    ), 'write_failed');

    assert.deepStrictEqual(disk.read(), before);
  }

  assert.deepStrictEqual(open(disk).read(), persistenceState());
});

test('revisao confirmada sobrevive a falha posterior', () => {
  const disk = memoryDisk(persistenceState());
  const session = open(disk);

  session.mark('2026-11', 'synthetic-origin', 2);

  error(() => session.mark(
    '2026-12', 'synthetic-origin', 3,
    {failure: 'partial'}
  ), 'write_failed');

  const recovered = open(disk);

  assert.equal(recovered.revision(), 1);
  assert.deepStrictEqual(
    recovered.read().deletions['2026-11'],
    ['synthetic-origin:2']
  );
  assert.equal(
    recovered.read().deletions['2026-12'],
    undefined
  );
});

test('reexecucao apos falha e idempotente', () => {
  const disk = memoryDisk(persistenceState());
  const session = open(disk);

  error(() => session.mark(
    '2026-11', 'synthetic-origin', 2,
    {failure: 'before'}
  ), 'write_failed');

  const recovered = open(disk);
  const first = recovered.mark(
    '2026-11', 'synthetic-origin', 2
  );
  const second = recovered.mark(
    '2026-11', 'synthetic-origin', 2
  );

  assert.equal(first.changed, true);
  assert.equal(second.changed, false);
  assert.equal(recovered.revision(), 1);
});

test('conflito exige recuperacao de sessao', () => {
  const disk = memoryDisk(persistenceState());
  const a = open(disk);
  const stale = open(disk);

  a.mark('2026-11', 'synthetic-origin', 2);

  error(() => stale.mark(
    '2026-12', 'synthetic-origin', 3
  ), 'revision_conflict');

  const recovered = open(disk);
  recovered.mark('2026-12', 'synthetic-origin', 3);

  assert.equal(open(disk).revision(), 2);
  assert.equal(
    open(disk).read().deletions['2026-11'].length, 1
  );
  assert.equal(
    open(disk).read().deletions['2026-12'].length, 1
  );
});

test('backup preserva integridade apos falhas', () => {
  const disk = memoryDisk(persistenceState());
  const session = open(disk);

  session.mark('2026-11', 'synthetic-origin', 2);

  error(() => session.mark(
    '2026-12', 'synthetic-origin', 3,
    {failure: 'after_prepare'}
  ), 'write_failed');

  const recovered = open(disk);
  const backup = createBackup(recovered.read());

  assert.deepStrictEqual(
    verifyBackup(backup), recovered.read()
  );

  const tampered = clone(backup);
  tampered.payload.selectedMonth = '2026-11';

  error(() => verifyBackup(tampered), 'checksum_mismatch');
});

test('migracao e rollback preservam saldos', () => {
  const original = syntheticHistory();
  const originalCopy = clone(original);
  const before = balances(original);
  const identity = fingerprint(original);

  assert.equal(audit(original).status, 'VALID_IN_LAB');

  const plan = migrate(original);
  const session = createSession(original);

  session.apply(plan, 0);
  assert.deepStrictEqual(balances(session.read()), before);

  session.rollback(plan, 1);

  assert.deepStrictEqual(session.read(), originalCopy);
  assert.deepStrictEqual(balances(session.read()), before);
  assert.deepStrictEqual(
    fingerprint(session.read()), identity
  );
  assert.equal(audit(session.read()).status, 'VALID_IN_LAB');
});

console.log(
  'RESULTADO: ' + passed + '/6 TESTES APROVADOS'
);
