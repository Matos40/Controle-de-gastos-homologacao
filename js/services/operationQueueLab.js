/* Raytech CG - laboratorio de operacoes individuais.
 * Isolado: nao acessa appDb, Firebase, PIN, Gemini ou o banco legado.
 * Sem integracao com a interface nesta fase.
 */
(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.RaytechOperationQueue = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';

  const LAB_KEY = 'raytech_cg_operation_lab_v1';
  const TYPES = Object.freeze(['expense', 'cardExpense', 'extraIncome']);
  const MONTH = /^\d{4}-(0[1-9]|1[0-2])$/;
  const ID = /^[a-zA-Z0-9_-]{1,128}$/;

  function copy(value) { return JSON.parse(JSON.stringify(value)); }
  function checkIdentity(month, type, id) {
    if (typeof month !== 'string' || !MONTH.test(month) ||
        !TYPES.includes(type) || typeof id !== 'string' || !ID.test(id)) {
      throw new Error('Identidade do registro invalida.');
    }
  }
  function validData(data) {
    return data && typeof data === 'object' && !Array.isArray(data) &&
      typeof data.title === 'string' && data.title.trim().length > 0 &&
      data.title.length <= 120 && typeof data.amountCents === 'number' &&
      Number.isSafeInteger(data.amountCents) && data.amountCents >= 0 &&
      data.amountCents <= 999999999;
  }
  function empty() { return { schema: 1, records: {}, pending: [] }; }
  function key(month, type, id) { return month + '/' + type + '/' + id; }
  function validateState(state) {
    if (!state || state.schema !== 1 || !state.records ||
        typeof state.records !== 'object' || Array.isArray(state.records) ||
        !Array.isArray(state.pending)) throw new Error('Estado do laboratorio invalido.');
    const seen = new Set();
    for (const [k, r] of Object.entries(state.records)) {
      if (!r || typeof r !== 'object') throw new Error('Registro invalido.');
      checkIdentity(r.month, r.type, r.id);
      if (key(r.month, r.type, r.id) !== k ||
          !Number.isSafeInteger(r.version) || r.version < 1 ||
          typeof r.deleted !== 'boolean' ||
          (r.deleted ? r.data !== null : !validData(r.data))) {
        throw new Error('Registro inconsistente.');
      }
    }
    for (const op of state.pending) {
      if (!op || typeof op !== 'object' || typeof op.operationId !== 'string' ||
          !ID.test(op.operationId) || seen.has(op.operationId) ||
          !['create', 'update', 'delete'].includes(op.kind) ||
          !Number.isSafeInteger(op.version) || op.version < 1 ||
          (op.payload !== undefined &&
            (op.kind === 'delete' ? op.payload !== null : !validData(op.payload)))) {
        throw new Error('Operacao pendente invalida.');
      }
      checkIdentity(op.month, op.type, op.id);
      if (!state.records[key(op.month, op.type, op.id)] ||
          state.records[key(op.month, op.type, op.id)].version < op.version) {
        throw new Error('Operacao sem registro correspondente.');
      }
      seen.add(op.operationId);
    }
    return state;
  }

  function createQueue(storage, options = {}) {
    if (!storage || typeof storage.getItem !== 'function' ||
        typeof storage.setItem !== 'function') throw new TypeError('Storage invalido.');
    const storageKey = options.storageKey || LAB_KEY;
    if (storageKey !== LAB_KEY) throw new Error('Chave de armazenamento nao autorizada.');
    const idFactory = options.idFactory || (() => {
      if (typeof crypto === 'undefined' || !crypto.randomUUID) {
        throw new Error('Gerador seguro de IDs indisponivel.');
      }
      return crypto.randomUUID();
    });
    const raw = storage.getItem(storageKey);
    let state = raw === null ? empty() : validateState(JSON.parse(raw));
    state = copy(state);

    function persist(next) {
      validateState(next);
      storage.setItem(storageKey, JSON.stringify(next));
      state = next;
    }
    function enqueue(kind, month, type, id, data, expectedVersion) {
      checkIdentity(month, type, id);
      const k = key(month, type, id);
      const before = state.records[k] || null;
      if (kind === 'create' && before) throw new Error('ID ja existente.');
      if (kind !== 'create' &&
          (!before || before.deleted || before.version !== expectedVersion)) {
        throw new Error('Conflito de versao ou registro excluido.');
      }
      if (kind !== 'delete' && !validData(data)) throw new Error('Dados invalidos.');
      if (kind === 'update' && JSON.stringify(before.data) === JSON.stringify(data)) {
        throw new Error('Edicao sem alteracao.');
      }
      const operationId = idFactory();
      if (typeof operationId !== 'string' || !ID.test(operationId) ||
          state.pending.some(op => op.operationId === operationId)) {
        throw new Error('ID de operacao invalido ou repetido.');
      }
      const version = before ? before.version + 1 : 1;
      const next = copy(state);
      next.records[k] = {
        month, type, id, version,
        deleted: kind === 'delete',
        data: kind === 'delete' ? null : copy(data)
      };
      next.pending.push({
        operationId, kind, month, type, id, version,
        payload: kind === 'delete' ? null : copy(data)
      });
      persist(next);
      return operationId;
    }
    return Object.freeze({
      create(month, type, id, data) {
        return enqueue('create', month, type, id, data);
      },
      update(month, type, id, data, expectedVersion) {
        return enqueue('update', month, type, id, data, expectedVersion);
      },
      remove(month, type, id, expectedVersion) {
        return enqueue('delete', month, type, id, null, expectedVersion);
      },
      get(month, type, id) {
        checkIdentity(month, type, id);
        const record = state.records[key(month, type, id)];
        return record ? copy(record) : null;
      },
      pending() { return copy(state.pending); },
      /* Entradas antigas sem payload exigem reconciliacao antes do envio. */
      readyToSend() {
        const first = state.pending[0];
        if (!first) return null;
        if (!Object.prototype.hasOwnProperty.call(first, 'payload')) {
          throw new Error('Operacao antiga sem payload: reconciliacao necessaria.');
        }
        return copy(first);
      },
      acknowledge(operationId) {
        if (typeof operationId !== 'string' || !ID.test(operationId)) {
          throw new Error('ID de operacao invalido.');
        }
        const next = copy(state);
        const index = next.pending.findIndex(op => op.operationId === operationId);
        if (index < 0) return false;
        next.pending.splice(index, 1);
        persist(next);
        return true;
      },
      snapshot() { return copy(state); }
    });
  }
  return Object.freeze({ LAB_KEY, createQueue });
});
