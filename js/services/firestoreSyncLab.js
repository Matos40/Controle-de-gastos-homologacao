/* Isolated laboratory bridge. Never imports app state or production Firebase. */
(function(root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.RaytechFirestoreSyncLab = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function() {
  'use strict';
  async function drainOne(queue, transport) {
    if (!queue || typeof queue.readyToSend !== 'function' ||
        typeof queue.acknowledge !== 'function' ||
        !transport || typeof transport.send !== 'function') {
      throw new TypeError('Fila ou transporte invalido.');
    }
    const op = queue.readyToSend();
    if (!op) return { status: 'empty' };
    try {
      const result = await transport.send(op);
      if (!result || result.confirmed !== true ||
          result.operationId !== op.operationId) {
        throw new Error('Recibo remoto ausente ou divergente.');
      }
      if (!queue.acknowledge(op.operationId)) {
        throw new Error('Operacao confirmada, mas nao localizada na fila.');
      }
      return { status: 'confirmed', operationId: op.operationId };
    } catch (error) {
      return { status: 'pending', operationId: op.operationId, error: String(error.message || error) };
    }
  }
  return Object.freeze({ drainOne });
});
