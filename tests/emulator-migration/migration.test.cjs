'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { initializeTestEnvironment } = require('@firebase/rules-unit-testing');
const { normalizeSnapshot, report } = require('../../js/services/preMigrationLab.js');
const { inspect, step, refFor, stored } = require('../../js/services/firestoreMigrationLab.js');
const rules = fs.readFileSync(path.join(__dirname, 'firestore.rules'), 'utf8');
const source = {
  selectedMonth: '2026-11',
  months: {
    '2026-10': {
      salary: 4200, budgetLimit: 3600, closed: true, closedAt: '2026-11-01',
      deletedInstallmentOrigins: ['origem:2'],
      expenses: [{ title: 'Conta ficticia', amount: 100.25, type: 'fixed', paid: true }],
      cardExpenses: [{ id: 'card_1', title: 'Compra ficticia', installmentValue: 50.5,
        totalAmount: 151.5, installments: 3, currentInstallment: 1,
        isInstallment: true, installmentOriginId: 'origem' }],
      extraIncomes: [{ description: 'Extra ficticio', amount: 75.75 }]
    },
    '2026-11': {
      salary: 4500, expenses: [{ id: 'exp_2', title: 'Mercado ficticio', amount: 25 }],
      cardExpenses: [], extraIncomes: [], deletedInstallmentOrigins: [],
      closed: false, closedAt: null
    }
  }
};
let passed = 0;
async function check(name, fn) { await fn(); passed++; console.log('APROVADO:', name); }
async function main() {
  const env = await initializeTestEnvironment({
    projectId: 'demo-raytech-cg-migration',
    firestore: { host: '127.0.0.1', port: 8083, rules }
  });
  try {
    await env.clearFirestore();
    const a = env.authenticatedContext('usuarioA').firestore();
    const b = env.authenticatedContext('usuarioB').firestore();
    const original = structuredClone(source);
    const plan = normalizeSnapshot(source, 'migration-demo');
    const records = plan.envelope.records;
    await check('origem ficticia preservada', async () => assert.deepEqual(source, original));
    await check('normalizacao deterministica e relatorio', async () => {
      assert.equal(normalizeSnapshot(source, 'migration-demo').checksum, plan.checksum);
      assert.equal(report(plan).totalRecords, 4);
    });
    await check('destino remoto vazio', async () => {
      assert.deepEqual(await inspect(plan, a, 'usuarioA'),
        { conflicts: [], alreadyPresent: 0, missing: 4 });
    });
    await check('primeira etapa grava somente dois registros', async () => {
      const result = await step(plan, a, 'usuarioA', 2);
      assert.equal(result.status, 'partial');
      assert.equal(result.written, 2);
    });
    await check('interrupcao e retomada concluem sem duplicar', async () => {
      const resumed = normalizeSnapshot(source, 'migration-demo');
      const result = await step(resumed, a, 'usuarioA', 10);
      assert.equal(result.status, 'complete');
      assert.equal(result.written, 2);
    });
    await check('reenvio completo e idempotente', async () => {
      const result = await step(plan, a, 'usuarioA', 10);
      assert.equal(result.written, 0);
      assert.equal(result.alreadyPresent, 4);
    });
    await check('integridade dos quatro documentos remotos', async () => {
      for (const rec of records) {
        const snap = await refFor(a, 'usuarioA', rec).get();
        assert.equal(snap.exists, true);
        assert.deepEqual(snap.data(), stored(rec));
      }
    });
    await check('usuario B nao pode ler dados do usuario A', async () => {
      await assert.rejects(refFor(b, 'usuarioA', records[0]).get(),
        e => e.code === 'permission-denied');
    });
    await check('usuario B nao pode gravar dados do usuario A', async () => {
      await assert.rejects(refFor(b, 'usuarioA', records[0]).set(stored(records[0])),
        e => e.code === 'permission-denied');
    });
    await check('usuario B possui espaco independente', async () => {
      const result = await step(plan, b, 'usuarioB', 10);
      assert.equal(result.status, 'complete');
      assert.equal(result.written, 4);
    });
    await check('documentos migrados nao podem ser alterados', async () => {
      await assert.rejects(refFor(a, 'usuarioA', records[0]).update({ value: { amount: 999 } }),
        e => e.code === 'permission-denied');
    });
    await check('documentos migrados nao podem ser excluidos', async () => {
      await assert.rejects(refFor(a, 'usuarioA', records[0]).delete(),
        e => e.code === 'permission-denied');
    });
    await check('conflito remoto bloqueia migracao do plano modificado', async () => {
      const changed = structuredClone(source);
      changed.months['2026-11'].expenses[0].amount = 999;
      const alteredPlan = normalizeSnapshot(changed, 'migration-demo');
      const result = await step(alteredPlan, a, 'usuarioA', 10);
      assert.equal(result.status, 'conflict');
      assert.equal(result.written, 0);
      assert.equal(result.conflicts.length, 1);
    });
    await check('concorrencia entre duas migracoes nao duplica documentos', async () => {
      const racePlan = normalizeSnapshot({
        selectedMonth: '2026-12',
        months: { '2026-12': { expenses: [{ id: 'race_1', title: 'Teste', amount: 1 }],
          cardExpenses: [], extraIncomes: [] } }
      });
      const results = await Promise.allSettled([
        step(racePlan, a, 'usuarioA', 1),
        step(racePlan, a, 'usuarioA', 1)
      ]);
      const succeeded = results.filter(x => x.status === 'fulfilled');
      assert.ok(succeeded.length >= 1);
      assert.equal((await inspect(racePlan, a, 'usuarioA')).alreadyPresent, 1);
      assert.equal(succeeded.reduce((n, x) => n + x.value.written, 0) <= 1, true);
    });
    await check('falha de rede simulada nao altera dados ja gravados', async () => {
      const fresh = normalizeSnapshot({ selectedMonth: '2026-12',
        months: { '2026-12': { expenses: [{ id: 'offline_1', title: 'Teste', amount: 10 }],
          cardExpenses: [], extraIncomes: [] } } });
      const before = await inspect(fresh, a, 'usuarioA');
      const offline = { runTransaction: async () => { throw new Error('Sem rede'); },
        doc: (...args) => a.doc(...args) };
      await assert.rejects(step(fresh, offline, 'usuarioA', 1), /Sem rede/);
      assert.deepEqual(await inspect(fresh, a, 'usuarioA'), before);
    });
    console.log('RESULTADO: ' + passed + '/15 TESTES APROVADOS');
  } finally { await env.cleanup(); }
}
main().catch(error => { console.error('FALHA:', error); process.exitCode = 1; });
