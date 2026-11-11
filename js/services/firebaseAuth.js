/* Firebase Authentication — homologação. Não lê nem envia dados financeiros. */
import { initializeApp } from 'https://www.gstatic.com/firebasejs/11.10.0/firebase-app.js';
import {
  getAuth, GoogleAuthProvider, signInWithPopup, signOut, onAuthStateChanged
} from 'https://www.gstatic.com/firebasejs/11.10.0/firebase-auth.js';

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
auth.languageCode = 'pt-BR';
const provider = new GoogleAuthProvider();
provider.setCustomParameters({ prompt: 'select_account' });

const status = document.getElementById('firebaseAuthStatus');
const login = document.getElementById('firebaseLoginButton');
const logout = document.getElementById('firebaseLogoutButton');
const account = document.getElementById('firebaseAccount');
let busy = false;

function render(user, message) {
  if (status) status.textContent = message || (user ? 'Conectado ao Firebase de homologação' : 'Não conectado à nuvem');
  if (account) account.textContent = user ? (user.displayName || user.email || 'Conta Google') : '';
  if (login) { login.classList.toggle('hidden', Boolean(user)); login.disabled = busy; }
  if (logout) { logout.classList.toggle('hidden', !user); logout.disabled = busy; }
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
