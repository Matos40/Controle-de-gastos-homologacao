/* Firebase Authentication — homologação. Não lê nem envia dados financeiros. */
import { initializeApp } from 'https://www.gstatic.com/firebasejs/11.10.0/firebase-app.js';
import {
  getAuth, GoogleAuthProvider, signInWithPopup, signOut, onAuthStateChanged
} from 'https://www.gstatic.com/firebasejs/11.10.0/firebase-auth.js';

import { getFirestore, doc, setDoc, getDocFromServer, serverTimestamp, onSnapshot, deleteDoc } from 'https://www.gstatic.com/firebasejs/11.10.0/firebase-firestore.js';

const firebaseConfig = Object.freeze({
  apiKey: 'AIzaSyAlOok-2bV9QigR6PyjRgHMLjFLIoPDWpw',
  authDomain: 'raytech-cg-homologacao.firebaseapp.com',
  projectId: 'raytech-cg-homologacao',
  storageBucket: 'raytech-cg-homologacao.firebasestorage.app',
  messagingSenderId: '195471491370',
  appId: '1:195471491370:web:b7e5a0a5a218d16f7a9e53'
});

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const firestore = getFirestore(app);
auth.languageCode = 'pt-BR';
const provider = new GoogleAuthProvider();
provider.setCustomParameters({ prompt: 'select_account' });

const status = document.getElementById('firebaseAuthStatus');
const login = document.getElementById('firebaseLoginButton');
const logout = document.getElementById('firebaseLogoutButton');
const account = document.getElementById('firebaseAccount');
const firestoreTestButton = document.getElementById('firebaseFirestoreTestButton');
const firestoreTestStatus = document.getElementById('firebaseFirestoreTestStatus');
let busy = false;

function render(user, message) {
  if (status) status.textContent = message || (user ? 'Conectado ao Firebase de homologação' : 'Não conectado à nuvem');
  if (account) account.textContent = user ? (user.displayName || user.email || 'Conta Google') : '';
  if (login) { login.classList.toggle('hidden', Boolean(user)); login.disabled = busy; }
  if (logout) { logout.classList.toggle('hidden', !user); logout.disabled = busy; }
  if (firestoreTestButton) {
    firestoreTestButton.classList.toggle('hidden', !user);
    firestoreTestButton.disabled = busy;
  }
}
function errorMessage(error) {
  switch (error?.code) {
    case 'auth/popup-closed-by-user': return 'Login cancelado. Você pode tentar novamente.';
    case 'auth/cancelled-popup-request': return 'Uma janela de login já está aberta.';
    case 'auth/popup-blocked': return 'O navegador bloqueou a janela. Permita pop-ups e tente novamente.';
    case 'auth/unauthorized-domain': return 'Domínio não autorizado no Firebase Authentication.';
    case 'auth/network-request-failed': return 'Sem conexão com o Firebase. Seus dados locais permanecem disponíveis.';
    case 'auth/operation-not-supported-in-this-environment': return 'Este navegador não permite a janela de login. Teste no navegador normal.';
    default: return 'Não foi possível autenticar. Confira a conexão e tente novamente.';
  }
}

onAuthStateChanged(auth, user => render(user), error => render(null, errorMessage(error)));
render(null, 'Verificando conexão com o Firebase…');

if (login) login.addEventListener('click', async () => {
  if (busy) return;
  busy = true;
  render(auth.currentUser, 'Abrindo login Google…');
  try {
    await signInWithPopup(auth, provider);
    render(auth.currentUser);
  } catch (error) {
    console.warn('Firebase Auth:', error?.code || 'erro de autenticação');
    render(auth.currentUser, errorMessage(error));
  } finally {
    busy = false;
    render(auth.currentUser, status?.textContent);
  }
});
if (logout) logout.addEventListener('click', async () => {
  if (busy) return;
  busy = true;
  render(auth.currentUser, 'Saindo da conta…');
  try {
    await signOut(auth);
    render(null, 'Sessão Firebase encerrada. Dados locais preservados.');
  } catch (error) {
    render(auth.currentUser, errorMessage(error));
  } finally {
    busy = false;
    render(auth.currentUser, status?.textContent);
  }
});

