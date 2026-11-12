'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { initializeTestEnvironment } = require('@firebase/rules-unit-testing');
const { createLocalRepository, DEFAULT_KEY } = require('../../js/services/localRepository.js');
const { createQueue, LAB_KEY } = require('../../js/services/operationQueueLab.js');
const { drainOne } = require('../../js/services/firestoreSyncLab.js');
const { normalizeSnapshot } = require('../../js/services/preMigrationLab.js');
const { encode, decode } = require('../../js/services/financeConverterLab.js');
const { migrate, audit, inspect, entries, ref } = require('../../js/services/monthMigrationLab.js');
const rules = fs.readFileSync(path.join(__dirname, '../emulator-month-migration/firestore.rules'), 'utf8');
const sample = {
  selectedMonth: '2026-11',
  months: {
    '2026-10': {
      salary: 6000, budgetLimit: 4200, closed: true,
      closedAt: '2026-11-01T12:00:00Z',
      deletedInstallmentOrigins: ['origin:3'],
      expenses: [{ id: 'fixed1', title: 'Internet', amount: 110.35, type: 'fixed', paid: true }],
      cardExpenses: [{ id: 'card1', title: 'Notebook', installmentValue: 333.33,
        totalAmount: 1999.98, isInstallment: true, installments: 6,
        currentInstallment: 2, installmentOriginId: 'origin', paid: false }],
      extraIncomes: [{ id: 'extra1', description: 'Extra', amount: 250.5 }]
    },
    '2026-11': {
      salary: 6100, budgetLimit: 4300, closed: false, closedAt: null,
      deletedInstallmentOrigins: [], expenses: [
        { title: 'Mercado', amount: 25.25, type: 'one-time', paid: false }
      ], cardExpenses: [], extraIncomes: []
    }
  }
};
function memoryStorage() {
  const data = new Map([
    [DEFAULT_KEY, JSON.stringify(sample)],
    ['gemini_user_api_key', 'chave-ficticia'],
    ['controle_gastos_pin_lock', 'pin-ficticio']
  ]);
  return {
    data,
    getItem(k) { return data.has(k) ? data.get(k) : null; },
    setItem(k, v) { data.set(k, String(v)); }
  };
}
let passed = 0;
async function check(name, fn) { await fn(); passed++; console.log('APROVADO:', name); }
async function main() {
  const env = await initializeTestEnvironment({
    projectId: 'demo-raytech-cg-audit',
    firestore: { host: '127.0.0.1', port: 8084, rules }
  });
  try {
    await env.clearFirestore();
    const a = env.authenticatedContext('usuarioA').firestore();
    const b = env.authenticatedContext('usuarioB').firestore();
    const storage = memoryStorage();
    const originalBytes = storage.getItem(DEFAULT_KEY);
    const repo = createLocalRepository(storage);
    const plan = normalizeSnapshot(repo.exportSnapshot(), 'audit-v1');

    await check('adaptador local e conversor compativeis', async () => {
      assert.deepEqual(decode(encode(plan.snapshot)), plan.snapshot);
      assert.equal(repo.listMonths().length, 2);
    });
    await check('normalizacao de IDs nao altera armazenamento', async () => {
      assert.equal(storage.getItem(DEFAULT_KEY), originalBytes);
      assert.equal(plan.assigned.length, 1);
    });
    await check('falha de migracao parcial preserva banco local', async () => {
      const s = await migrate(plan, a, 'usuarioA', 2);
      assert.equal(s.status, 'partial');
      assert.equal(storage.getItem(DEFAULT_KEY), originalBytes);
      await assert.rejects(audit(plan, a, 'usuarioA'));
    });
    await check('retomada e auditoria de reconstrucao integral', async () => {
      const s = await migrate(normalizeSnapshot(repo.readSnapshot(), 'audit-v1'), a, 'usuarioA', 30);
      assert.equal(s.status, 'complete');
      assert.deepEqual((await audit(plan, a, 'usuarioA')).snapshot, plan.snapshot);
    });
    await check('reenvio e idempotente e armazenamento permanece intacto', async () => {
      assert.equal((await migrate(plan, a, 'usuarioA', 30)).written, 0);
      assert.equal(storage.getItem(DEFAULT_KEY), originalBytes);
    });
    await check('divergencia de salario impede sobrescrita', async () => {
      const changed = structuredClone(sample);
      changed.months['2026-10'].salary = 9000;
      const result = await migrate(normalizeSnapshot(changed, 'audit-v1'), a, 'usuarioA', 30);
      assert.equal(result.status, 'conflict');
      assert.equal(result.written, 0);
    });
    await check('divergencia de exclusao de parcela impede sobrescrita', async () => {
      const changed = structuredClone(sample);
      changed.months['2026-10'].deletedInstallmentOrigins = [];
      const result = await migrate(normalizeSnapshot(changed, 'audit-v1'), a, 'usuarioA', 30);
      assert.equal(result.status, 'conflict');
      assert.equal(result.written, 0);
    });
    await check('dispositivo B nao consegue ler dados de A', async () => {
      const month = entries(plan).find(x => x.kind === 'month');
      await assert.rejects(ref(b, 'usuarioA', month).get(),
        e => e.code === 'permission-denied');
    });
    await check('fila isolada nao modifica dados financeiros ou credenciais', async () => {
      const q = createQueue(storage, { idFactory: () => 'audit_op_1' });
      q.create('2026-11', 'expense', 'lab_1', { title: 'Laboratorio', amountCents: 2525 });
      const outcome = await drainOne(q, { send: async () => { throw new Error('Offline'); } });
      assert.equal(outcome.status, 'pending');
      assert.equal(q.pending().length, 1);
      assert.equal(storage.getItem(DEFAULT_KEY), originalBytes);
      assert.equal(storage.getItem('gemini_user_api_key'), 'chave-ficticia');
      assert.equal(storage.getItem('controle_gastos_pin_lock'), 'pin-ficticio');
      assert.ok(storage.getItem(LAB_KEY));
    });
    await check('fila e esquema financeiro possuem contratos distintos (risco identificado)', async () => {
      const q = createQueue(memoryStorage(), { idFactory: () => 'audit_contract_1' });
      assert.throws(() => q.create('2026-11', 'expenses', 'fixed1',
        { title: 'Internet', amount: 110.35 }), /Identidade/);
      assert.throws(() => q.create('2026-11', 'expense', 'fixed1',
        { title: 'Internet', amount: 110.35 }), /Dados invalidos/);
    });
    await check('mes selecionado esta no manifesto remoto (risco identificado)', async () => {
      const manifest = entries(plan).find(x => x.kind === 'manifest');
      const snap = await ref(a, 'usuarioA', manifest).get();
      assert.equal(snap.data().selectedMonth, '2026-11');
    });
    await check('manifesto parcial nao representa migracao completa', async () => {
      const fresh = normalizeSnapshot({
        selectedMonth: '2026-12',
        months: { '2026-12': {
          salary: 100, expenses: [], cardExpenses: [], extraIncomes: []
        } }
      }, 'partial');
      assert.equal((await migrate(fresh, b, 'usuarioB', 1)).status, 'partial');
      await assert.rejects(audit(fresh, b, 'usuarioB'));
    });
    await check('recuperacao nunca executa substituicao local implicita', async () => {
      assert.throws(() => repo.replaceLocalSnapshot(plan.snapshot), /confirmacao/);
      assert.equal(storage.getItem(DEFAULT_KEY), originalBytes);
    });
    await check('isolamento entre usuarios e migracao independente', async () => {
      assert.equal((await inspect(plan, b, 'usuarioB')).present, 0);
      assert.equal((await migrate(plan, b, 'usuarioB', 30)).status, 'complete');
      assert.deepEqual((await audit(plan, b, 'usuarioB')).snapshot, plan.snapshot);
    });
    await check('integridade final de dados locais e segredos', async () => {
      assert.equal(storage.getItem(DEFAULT_KEY), originalBytes);
      assert.equal(storage.getItem('gemini_user_api_key'), 'chave-ficticia');
      assert.equal(storage.getItem('controle_gastos_pin_lock'), 'pin-ficticio');
    });
    console.log('RESULTADO: ' + passed + '/15 TESTES APROVADOS');
    console.log('AUDITORIA: 3 riscos documentados; nao autoriza sincronizacao real.');
  } finally {
    await env.cleanup();
  }
}
main().catch(err => { console.error('FALHA:', err); process.exitCode = 1; });
