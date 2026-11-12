'use strict';
/* Node-only laboratory adapter; no production Firebase or financial storage. */
const crypto = require('node:crypto');
const assert = require('node:assert/strict');
const { recordKey } = require('./preMigrationLab.js');
function digest(value) {
  return crypto.createHash('sha256').update(JSON.stringify(value)).digest('hex');
}
function docId(key) { return 'm_' + digest(key); }
function refFor(db, uid, record) {
  if (!/^[a-zA-Z0-9_-]{1,100}$/.test(uid)) throw new Error('UID de laboratorio invalido.');
  return db.doc('users/' + uid + '/migrationLab/' + docId(recordKey(record)));
}
function stored(record) {
  return {
    key: recordKey(record), ym: record.ym, type: record.type,
    recordId: docId(recordKey(record)), sourceId: record.id, value: record.value
  };
}
async function inspect(plan, db, uid) {
  const conflicts = [];
  let alreadyPresent = 0;
  for (const record of plan.envelope.records) {
    const snap = await refFor(db, uid, record).get();
    if (!snap.exists) continue;
    try { assert.deepStrictEqual(snap.data(), stored(record)); alreadyPresent++; }
    catch (_) { conflicts.push({ ym: record.ym, type: record.type, id: record.id }); }
  }
  return {
    conflicts, alreadyPresent,
    missing: plan.envelope.records.length - alreadyPresent - conflicts.length
  };
}
async function step(plan, db, uid, limit = 1) {
  if (!Number.isSafeInteger(limit) || limit < 1) throw new Error('Limite invalido.');
  const before = await inspect(plan, db, uid);
  if (before.conflicts.length) return { status: 'conflict', ...before, written: 0 };
  let written = 0;
  for (const record of plan.envelope.records) {
    if (written >= limit) break;
    const ref = refFor(db, uid, record);
    const expected = stored(record);
    const result = await db.runTransaction(async tx => {
      const snap = await tx.get(ref);
      if (snap.exists) {
        assert.deepStrictEqual(snap.data(), expected, 'Conflito remoto durante migracao.');
        return false;
      }
      tx.set(ref, expected);
      return true;
    });
    if (result) written++;
  }
  const after = await inspect(plan, db, uid);
  return { status: after.conflicts.length ? 'conflict' : after.missing ? 'partial' : 'complete', ...after, written };
}
module.exports = { inspect, step, refFor, stored, docId };
