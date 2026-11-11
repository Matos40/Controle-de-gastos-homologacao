/* Laboratório: fila offline de CRIAÇÃO fictícia. Nunca acessa dados financeiros reais.
 * IDs determinísticos garantem reenvio idempotente, inclusive após queda na confirmação. */
import { doc, runTransaction, serverTimestamp } from 'https://www.gstatic.com/firebasejs/11.10.0/firebase-firestore.js';

const DB_NAME = 'raytech-cg-homolog-sync-lab-v1';
const STORE = 'operations';
const openQueue = () => new Promise((resolve, reject) => {
  const req = indexedDB.open(DB_NAME, 1);
  req.onupgradeneeded = () => {
    if (!req.result.objectStoreNames.contains(STORE)) {
      const store = req.result.createObjectStore(STORE, { keyPath: 'id' });
      store.createIndex('uid', 'uid');
    }
  };
  req.onsuccess = () => resolve(req.result);
  req.onerror = () => reject(req.error);
});
async function operate(mode, value, uid) {
  const db = await openQueue();
  try {
    return await new Promise((resolve, reject) => {
      const tx = db.transaction(STORE, mode);
      const store = tx.objectStore(STORE);
      const req = value === 'list' ? store.index('uid').getAll(uid)
        : mode === 'readonly' ? store.get(value) : value === 'delete' ? null : store.put(value);
      if (value === 'delete') { reject(new Error('invalid-operation')); return; }
      let result;
      req.onsuccess = () => { result = req.result; };
      tx.oncomplete = () => resolve(result);
      tx.onerror = () => reject(tx.error);
      tx.onabort = () => reject(tx.error);
    });
  } finally { db.close(); }
}
async function remove(id) {
  const db = await openQueue();
  try {
    await new Promise((resolve, reject) => {
      const tx = db.transaction(STORE, 'readwrite');
      tx.objectStore(STORE).delete(id);
      tx.oncomplete = resolve;
      tx.onerror = () => reject(tx.error);
      tx.onabort = () => reject(tx.error);
    });
  } finally { db.close(); }
}
export function initializeOfflineQueue(auth, firestore, onAuthStateChanged) {
  const enqueue = document.getElementById('firebaseExpenseQueueAdd');
  const status = document.getElementById('firebaseExpenseQueueStatus');
  const title = document.getElementById('firebaseExpenseLabTitle');
  const amount = document.getElementById('firebaseExpenseLabAmount');
  const panel = document.getElementById('firebaseExpenseQueue');
  const conflicts = document.getElementById('firebaseExpenseQueueConflicts');
  if (!enqueue || !status || !title || !amount || !panel) return;
  let uid = null, flushing = false, generation = 0;
  const message = text => { status.textContent = text; };
  async function show() {
    const current = uid;
    if (!current) return;
    try {
      const items = await operate('readonly', 'list', current);
      if (current !== uid) return;
      const errors = items.filter(x => x.state === 'conflict').length;
      if (conflicts) {
        conflicts.replaceChildren();
        for (const op of items.filter(x => x.state === 'conflict')) {
          const line = document.createElement('div');
          const label = document.createElement('span');
          label.textContent = 'Conflito: ' + (op.kind || 'create') + ' · ' + (op.title || op.targetId || op.id);
          const discard = document.createElement('button');
          discard.type = 'button';
          discard.className = 'ml-2 underline text-rose-300';
          discard.textContent = 'Descartar operação local';
          discard.addEventListener('click', async () => {
            if (uid !== current || !window.confirm('Descartar apenas a operação local? O servidor não será alterado.')) return;
            try { await remove(op.id); await show(); }
            catch { message('Falha ao descartar operação.'); }
          });
          line.className = 'text-xs text-amber-200';
          line.append(label, discard);
          conflicts.append(line);
        }
      }
      message(items.length ? `${items.length} operação(ões) local(is) pendente(s)${errors ? `; ${errors} com conflito` : ''}. ${navigator.onLine ? 'Aguardando confirmação do servidor.' : 'Sem internet.'}`
        : 'Fila vazia: nenhuma criação fictícia aguardando envio.');
    } catch { message('IndexedDB indisponível. Não foi possível consultar a fila.'); }
  }
  async function flush() {
    if (flushing || !uid || !navigator.onLine) return;
    const current = uid, session = generation;
    flushing = true;
    try {
      const items = await operate('readonly', 'list', current);
      for (const op of items) {
        if (session !== generation || auth.currentUser?.uid !== current || !navigator.onLine) break;
        if (op.state === 'conflict') continue;
        try {
          const ref = doc(firestore, 'users', current, 'syncTests', 'expense-lab', 'items', op.targetId || op.id);
          const receipt = doc(firestore, 'users', current, 'syncTests', 'expense-lab', 'receipts', op.id);
          await runTransaction(firestore, async tx => {
            if (op.kind === 'update' || op.kind === 'delete') {
              const confirmed = await tx.get(receipt);
              if (confirmed.exists()) return; // Reenvio após confirmação perdida.
              const snapshot = await tx.get(ref);
              const previous = snapshot.exists() ? snapshot.data() : null;
              if (!previous || previous.deleted || previous.version !== op.baseVersion) {
                throw new Error('lab/conflict');
              }
              tx.update(ref, op.kind === 'delete'
                ? { deleted: true, version: previous.version + 1, updatedAt: serverTimestamp() }
                : { title: op.title, amountCents: op.amountCents, version: previous.version + 1, updatedAt: serverTimestamp() });
              tx.set(receipt, { targetId: op.targetId, kind: op.kind, marker: 'expense-lab-receipt-v1', confirmedAt: serverTimestamp() });
            } else {
              const snapshot = await tx.get(ref);
              if (snapshot.exists()) {
                if (snapshot.data()?.operationId !== op.id) throw new Error('lab/id-collision');
                return;
              }
              tx.set(ref, {
                title: op.title, amountCents: op.amountCents, version: 1,
                deleted: false, marker: 'fictitious-expense-v1',
                operationId: op.id, updatedAt: serverTimestamp()
              });
            }
          });
          if (session !== generation) break;
          await remove(op.id);
        } catch (error) {
          if (error?.message === 'lab/id-collision' || error?.message === 'lab/conflict') {
            await operate('readwrite', { ...op, state: 'conflict' });
          } else if (error?.code === 'permission-denied') {
            message('Permissão negada: operação mantida na fila.');
            break;
          } else {
            message('Sem confirmação do servidor. Operação preservada para nova tentativa.');
            break;
          }
        }
      }
    } catch { message('Não foi possível processar a fila local.'); }
    finally {
      flushing = false;
      if (session === generation) await show();
    }
  }
  enqueue.addEventListener('click', async () => {
    const current = uid;
    if (!current || auth.currentUser?.uid !== current) return;
    const name = title.value.trim(), raw = amount.value.trim();
    const valid = /^\d{1,7}(?:[,.]\d{1,2})?$/.test(raw);
    const cents = valid ? Math.round(Number(raw.replace(',', '.')) * 100) : NaN;
    if (!name || name.length > 60 || !Number.isSafeInteger(cents) || cents <= 0) {
      message('Informe descrição fictícia e valor positivo válido.');
      return;
    }
    enqueue.disabled = true;
    try {
      const id = crypto.randomUUID();
      await operate('readwrite', { id, uid: current, title: name, amountCents: cents, state: 'pending' });
      title.value = ''; amount.value = '';
      message('Operação gravada no IndexedDB. O envio será tentado automaticamente.');
      await show();
      void flush();
    } catch { message('Falha ao salvar no IndexedDB. Nada foi enviado.'); }
    finally { enqueue.disabled = false; }
  });
  window.addEventListener('raytech-lab-queue-mutation', async event => {
    const detail = event.detail;
    const current = uid;
    if (!current || auth.currentUser?.uid !== current ||
        !['update', 'delete'].includes(detail?.kind) ||
        typeof detail.targetId !== 'string' || !detail.targetId ||
        !Number.isSafeInteger(detail.baseVersion) || detail.baseVersion < 1) return;
    if (detail.kind === 'update' && (
      typeof detail.title !== 'string' || !detail.title.trim() ||
      detail.title.length > 60 || !Number.isSafeInteger(detail.amountCents) ||
      detail.amountCents <= 0)) {
      message('Edição offline inválida. Confira descrição e valor.');
      return;
    }
    try {
      const id = crypto.randomUUID();
      await operate('readwrite', {
        id, uid: current, kind: detail.kind, targetId: detail.targetId,
        baseVersion: detail.baseVersion,
        ...(detail.kind === 'update' ? { title: detail.title.trim(), amountCents: detail.amountCents } : {}),
        state: 'pending'
      });
      await show();
      void flush();
    } catch { message('Não foi possível salvar a alteração offline.'); }
  });
  onAuthStateChanged(auth, user => {
    generation++;
    uid = user?.uid || null;
    panel.classList.toggle('hidden', !uid);
    if (!uid && conflicts) conflicts.replaceChildren();
    if (!uid) { message('Entre com Google para usar a fila.'); return; }
    void show();
    void flush();
  });
  window.addEventListener('online', () => { void flush(); });
  document.addEventListener('visibilitychange', () => {
    if (!document.hidden) void flush();
  });
  // O navegador pode não disparar "online" ao voltar de uma falha de rede.
  window.addEventListener('focus', () => { void flush(); });
}
