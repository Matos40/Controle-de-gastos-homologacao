'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { initializeTestEnvironment } = require('@firebase/rules-unit-testing');
const { normalizeSnapshot } = require('../../js/services/preMigrationLab.js');
const { entries, inspect, migrate, audit, ref } = require('../../js/services/monthMigrationLab.js');
const rules = fs.readFileSync(path.join(__dirname, 'firestore.rules'), 'utf8');
const source = {
  selectedMonth: '2026-11', interfacePreference: { compact: true },
  months: {
    '2026-10': {
      salary: 5000.75, budgetLimit: 4300, closed: true,
      closedAt: '2026-11-01T10:00:00.000Z',
      deletedInstallmentOrigins: ['origin:2'],
      expenses: [{ id: 'exp1', title: 'Internet', amount: 100, type: 'fixed' }],
      cardExpenses: [{ id: 'card1', title: 'Notebook', installmentValue: 250.5,
        totalAmount: 1503, isInstallment: true, installments: 6,
        currentInstallment: 2, installmentOriginId: 'origin' }],
      extraIncomes: [{ description: 'Extra', amount: 200.25 }]
    },
    '2026-11': {
      salary: 5200, budgetLimit: 4400, closed: false, closedAt: null,
      deletedInstallmentOrigins: [], expenses: [], cardExpenses: [], extraIncomes: []
    }
  }
};
let passed = 0;
async function check(label, fn) { await fn(); passed++; console.log('APROVADO:', label); }
async function main() {
  const env = await initializeTestEnvironment({
    projectId: 'demo-raytech-cg-months',
    firestore: { host: '127.0.0.1', port: 8084, rules }
  });
  try {
    await env.clearFirestore();
    const a = env.authenticatedContext('usuarioA').firestore();
    const b = env.authenticatedContext('usuarioB').firestore();
    const original = structuredClone(source);
    const plan = normalizeSnapshot(source, 'month-demo');
    await check('dados ficticios originais preservados', async () =>
      assert.deepEqual(source, original));
    await check('plano inclui manifesto, meses e registros', async () => {
      assert.equal(entries(plan).length, 1 + 2 + 3);
    });
    await check('destino inicialmente vazio', async () => {
      const s = await inspect(plan, a, 'usuarioA');
      assert.equal(s.missing, 6);
    });
    await check('migracao interrompida apos dois documentos', async () => {
      const s = await migrate(plan, a, 'usuarioA', 2);
      assert.equal(s.status, 'partial');
      assert.equal(s.written, 2);
    });
    await check('retomada finaliza documentos sem duplicar', async () => {
      const s = await migrate(normalizeSnapshot(source, 'month-demo'), a, 'usuarioA', 20);
      assert.equal(s.status, 'complete');
      assert.equal(s.written, 4);
    });
    await check('reenvio nao grava duplicatas', async () => {
      const s = await migrate(plan, a, 'usuarioA', 20);
      assert.equal(s.written, 0);
      assert.equal(s.present, 6);
    });
    await check('auditoria reconstrui banco integral', async () => {
      const s = await audit(plan, a, 'usuarioA');
      assert.equal(s.verified, true);
      assert.deepEqual(s.snapshot, plan.snapshot);
      assert.equal(s.records, 3);
    });
    await check('salario, orcamento, fechamento e exclusoes preservados', async () => {
      const s = await audit(plan, a, 'usuarioA');
      const m = s.snapshot.months['2026-10'];
      assert.equal(m.salary, 5000.75);
      assert.equal(m.budgetLimit, 4300);
      assert.equal(m.closed, true);
      assert.equal(m.closedAt, '2026-11-01T10:00:00.000Z');
      assert.deepEqual(m.deletedInstallmentOrigins, ['origin:2']);
    });
    await check('outro usuario nao le metadados', async () => {
      const entry = entries(plan).find(x => x.kind === 'month');
      await assert.rejects(ref(b, 'usuarioA', entry).get(), e => e.code === 'permission-denied');
    });
    await check('outro usuario nao grava metadados', async () => {
      const entry = entries(plan).find(x => x.kind === 'month');
      await assert.rejects(ref(b, 'usuarioA', entry).set(entry.value),
        e => e.code === 'permission-denied');
    });
    await check('usuario B possui migracao independente', async () => {
      const s = await migrate(plan, b, 'usuarioB', 20);
      assert.equal(s.status, 'complete');
      assert.equal((await audit(plan, b, 'usuarioB')).verified, true);
    });
    await check('metadados existentes nao podem ser sobrescritos', async () => {
      const entry = entries(plan).find(x => x.kind === 'month');
      await assert.rejects(ref(a, 'usuarioA', entry).update({ salary: 999 }),
        e => e.code === 'permission-denied');
    });
    await check('versao de esquema diferente de 1 e rejeitada', async () => {
      const entry = entries(plan).find(x => x.kind === 'month');
      const freshRef = a.doc('users/usuarioA/monthMigrationMonths/2026-12');
      await assert.rejects(freshRef.set({ ...entry.value, ym: '2026-12', version: 2 }),
        e => e.code === 'permission-denied');
    });
    await check('exclusao de metadados e bloqueada', async () => {
      const entry = entries(plan).find(x => x.kind === 'month');
      await assert.rejects(ref(a, 'usuarioA', entry).delete(),
        e => e.code === 'permission-denied');
    });
    await check('conflito de salario bloqueia nova migracao', async () => {
      const changed = structuredClone(source);
      changed.months['2026-10'].salary = 999;
      const revised = normalizeSnapshot(changed, 'month-demo');
      const s = await migrate(revised, a, 'usuarioA', 20);
      assert.equal(s.status, 'conflict');
      assert.equal(s.written, 0);
      assert.ok(s.conflicts.some(x => x.kind === 'month'));
    });
    await check('conflito de fechamento bloqueia nova migracao', async () => {
      const changed = structuredClone(source);
      changed.months['2026-10'].closed = false;
      const s = await migrate(normalizeSnapshot(changed, 'month-demo'), a, 'usuarioA', 20);
      assert.equal(s.status, 'conflict');
      assert.equal(s.written, 0);
    });
    await check('dois dispositivos concorrentes nao duplicam metadados', async () => {
      const fresh = normalizeSnapshot({
        selectedMonth: '2026-12', months: { '2026-12': {
          salary: 100, budgetLimit: 50, expenses: [], cardExpenses: [], extraIncomes: []
        } }
      }, 'race');
      const results = await Promise.allSettled([
        migrate(fresh, a, 'usuarioA', 10),
        migrate(fresh, a, 'usuarioA', 10)
      ]);
      assert.ok(results.some(x => x.status === 'fulfilled'));
      const s = await inspect(fresh, a, 'usuarioA');
      assert.equal(s.missing, 0);
      assert.equal(s.conflicts.length, 0);
    });
    await check('auditoria rejeita plano adulterado', async () => {
      const changed = structuredClone(source);
      changed.months['2026-10'].expenses[0].amount = 999;
      const revised = normalizeSnapshot(changed, 'month-demo');
      await assert.rejects(audit(revised, a, 'usuarioA'));
    });
    console.log('RESULTADO: ' + passed + '/18 TESTES APROVADOS');
  } finally { await env.cleanup(); }
}
main().catch(err => { console.error('FALHA:', err); process.exitCode = 1; });
