/* Raytech CG - adaptador local isolado (fase preparatoria).
 * Nao integrado ao app, nao usa Firebase, nao altera a chave legada.
 * Recebe uma Storage API por injecao para permitir testes sem navegador.
 */
(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.RaytechLocalRepository = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';

  const DEFAULT_KEY = 'controle_gastos_multimonth_v3';
  const MONTH_PATTERN = /^\d{4}-(0[1-9]|1[0-2])$/;

  function assertDatabase(db) {
    if (!db || typeof db !== 'object' || Array.isArray(db) ||
        !db.months || typeof db.months !== 'object' || Array.isArray(db.months) ||
        typeof db.selectedMonth !== 'string' ||
        !MONTH_PATTERN.test(db.selectedMonth) ||
        !Object.prototype.hasOwnProperty.call(db.months, db.selectedMonth)) {
      throw new Error('Estrutura do banco local invalida.');
    }
    for (const [ym, month] of Object.entries(db.months)) {
      if (!MONTH_PATTERN.test(ym) || !month || typeof month !== 'object' ||
          Array.isArray(month) || !Array.isArray(month.expenses) ||
          !Array.isArray(month.cardExpenses) ||
          (month.extraIncomes !== undefined && !Array.isArray(month.extraIncomes))) {
        throw new Error('Mes invalido: ' + ym);
      }
    }
    return db;
  }

  function clone(value) {
    return JSON.parse(JSON.stringify(value));
  }

  function createLocalRepository(storage, key = DEFAULT_KEY) {
    if (!storage || typeof storage.getItem !== 'function' ||
        typeof storage.setItem !== 'function') {
      throw new TypeError('Storage API invalida.');
    }
    if (key !== DEFAULT_KEY) {
      throw new Error('Somente a chave legada e permitida nesta fase.');
    }

    function readSnapshot() {
      const raw = storage.getItem(key);
      if (raw === null) return null;
      const parsed = JSON.parse(raw);
      return clone(assertDatabase(parsed));
    }

    function exportSnapshot() {
      const snapshot = readSnapshot();
      if (!snapshot) throw new Error('Nenhum banco local encontrado.');
      return snapshot;
    }

    function listMonths() {
      const snapshot = readSnapshot();
      return snapshot ? Object.keys(snapshot.months).sort() : [];
    }

    function getMonth(ym) {
      if (!MONTH_PATTERN.test(ym)) throw new Error('Mes invalido.');
      const snapshot = readSnapshot();
      return snapshot && Object.prototype.hasOwnProperty.call(snapshot.months, ym)
        ? clone(snapshot.months[ym]) : null;
    }

    /* Exclusivamente para testes e futura integracao controlada.
       Nao mescla, nao migra, nao envia dados e nao modifica outras chaves. */
    function replaceLocalSnapshot(snapshot, options = {}) {
      if (options.confirmed !== true) {
        throw new Error('Substituicao exige confirmacao explicita.');
      }
      const validated = clone(assertDatabase(snapshot));
      storage.setItem(key, JSON.stringify(validated));
      return true;
    }

    return Object.freeze({
      readSnapshot,
      exportSnapshot,
      listMonths,
      getMonth,
      replaceLocalSnapshot
    });
  }

  return Object.freeze({ DEFAULT_KEY, assertDatabase, createLocalRepository });
});
