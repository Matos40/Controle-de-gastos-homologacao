import {cloudEntitlement} from './smartPremiumPolicy.mjs';
import {mountSmartLoginView} from './smartLoginView.mjs';
import {mountAdmin} from './smartAdminView.mjs';
import {openSmartLoginAuth} from './smartLoginOfficialAuth.mjs';
import {ORIGIN} from './config.mjs';
import {scopedStorage, readOfflineGrant, cacheOfflineGrant, revokeOfflineGrant} from './smartLoginOfficialIdentity.mjs';

const root = document.getElementById('smartLogin');
const panel = document.getElementById('smartAccountApp');
const raw = {
  getItem: key => localStorage.getItem('raytech:v34.5:' + key),
  setItem: (key, value) => localStorage.setItem('raytech:v34.5:' + key, value),
  removeItem: key => localStorage.removeItem('raytech:v34.5:' + key),
};
let auth, active, generation = 0, started = false, invoiceAllowed = false;
let unsubscribe = [];
const activeSession = uid => active === uid && auth.currentUid() === uid;
window.raytechCanUseInvoiceAI = () => !!active && activeSession(active) && invoiceAllowed && navigator.onLine;
window.raytechReserveInvoice = () => {
  if (!window.raytechCanUseInvoiceAI()) throw Error('INVOICE_DENIED');
  return auth.reserveInvoice(active);
};
const notify = () => window.dispatchEvent(new Event('raytech-ai-entitlement-changed'));
const lock = () => {
  active = null;
  invoiceAllowed = false;
  window.raytechSessionRevoked = true;
  panel.hidden = true;
  panel.inert = true;
  for (const stop of unsubscribe) stop();
  unsubscribe = [];
  notify();
};
const view = mountSmartLoginView(root, {
  signIn: () => auth.signIn(), signOut: () => auth.signOut(), onRetry: () => location.reload(),
});
const scripts = [
  'state.js', 'services/storageService.js', 'services/excelService.js',
  'ui/renderSummary.js', 'ui/renderExpenses.js', 'ui/renderCards.js',
  'ui/renderAnalytics.js', 'ui/renderHistory.js', 'app.js',
  'simulatedInvoice.js', 'onboarding.js', 'ui/categoryPicker.js',
];
async function loadScripts() {
  for (const file of scripts) await new Promise((resolve, reject) => {
    const script = document.createElement('script');
    script.src = './js/' + file;
    script.onload = resolve;
    script.onerror = reject;
    document.body.append(script);
  });
}
function blocked(uid) {
  generation++;
  revokeOfflineGrant(raw, uid);
  lock();
  view.paint({phase: 'workspace-blocked', message: 'Conta bloqueada ou autorização indisponível.'});
}
async function observe(user) {
  if (started && active && activeSession(user?.uid)) return;
  const epoch = ++generation;
  lock();
  if (started) { location.reload(); return; }
  if (!user) { view.paint({phase: 'signed-out'}); return; }
  view.paint({phase: 'checking-workspace'});
  const uid = user.uid;
  const offline = !navigator.onLine;
  const identity = {uid, original: false, prefix: 'raytech_v334_uid:' + uid + ':'};
  try {
    const [account, role] = offline
      ? (readOfflineGrant(raw, uid), [null, null])
      : await Promise.all([auth.profile(uid), auth.role(uid)]);
    if (generation !== epoch || auth.currentUid() !== uid) return;
    if (account?.blocked) { blocked(uid); return; }
    if (!offline) cacheOfflineGrant(raw, identity);
    const avatar = document.getElementById('v345Avatar');
    const label = user.displayName || account?.name || 'Conta de teste';
    avatar.textContent = label.trim().split(/\s+/).slice(0, 2).map(part => part[0]).join('').toUpperCase();
    if (location.protocol === 'https:' && user.photoURL) {
      try {
        const photo = new URL(user.photoURL);
        if (photo.origin === 'https://lh3.googleusercontent.com' && !photo.username && !photo.password) {
          const image = document.createElement('img');
          image.alt = '';
          image.referrerPolicy = 'no-referrer';
          image.onload = () => { if (activeSession(uid)) avatar.replaceChildren(image); };
          image.src = photo.href;
        }
      } catch {}
    }
    const paintPlan = plan => {
      const cloudPlan = role ? 'premium' : plan;
      window.raytechCloudEntitlement = cloudEntitlement({plan: cloudPlan, role, verified: !offline});
      invoiceAllowed = !offline && (plan === 'premium' || !!role);
      document.getElementById('v345Identity').textContent =
        label + ' · ' +
        (role === 'owner' ? 'Owner' : role === 'admin' ? 'Admin' : plan === 'premium' ? 'Premium' : 'Free');
      notify();
    };
    active = uid;
    window.raytechSessionRevoked = false;
    window.raytechStorage = scopedStorage(raw, identity, activeSession);
    paintPlan(account?.plan);
    started = true;
    await loadScripts();
    if (generation !== epoch || !activeSession(uid)) return;
    await import('./preview.mjs');
    await import('./cloudPanel.mjs');
    if (generation !== epoch || !activeSession(uid)) return;
    const logout = async event => {
      event?.stopImmediatePropagation();
      generation++;
      revokeOfflineGrant(raw, uid);
      lock();
      try { await auth.signOut(); location.reload(); }
      catch { view.paint({phase: 'workspace-blocked', message: 'Não foi possível sair. Tente novamente.'}); }
    };
    document.getElementById('v345Logout').addEventListener('click', logout);
    document.getElementById('productionCloudLogout')?.addEventListener('click', logout, {capture: true});
    if (offline) window.addEventListener('online', () => { lock(); location.reload(); }, {once: true});
    else {
      let plan = account.plan;
      unsubscribe.push(auth.watchAccount(uid, record => {
        if (!record || record.blocked !== false) blocked(uid);
        else if (record.plan !== plan) {
          plan = record.plan;
          paintPlan(plan);
          window.dispatchEvent(new Event('raytech-plan-changed'));
        }
      }, () => blocked(uid)));
      unsubscribe.push(auth.watchRole(uid, current => {
        if (current !== role) { lock(); location.reload(); }
      }, () => blocked(uid)));
      if (role) unsubscribe.push(mountAdmin({api: auth.admin(uid), role, uid}));
    }
    window.dispatchEvent(new Event('raytech-account-start'));
    document.dispatchEvent(new Event('raytech-account-start'));
    if (generation !== epoch || !activeSession(uid)) return;
    panel.hidden = false;
    panel.inert = false;
    view.paint({phase: 'ready'});
  } catch (error) {
    if (generation === epoch) {
      console.error('[V34.5]', error);
      blocked(uid);
    }
  }
}
if (location.origin === ORIGIN) {
  const form = document.getElementById('labCredentials');
  form.hidden = false;
  form.onsubmit = event => {
    event.preventDefault();
    root.querySelector('[data-login-enter]').click();
  };
  root.querySelector('[data-login-enter]').textContent = 'Entrar no laboratório';
}
try {
  auth = await openSmartLoginAuth();
  auth.onSession(user => void observe(user), () => { lock(); view.paint({phase: 'error'}); });
} catch (error) {
  console.error('[V34.5]', error);
  view.paint({phase: 'error'});
}
