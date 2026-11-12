'use strict';
/* Raytech CG - pre-migracao SOMENTE de laboratorio (Node.js).
 * Nenhuma leitura de localStorage, Firestore ou credenciais.
 * O destino e um adaptador em memoria injetado pelo teste.
 */
const crypto = require('node:crypto');
const assert = require('node:assert/strict');
const { encode, decode } = require('./financeConverterLab.js');

function clone(value) { return JSON.parse(JSON.stringify(value)); }
function digest(value) {
  return crypto.createHash('sha256').update(JSON.stringify(value)).digest('hex');
}
function recordKey(record) {
  return JSON.stringify([record.ym, record.type, record.id]);
}
function normalizeSnapshot(source, namespace = 'raytech-lab') {
  if (typeof namespace !== 'string' || !/^[a-z0-9_-]{1,40}$/i.test(namespace)) {
    throw new Error('Namespace invalido.');
  }
  // Validacao basica anterior a normalizacao: converter nao aceita IDs ausentes.
  if (!source || typeof source !== 'object' || Array.isArray(source) ||
      !source.months || typeof source.months !== 'object' || Array.isArray(source.months)) {
    throw new Error('Banco de origem invalido.');
  }
  const working = clone(source);
  const assigned = [];
  for (const [ym, month] of Object.entries(working.months)) {
    for (const type of ['expenses', 'cardExpenses', 'extraIncomes']) {
      if (month[type] === undefined) continue;
      if (!Array.isArray(month[type])) throw new Error('Colecao invalida.');
      const occupied = new Set();
      for (const item of month[type]) {
        if (!item || typeof item !== 'object' || Array.isArray(item)) {
          throw new Error('Registro invalido.');
        }
        if (typeof item.id === 'string' && item.id.trim() && !item.id.includes('/')) {
          if (occupied.has(item.id)) throw new Error('ID duplicado existente.');
          occupied.add(item.id);
        }
      }
      month[type].forEach((item, index) => {
        if (typeof item.id === 'string' && item.id.trim() && !item.id.includes('/')) return;
        if (item.id !== undefined && item.id !== null && item.id !== '') {
          throw new Error('ID legado invalido; requer revisao manual.');
        }
        const basis = [namespace, ym, type, index, item];
        const candidate = 'mig_' + digest(basis).slice(0, 32);
        if (occupied.has(candidate)) throw new Error('Colisao de ID; revisao manual.');
        item.id = candidate;
        occupied.add(candidate);
        assigned.push({ ym, type, index, id: candidate });
      });
    }
  }
  const envelope = encode(working);
  assert.deepStrictEqual(decode(envelope), working, 'Reconstrucao inconsistente.');
  return { snapshot: working, envelope, assigned, checksum: digest(envelope) };
}
function report(plan) {
  if (!plan || !plan.envelope || !Array.isArray(plan.assigned)) throw new Error('Plano invalido.');
  const counts = { expenses: 0, cardExpenses: 0, extraIncomes: 0 };
  for (const record of plan.envelope.records) counts[record.type]++;
  return {
    months: plan.envelope.months.length,
    counts, generatedIds: plan.assigned.length,
    totalRecords: plan.envelope.records.length,
    checksum: plan.checksum
  };
}
function createMemoryDestination() {
  const items = new Map();
  return Object.freeze({
    get(key) { return items.has(key) ? clone(items.get(key)) : null; },
    put(key, value) { items.set(key, clone(value)); },
    count() { return items.size; },
    snapshot() { return [...items.entries()].map(([key, value]) => [key, clone(value)]); }
  });
}
function preflight(plan, destination) {
  if (!plan || !plan.envelope || !Array.isArray(plan.envelope.records) ||
      typeof destination?.get !== 'function') throw new Error('Plano ou destino invalido.');
  const conflicts = [];
  let alreadyPresent = 0;
  for (const record of plan.envelope.records) {
    const key = recordKey(record);
    const remote = destination.get(key);
    if (remote === null) continue;
    if (digest(remote) === digest(record.value)) alreadyPresent++;
    else conflicts.push({ ym: record.ym, type: record.type, id: record.id });
  }
  return { conflicts, alreadyPresent, missing: plan.envelope.records.length - alreadyPresent - conflicts.length };
}
function migrateStep(plan, destination, limit = 1) {
  if (!Number.isSafeInteger(limit) || limit < 1) throw new Error('Limite invalido.');
  if (typeof destination?.put !== 'function') throw new Error('Destino invalido.');
  const status = preflight(plan, destination);
  if (status.conflicts.length) return { status: 'conflict', ...status, written: 0 };
  let written = 0;
  for (const record of plan.envelope.records) {
    if (written >= limit) break;
    const key = recordKey(record);
    if (destination.get(key) !== null) continue;
    destination.put(key, record.value);
    written++;
  }
  const after = preflight(plan, destination);
  return { status: after.missing === 0 ? 'complete' : 'partial', ...after, written };
}
module.exports = { normalizeSnapshot, report, preflight, migrateStep, createMemoryDestination, recordKey };
