/* Laboratório de despesas fictícias: NÃO acessa appDb, localStorage ou lançamentos reais.
 * Transações exigem conexão; conflitos nunca são sobrescritos silenciosamente. */
import {
  collection, doc, onSnapshot, runTransaction, serverTimestamp
} from 'https://www.gstatic.com/firebasejs/11.10.0/firebase-firestore.js';

export function initializeExpenseLab(auth, db, onAuthStateChanged) {
  const root = document.getElementById('firebaseExpenseLab');
  const title = document.getElementById('firebaseExpenseLabTitle');
  const amount = document.getElementById('firebaseExpenseLabAmount');
  const save = document.getElementById('firebaseExpenseLabSave');
  const cancel = document.getElementById('firebaseExpenseLabCancel');
  const draftButton = document.getElementById('firebaseExpenseLabDraft');
  const draftStatus = document.getElementById('firebaseExpenseLabDraftStatus');
  const list = document.getElementById('firebaseExpenseLabList');
  const status = document.getElementById('firebaseExpenseLabStatus');
  if (!root || !title || !amount || !save || !cancel || !list || !status) return;
  let unsubscribe = null;
  let generation = 0;
  let editing = null;
  let busy = false;
  let rows = new Map();
  let serverReady = false;
  const draftKey = uid => 'raytech_homolog_expense_draft_v1_' + uid;
  const draftMessage = value => { if (draftStatus) draftStatus.textContent = value; };
  const readDraft = uid => { try { return JSON.parse(sessionStorage.getItem(draftKey(uid)) || 'null'); } catch { return null; } };
  const message = text => { status.textContent = text; };
  const path = user => collection(db, 'users', user.uid, 'syncTests', 'expense-lab', 'items');
  const reset = () => {
    editing = null;
    title.value = '';
    amount.value = '';
    save.textContent = 'Cadastrar despesa fictícia';
    cancel.classList.add('hidden');
  };
  const controls = () => {
    save.disabled = busy || !auth.currentUser || !serverReady;
    title.disabled = busy;
    amount.disabled = busy;
    if (draftButton) draftButton.disabled = busy || !auth.currentUser;
  };
  const money = cents => (cents / 100).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
  function render() {
    list.replaceChildren();
    const items = [...rows.entries()].filter(([, data]) => !data.deleted)
      .sort((a,b) => a[1].title.localeCompare(b[1].title, 'pt-BR'));
    if (!items.length) {
      const empty = document.createElement('p');
      empty.className = 'text-[11px] text-slate-400';
      empty.textContent = 'Nenhuma despesa fictícia cadastrada.';
      list.append(empty);
    }
    for (const [id, data] of items) {
      const line = document.createElement('div');
      line.className = 'flex flex-wrap items-center justify-between gap-2 border border-slate-700 rounded-lg p-2';
      const name = document.createElement('span');
      name.className = 'text-xs text-slate-200';
      name.textContent = data.title + ' · ' + money(data.amountCents);
      const buttons = document.createElement('div');
      buttons.className = 'flex gap-2';
      const edit = document.createElement('button');
      edit.type = 'button';
      edit.className = 'text-xs text-cyan-300 underline';
      edit.textContent = 'Editar';
      edit.disabled = busy || !serverReady;
      edit.addEventListener('click', () => {
        editing = { id, version: data.version };
        title.value = data.title;
        amount.value = (data.amountCents / 100).toFixed(2).replace('.', ',');
        save.textContent = 'Salvar edição';
        cancel.classList.remove('hidden');
        message('Editando versão ' + data.version + '. Alterações simultâneas serão verificadas.');
      });
      const remove = document.createElement('button');
      remove.type = 'button';
      remove.className = 'text-xs text-rose-300 underline';
      remove.textContent = 'Excluir';
      remove.disabled = busy || !serverReady;
      remove.addEventListener('click', () => mutate('delete', { id, version: data.version }));
      buttons.append(edit, remove);
      line.append(name, buttons);
      list.append(line);
    }
  }
  async function mutate(action, target = editing) {
    const user = auth.currentUser;
    if (!user || busy || !serverReady) { if (!serverReady) message('Sem confirmação do servidor. A operação não foi enviada.'); return; }
    const session = generation;
    const titleValue = title.value.trim();
    const rawAmount = amount.value.trim();
    const validMoney = /^\d{1,7}(?:[,.]\d{1,2})?$/.test(rawAmount);
    const cents = validMoney ? Math.round(Number(rawAmount.replace(',', '.')) * 100) : NaN;
    if (action !== 'delete' && (!titleValue || titleValue.length > 60 || !Number.isSafeInteger(cents) || cents <= 0)) {
      message('Informe descrição de até 60 caracteres e valor positivo (ex.: 25,50).');
      return;
    }
    busy = true; controls(); render();
    message('Confirmando operação com o servidor…');
    try {
      const reference = doc(path(user), target?.id || crypto.randomUUID());
      await runTransaction(db, async tx => {
        const snapshot = await tx.get(reference);
        const previous = snapshot.exists() ? snapshot.data() : null;
        if (action === 'create') {
          if (previous) throw new Error('lab/conflict');
          tx.set(reference, {
            title: titleValue, amountCents: cents, version: 1,
            deleted: false, marker: 'fictitious-expense-v1', updatedAt: serverTimestamp()
          });
        } else {
          if (!previous || previous.deleted || previous.version !== target?.version) {
            throw new Error('lab/conflict');
          }
          if (action === 'delete') {
            tx.update(reference, { deleted: true, version: previous.version + 1, updatedAt: serverTimestamp() });
          } else {
            tx.update(reference, {
              title: titleValue, amountCents: cents, version: previous.version + 1,
              updatedAt: serverTimestamp()
            });
          }
        }
      });
      if (session !== generation) return;
      reset();
      message(action === 'delete' ? 'Exclusão confirmada no servidor.' : 'Registro confirmado no servidor e disponível nos outros dispositivos.');
    } catch (error) {
      if (session !== generation) return;
      message(error?.message === 'lab/conflict'
        ? 'Conflito detectado: este registro mudou em outro aparelho. Revise os dados atualizados antes de tentar novamente.'
        : error?.code === 'permission-denied'
          ? 'Permissão negada pelo Firestore.'
          : 'Operação não confirmada. Para editar ou excluir neste teste, mantenha a conexão ativa.');
      if (error?.message === 'lab/conflict') reset();
    } finally {
      if (session === generation) { busy = false; controls(); render(); }
    }
  }
  if (draftButton) draftButton.addEventListener('click', () => {
    const user = auth.currentUser;
    if (!user || busy) return;
    if (editing) {
      draftMessage('Rascunho offline de edição não é permitido neste teste. Cancele a edição para criar um novo.');
      return;
    }
    const draftTitle = title.value.trim();
    const draftAmount = amount.value.trim();
    const validMoney = /^\d{1,7}(?:[,.]\d{1,2})?$/.test(draftAmount);
    const cents = validMoney ? Math.round(Number(draftAmount.replace(',', '.')) * 100) : NaN;
    if (!draftTitle || draftTitle.length > 60 || !Number.isSafeInteger(cents) || cents <= 0) {
      draftMessage('Preencha descrição e valor fictícios válidos antes de guardar o rascunho.');
      return;
    }
    try {
      sessionStorage.setItem(draftKey(user.uid), JSON.stringify({ title: draftTitle, amountCents: cents }));
      draftMessage('Rascunho salvo somente nesta aba. Não foi enviado ao Firebase. Ao reconectar, revise e cadastre manualmente.');
    } catch {
      draftMessage('Não foi possível guardar o rascunho neste navegador.');
    }
  });
  save.addEventListener('click', async () => {
    const user = auth.currentUser;
    const draft = user && readDraft(user.uid);
    const matchesDraft = !editing && draft && draft.title === title.value.trim() &&
      draft.amountCents === Math.round(Number(amount.value.trim().replace(',', '.')) * 100);
    if (!serverReady) {
      message('Aguardando servidor. O rascunho permanece somente neste dispositivo.');
      return;
    }
    await mutate(editing ? 'update' : 'create');
    // O rascunho é mantido até o usuário limpá-lo manualmente; evita perda em falhas.
    if (matchesDraft) draftMessage('Confira se o registro foi confirmado na lista. O rascunho continua disponível até ser descartado.');
  });
  cancel.addEventListener('click', () => { reset(); message('Edição cancelada.'); });
  const recover = document.getElementById('firebaseExpenseLabRecover');
  const discard = document.getElementById('firebaseExpenseLabDiscard');
  if (recover) recover.addEventListener('click', () => {
    const user = auth.currentUser;
    const draft = user && readDraft(user.uid);
    if (!draft || editing) { draftMessage('Nenhum rascunho recuperável ou edição em andamento.'); return; }
    title.value = draft.title;
    amount.value = (draft.amountCents / 100).toFixed(2).replace('.', ',');
    draftMessage('Rascunho recuperado. Revise e cadastre quando houver conexão com o servidor.');
  });
  if (discard) discard.addEventListener('click', () => {
    const user = auth.currentUser;
    if (!user) return;
    sessionStorage.removeItem(draftKey(user.uid));
    draftMessage('Rascunho descartado deste navegador.');
  });
  onAuthStateChanged(auth, user => {
    generation++;
    if (unsubscribe) { unsubscribe(); unsubscribe = null; }
    rows = new Map(); serverReady = false; busy = false; reset();
    root.classList.toggle('hidden', !user);
    const draft = user ? readDraft(user.uid) : null;
    draftMessage(draft ? 'Rascunho local disponível. Use “Recuperar rascunho” para revisar.' : 'Nenhum rascunho local pendente.');
    controls(); render();
    if (!user) return;
    const session = generation;
    message('Aguardando dados do servidor…');
    unsubscribe = onSnapshot(path(user), { includeMetadataChanges: true }, snapshot => {
      if (session !== generation) return;
      rows = new Map(snapshot.docs.map(d => [d.id, d.data()]));
      serverReady = !snapshot.metadata.fromCache && !snapshot.metadata.hasPendingWrites;
      controls(); render();
      if (!serverReady) {
        message('Aguardando conexão com o servidor. Edição desabilitada para evitar conflitos.');
      } else if (!editing) {
        message('Despesas fictícias sincronizadas. Teste cadastro, edição e exclusão em dois aparelhos.');
      }
    }, error => {
      if (session !== generation) return;
      serverReady = false; controls();
      message(error?.code === 'permission-denied' ? 'Acesso negado pelas regras.' : 'Falha ao acompanhar o servidor.');
    });
  });
}
