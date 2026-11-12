'use strict';

const assert = require('node:assert/strict');
const { test } = require('node:test');

const {
  syntheticHistory,
  fingerprint
} = require('../../js/services/financeIntegrityE2ELab.js');

const {
  migrate, verify, createSession, balances
} = require('../../js/services/reversibleFinanceMigrationLab.js');

const {
  createBackup, verifyBackup
} = require('../../js/services/backupRecoveryLab.js');

const {
  memoryDisk, open
} = require('../../js/services/installmentPersistenceRecoveryLab.js');

const clone = value => JSON.parse(JSON.stringify(value));

function installmentState() {
  return {
    selectedMonth: '2026-10',
    months: {
      '2026-10': {
        cardExpenses: [{
          id: 'card1',
          title: 'Notebook',
          isInstallment: true,
          installmentOriginId: 'notebook',
          currentInstallment: 1,
          installments: 3,
          installmentValue: 100
        }]
      }
    },
    deletions: {}
  };
}

test('I12-01: migracao e backup preservam historico', () => {
  const original = syntheticHistory();
  const plan = migrate(original);

  verify(plan);

  const session = createSession(original);
  session.apply(plan, 0);

  const recovered = verifyBackup(createBackup(session.read()));

  assert.deepStrictEqual(
    fingerprint(recovered),
    fingerprint(original)
  );
  assert.deepStrictEqual(
    balances(recovered),
    balances(original)
  );
});

test('I12-02: rollback preserva historico original', () => {
  const original = syntheticHistory();
  const before = clone(original);
  const plan = migrate(original);
  const session = createSession(original);

  session.apply(plan, 0);
  session.rollback(plan, 1);

  assert.deepStrictEqual(session.read(), before);
  assert.deepStrictEqual(original, before);
  assert.equal(session.revision(), 2);
});

test('I12-03: exclusao persiste apos reabertura', () => {
  const disk = memoryDisk(installmentState());
  const session = open(disk);

  session.mark('2026-11', 'notebook', 2);
  session.recreate('2026-11', '2026-10');

  const reopened = open(disk);
  const state = reopened.read();

  assert.deepStrictEqual(
    state.deletions['2026-11'],
    ['notebook:2']
  );
  assert.deepStrictEqual(
    state.months['2026-11'].cardExpenses,
    []
  );
});

test('I12-04: backup e restauracao preservam exclusoes', () => {
  const disk = memoryDisk(installmentState());
  const session = open(disk);

  session.mark('2026-11', 'notebook', 2);

  const expected = session.read();
  const backup = session.backup();

  const restoredDisk = memoryDisk(installmentState());
  const restored = open(restoredDisk);

  restored.restore(backup, {
    expectedRevision: 0
  });

  assert.deepStrictEqual(
    open(restoredDisk).read(),
    expected
  );
});

test('I12-05: falha de gravacao preserva estado', () => {
  const disk = memoryDisk(installmentState());
  const session = open(disk);

  const before = session.read();
  const revision = session.revision();

  assert.throws(
    () => session.mark(
      '2026-11',
      'notebook',
      2,
      { failure: 'partial' }
    ),
    error => error.code === 'write_failed'
  );

  assert.deepStrictEqual(session.read(), before);
  assert.deepStrictEqual(open(disk).read(), before);
  assert.equal(open(disk).revision(), revision);
});

test('I12-06: sessao antiga nao sobrescreve revisao', () => {
  const disk = memoryDisk(installmentState());

  const first = open(disk);
  const stale = open(disk);

  first.mark('2026-11', 'notebook', 2);

  const committed = open(disk).read();

  assert.throws(
    () => stale.mark('2026-12', 'notebook', 3),
    error => error.code === 'revision_conflict'
  );

  assert.deepStrictEqual(open(disk).read(), committed);
  assert.equal(open(disk).revision(), 1);
});

test('I12-07: backup adulterado nao altera estado', () => {
  const disk = memoryDisk(installmentState());
  const session = open(disk);

  const backup = session.backup();
  backup.payload.months['2026-10']
    .cardExpenses[0].installmentValue = 999;

  const before = session.read();

  assert.throws(
    () => session.restore(backup, {
      expectedRevision: session.revision()
    }),
    error => error.code === 'invalid_backup'
  );

  assert.deepStrictEqual(open(disk).read(), before);
  assert.equal(open(disk).revision(), 0);
});

test('I12-08: restauracao antiga nao apaga exclusoes', () => {
  const disk = memoryDisk(installmentState());
  const session = open(disk);

  const oldBackup = session.backup();

  session.mark('2026-11', 'notebook', 2);

  const before = session.read();
  const revision = session.revision();

  assert.throws(
    () => session.restore(oldBackup, {
      expectedRevision: revision
    }),
    error =>
      error.code === 'deletion_rollback_requires_approval'
  );

  assert.deepStrictEqual(open(disk).read(), before);
  assert.equal(open(disk).revision(), revision);
});
