'use strict';
/* Node-only: laboratório de migração integral fictícia. Sem SDK de produção.
 * Criação imutável versionada (v1), sem substituir dados remotos existentes.
 * Leitura de auditoria usa o plano local APENAS para indicar o planId.
 */
const crypto = require('node:crypto');
const assert = require('node:assert/strict');
const { decode } = require('./financeConverterLab.js');
function hash(value) {
  return crypto.createHash('sha256').update(JSON.stringify(value)).digest('hex');
}
function idOf(record) { return 'r_' + hash([record.ym, record.type, record.id]); }
function validateUid(uid) {
  if (typeof uid !== 'string' || !/^[a-zA-Z0-9_-]{1,100}$/.test(uid))
    throw new Error('UID de laboratorio invalido.');
}
function planIdOf(plan) {
  if (!plan || !plan.envelope || !/^[a-f0-9]{64}$/.test(plan.checksum))
    throw new Error('Plano invalido.');
  return 'p_' + plan.checksum;
}
function entries(plan) {
  const e = plan.envelope;
  const planId = planIdOf(plan);
  const manifest = {
    version: 1, planId, schema: e.schema, selectedMonth: e.selectedMonth,
    topLevel: e.topLevel, checksum: plan.checksum,
    monthCount: e.months.length, recordCount: e.records.length
  };
  const result = [{ kind: 'manifest', id: planId, value: manifest }];
  for (const m of e.months)
    result.push({ kind: 'month', id: m.ym,
      value: { version: 1, ym: m.ym, fields: m.fields, presence: m.presence, counts: m.counts } });
  for (const r of e.records) {
    const id = idOf(r);
    result.push({ kind: 'record', id,
      value: { version: 1, recordId: id, ym: r.ym, type: r.type,
        sourceId: r.id, index: r.index, value: r.value } });
  }
  return result;
}
const collection = { manifest: 'monthMigrationManifest',
  month: 'monthMigrationMonths', record: 'monthMigrationRecords' };
function ref(db, uid, entry) {
  validateUid(uid);
  return db.doc('users/' + uid + '/' + collection[entry.kind] + '/' + entry.id);
}
async function inspect(plan, db, uid) {
  const conflicts = [];
  let present = 0;
  for (const entry of entries(plan)) {
    const snap = await ref(db, uid, entry).get();
    if (!snap.exists) continue;
    try { assert.deepStrictEqual(snap.data(), entry.value); present++; }
    catch (_) { conflicts.push({ kind: entry.kind, id: entry.id }); }
  }
  return { conflicts, present, missing: entries(plan).length - present - conflicts.length };
}
async function migrate(plan, db, uid, limit = 1) {
  if (!Number.isSafeInteger(limit) || limit < 1) throw new Error('Limite invalido.');
  const before = await inspect(plan, db, uid);
  if (before.conflicts.length) return { status: 'conflict', ...before, written: 0 };
  let written = 0;
  for (const entry of entries(plan)) {
    if (written >= limit) break;
    const target = ref(db, uid, entry);
    const created = await db.runTransaction(async tx => {
      const snap = await tx.get(target);
      if (snap.exists) {
        assert.deepStrictEqual(snap.data(), entry.value, 'Conflito durante gravacao.');
        return false;
      }
      tx.set(target, entry.value);
      return true;
    });
    if (created) written++;
  }
  const after = await inspect(plan, db, uid);
  return { status: after.conflicts.length ? 'conflict' : after.missing ? 'partial' : 'complete',
    ...after, written };
}
async function audit(plan, db, uid) {
  const planId = planIdOf(plan);
  const manifestSnap = await ref(db, uid, { kind: 'manifest', id: planId }).get();
  if (!manifestSnap.exists) throw new Error('Manifesto ausente.');
  const manifest = manifestSnap.data();
  if (manifest.version !== 1 || manifest.schema !== 1 || manifest.planId !== planId)
    throw new Error('Manifesto invalido.');
  // Ler coleções inteiras detecta registros extras e impede auditoria de subconjunto.
  validateUid(uid);
  const monthDocs = await db.collection('users/' + uid + '/monthMigrationMonths').get();
  const recordDocs = await db.collection('users/' + uid + '/monthMigrationRecords').get();
  const months = monthDocs.docs.map(d => {
    const v = d.data();
    if (v.version !== 1 || v.ym !== d.id) throw new Error('Mes remoto invalido.');
    return { ym: v.ym, fields: v.fields, presence: v.presence, counts: v.counts };
  });
  const records = recordDocs.docs.map(d => {
    const v = d.data();
    if (v.version !== 1 || v.recordId !== d.id ||
        idOf({ ym: v.ym, type: v.type, id: v.sourceId }) !== d.id)
      throw new Error('Registro remoto invalido.');
    return { ym: v.ym, type: v.type, id: v.sourceId, index: v.index, value: v.value };
  });
  if (months.length !== manifest.monthCount || records.length !== manifest.recordCount)
    throw new Error('Contagem remota divergente.');
  // A ordem das coleções não é garantida; ordenar pela ordem de referência do plano
  // é inadequado. Para checksum canônico, comparar snapshots decodificados.
  const envelope = {
    schema: 1, selectedMonth: manifest.selectedMonth,
    topLevel: manifest.topLevel, months, records
  };
  const restored = decode(envelope);
  const expected = decode(plan.envelope);
  assert.deepStrictEqual(restored, expected, 'Reconstrucao remota divergente.');
  if (manifest.checksum !== plan.checksum) throw new Error('Checksum do manifesto divergente.');
  return { verified: true, months: months.length, records: records.length,
    checksum: manifest.checksum, snapshot: restored };
}
module.exports = { entries, inspect, migrate, audit, ref, planIdOf };
