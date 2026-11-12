/* Raytech CG - conversor reversivel de snapshots ficticios.
 * Nao acessa localStorage, Firebase, DOM ou estado global.
 * Nao usar para migracao real sem validacao adicional.
 */
(function(root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.RaytechFinanceConverterLab = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function() {
  'use strict';
  const YM = /^\d{4}-(0[1-9]|1[0-2])$/;
  const COLLECTIONS = ['expenses', 'cardExpenses', 'extraIncomes'];
  const own = (obj, key) => Object.prototype.hasOwnProperty.call(obj, key);
  function fail(message) { throw new Error(message); }
  function cloneJson(value) {
    if (value === undefined) fail('Valor indefinido nao e JSON.');
    let encoded;
    try { encoded = JSON.stringify(value); }
    catch (_) { fail('Objeto nao serializavel em JSON.'); }
    if (encoded === undefined) fail('Objeto nao serializavel em JSON.');
    const parsed = JSON.parse(encoded);
    if (JSON.stringify(parsed) !== encoded) fail('Conversao JSON inconsistente.');
    return parsed;
  }
  function assertJson(value, location) {
    if (value === null || typeof value === 'string' || typeof value === 'boolean') return;
    if (typeof value === 'number' && Number.isFinite(value)) return;
    if (Array.isArray(value)) {
      for (let i = 0; i < value.length; i++) {
        if (!own(value, i)) fail('Lacuna no array: ' + location);
        assertJson(value[i], location + '[' + i + ']');
      }
      return;
    }
    if (value && typeof value === 'object' &&
        (Object.getPrototypeOf(value) === Object.prototype ||
         Object.getPrototypeOf(value) === null)) {
      for (const k of Object.keys(value)) assertJson(value[k], location + '.' + k);
      return;
    }
    fail('Valor nao JSON em ' + location);
  }
  function assertSnapshot(db) {
    assertJson(db, 'db');
    if (!db || Array.isArray(db) || typeof db !== 'object' ||
        typeof db.selectedMonth !== 'string' || !YM.test(db.selectedMonth) ||
        !db.months || Array.isArray(db.months) || typeof db.months !== 'object' ||
        !own(db.months, db.selectedMonth)) fail('Estrutura mensal invalida.');
    for (const [ym, month] of Object.entries(db.months)) {
      if (!YM.test(ym) || !month || typeof month !== 'object' || Array.isArray(month)) {
        fail('Mes invalido: ' + ym);
      }
      for (const type of COLLECTIONS) {
        if (type === 'extraIncomes' && !own(month, type)) continue;
        if (!Array.isArray(month[type])) fail('Colecao invalida: ' + ym + '/' + type);
        const ids = new Set();
        for (const item of month[type]) {
          if (!item || Array.isArray(item) || typeof item !== 'object' ||
              typeof item.id !== 'string' || !item.id.trim() || item.id.includes('/')) {
            fail('Registro sem ID estavel: ' + ym + '/' + type);
          }
          if (ids.has(item.id)) fail('ID duplicado: ' + ym + '/' + type + '/' + item.id);
          ids.add(item.id);
        }
      }
    }
    return db;
  }
  function encode(db) {
    assertSnapshot(db);
    const snapshot = cloneJson(db);
    const months = [];
    const records = [];
    for (const [ym, month] of Object.entries(snapshot.months)) {
      const fields = {};
      const presence = {};
      for (const type of COLLECTIONS) {
        presence[type] = own(month, type);
      }
      for (const [field, value] of Object.entries(month)) {
        if (!COLLECTIONS.includes(field)) fields[field] = value;
      }
      const counts = {};
      for (const type of COLLECTIONS) counts[type] = (month[type] || []).length;
      months.push({ ym, fields, presence, counts });
      for (const type of COLLECTIONS) {
        (month[type] || []).forEach((item, index) => {
          records.push({ ym, type, id: item.id, index, value: item });
        });
      }
    }
    const topLevel = {};
    for (const [key, value] of Object.entries(snapshot)) {
      if (key !== 'months' && key !== 'selectedMonth') topLevel[key] = value;
    }
    return cloneJson({ schema: 1, selectedMonth: snapshot.selectedMonth, topLevel, months, records });
  }
  function decode(envelope) {
    assertJson(envelope, 'envelope');
    if (!envelope || envelope.schema !== 1 ||
        !Array.isArray(envelope.months) || !Array.isArray(envelope.records) ||
        !envelope.topLevel || typeof envelope.topLevel !== 'object' ||
        Array.isArray(envelope.topLevel) || own(envelope.topLevel, 'months') ||
        own(envelope.topLevel, 'selectedMonth')) fail('Envelope invalido.');
    const db = { ...cloneJson(envelope.topLevel), selectedMonth: envelope.selectedMonth, months: {} };
    const presence = {};
    for (const entry of envelope.months) {
      if (!entry || !YM.test(entry.ym) || own(db.months, entry.ym) ||
          !entry.fields || typeof entry.fields !== 'object' || Array.isArray(entry.fields) ||
          !entry.presence || typeof entry.presence !== 'object' || Array.isArray(entry.presence) ||
          !entry.counts || typeof entry.counts !== 'object' || Array.isArray(entry.counts) ||
          COLLECTIONS.some(type => !Number.isSafeInteger(entry.counts[type]) || entry.counts[type] < 0 ||
            (!entry.presence[type] && entry.counts[type] !== 0)) ||
          COLLECTIONS.some(type => typeof entry.presence[type] !== 'boolean' || own(entry.fields, type))) {
        fail('Metadados mensais invalidos.');
      }
      db.months[entry.ym] = cloneJson(entry.fields);
      presence[entry.ym] = { ...entry.presence, counts: entry.counts };
      for (const type of COLLECTIONS) {
        if (entry.presence[type]) db.months[entry.ym][type] = [];
      }
    }
    const seen = new Set();
    for (const entry of envelope.records) {
      if (!entry || !own(db.months, entry.ym) || !COLLECTIONS.includes(entry.type) ||
          !presence[entry.ym][entry.type] || !Number.isSafeInteger(entry.index) ||
          entry.index < 0 || typeof entry.id !== 'string' ||
          !entry.value || entry.value.id !== entry.id) fail('Registro de envelope invalido.');
      const k = JSON.stringify([entry.ym, entry.type, entry.id]);
      if (seen.has(k)) fail('Registro duplicado no envelope.');
      seen.add(k);
      const arr = db.months[entry.ym][entry.type];
      if (own(arr, entry.index)) fail('Indice duplicado no envelope.');
      arr[entry.index] = cloneJson(entry.value);
    }
    for (const month of Object.values(db.months)) {
      for (const type of COLLECTIONS) {
        if (!own(month, type)) continue;
        const ym = Object.keys(db.months).find(key => db.months[key] === month);
        if (month[type].length !== presence[ym].counts[type]) fail('Contagem divergente no envelope.');
        for (let i = 0; i < month[type].length; i++) {
          if (!own(month[type], i)) fail('Indice ausente no envelope.');
        }
      }
    }
    return cloneJson(assertSnapshot(db));
  }
  return Object.freeze({ encode, decode, assertSnapshot });
});