/* Teste manual e isolado: somente dados fictícios em users/{uid}/syncTests/connection-check. */
if (firestoreTestButton) firestoreTestButton.addEventListener('click', async () => {
  const user = auth.currentUser;
  if (!user || busy) return;
  busy = true;
  firestoreTestButton.disabled = true;
  if (firestoreTestStatus) firestoreTestStatus.textContent = 'Gravando e lendo registro de teste no Firestore…';
  try {
    const reference = doc(firestore, 'users', user.uid, 'syncTests', 'connection-check');
    const marker = 'raytech-cg-homologacao-test-v1';
    const nonce = crypto.randomUUID();
    await setDoc(reference, {
      marker,
      nonce,
      testedAt: serverTimestamp()
    });
    const snapshot = await getDocFromServer(reference);
    const data = snapshot.data();
    if (!snapshot.exists() || data?.marker !== marker || data?.nonce !== nonce) {
      throw new Error('test/verification-failed');
    }
    if (firestoreTestStatus) firestoreTestStatus.textContent = 'Teste aprovado: gravação e leitura confirmadas na nuvem.';
  } catch (error) {
    console.warn('Teste Firestore:', error?.code || 'falha de verificação');
    if (firestoreTestStatus) {
      firestoreTestStatus.textContent = error?.code === 'permission-denied'
        ? 'Permissão negada. Verifique as regras do Firestore.'
        : error?.code === 'unavailable'
          ? 'Firestore indisponível ou sem conexão. Tente novamente online.'
          : 'Teste não concluído. Confira a conexão e as configurações do Firestore.';
    }
  } finally {
    busy = false;
    firestoreTestButton.disabled = !auth.currentUser;
  }
});

/* Laboratório de sincronização: documento fictício único por usuário.
   Não lê appDb, localStorage, PIN, chave Gemini ou lançamentos financeiros. */
const syncInput = document.getElementById('firebaseSyncDemoInput');
const syncSave = document.getElementById('firebaseSyncDemoSave');
const syncDelete = document.getElementById('firebaseSyncDemoDelete');
const syncValue = document.getElementById('firebaseSyncDemoValue');
const syncStatus = document.getElementById('firebaseSyncDemoStatus');
let unsubscribeDemo = null;
let demoBusy = false;
let demoGeneration = 0;
function demoReference(user) {
  return doc(firestore, 'users', user.uid, 'syncTests', 'cross-device-demo');
}
function demoMessage(message) {
  if (syncStatus) syncStatus.textContent = message;
}
function demoControls(user) {
  for (const el of [syncSave, syncDelete, syncInput]) {
    if (el) el.disabled = !user || demoBusy;
  }
  const section = document.getElementById('firebaseSyncDemo');
  if (section) section.classList.toggle('hidden', !user);
}
onAuthStateChanged(auth, user => {
  demoGeneration++;
  const generation = demoGeneration;
  if (unsubscribeDemo) { unsubscribeDemo(); unsubscribeDemo = null; }
  if (syncValue) syncValue.textContent = 'Nenhum registro carregado.';
  if (syncInput) syncInput.value = '';
  demoControls(user);
  if (!user) { demoMessage('Entre com Google para testar a sincronização.'); return; }
  demoMessage('Conectando à sincronização de teste…');
  unsubscribeDemo = onSnapshot(demoReference(user), { includeMetadataChanges: true }, snapshot => {
    if (generation !== demoGeneration) return;
    const value = snapshot.exists() ? snapshot.data()?.value : null;
    if (syncValue) syncValue.textContent = typeof value === 'string' ? value : 'Nenhum registro de teste salvo.';
    demoMessage(snapshot.metadata.hasPendingWrites
      ? 'Alteração local pendente de envio à nuvem.'
      : snapshot.metadata.fromCache
        ? 'Mostrando dados do cache; aguardando confirmação do servidor.'
        : 'Sincronizado com o servidor. Alterações em outro aparelho aparecerão aqui.');
  }, error => {
    if (generation !== demoGeneration) return;
    demoMessage(error?.code === 'permission-denied'
      ? 'Acesso negado pelas regras do Firestore.'
      : 'Não foi possível acompanhar alterações do servidor.');
  });
});
async function demoWrite(remove) {
  const user = auth.currentUser;
  if (!user || demoBusy) return;
  const value = syncInput?.value.trim() || '';
  if (!remove && (!value || value.length > 80)) {
    demoMessage('Digite um texto fictício de 1 a 80 caracteres.');
    return;
  }
  demoBusy = true;
  demoControls(user);
  demoMessage(remove ? 'Excluindo registro de teste…' : 'Salvando registro de teste…');
  try {
    if (remove) {
      await deleteDoc(demoReference(user));
      if (syncInput) syncInput.value = '';
    } else {
      await setDoc(demoReference(user), {
        value,
        marker: 'raytech-cg-cross-device-demo-v1',
        updatedAt: serverTimestamp()
      });
    }
    demoMessage('Operação confirmada pelo Firestore. Confira no outro dispositivo.');
  } catch (error) {
    demoMessage(error?.code === 'permission-denied'
      ? 'Permissão negada. Confira as regras do Firestore.'
      : 'Não foi possível confirmar a operação. Verifique a conexão.');
  } finally {
    demoBusy = false;
    demoControls(auth.currentUser);
  }
}
if (syncSave) syncSave.addEventListener('click', () => demoWrite(false));
if (syncDelete) syncDelete.addEventListener('click', () => demoWrite(true));
