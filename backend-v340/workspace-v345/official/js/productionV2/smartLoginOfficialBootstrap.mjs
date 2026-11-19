import {cloudEntitlement} from './smartPremiumPolicy.mjs';
import {mountSmartLoginView} from './smartLoginView.mjs';
import {mountAdmin} from './smartAdminView.mjs';
import {openSmartLoginAuth} from './smartLoginOfficialAuth.mjs';
import {ORIGIN} from './config.mjs';
import {verifyOfflineAccess,recordOfflineAccess} from './pwaOfflineAccess.mjs';
import {scopedStorage, revokeOfflineGrant} from './smartLoginOfficialIdentity.mjs';

const root = document.getElementById('smartLogin');
const panel = document.getElementById('smartAccountApp');
const headerProfile = panel.querySelector('.v345-account');
const cloudProfile = document.getElementById('productionCloudProfile');
const cloudLogout = document.getElementById('productionCloudLogout');
const incomeHelpToggle = document.getElementById('incomeBaseHelpToggle');
incomeHelpToggle.addEventListener('click', () => {
  const help = document.getElementById('incomeBaseHelp');
  help.hidden = !help.hidden;
  incomeHelpToggle.setAttribute('aria-expanded', String(!help.hidden));
});
const storagePrefix=location.origin===ORIGIN?'raytech:v34.5:':'raytech:hml34741:';
const raw = {
  getItem: key => localStorage.getItem(storagePrefix + key),
  setItem: (key, value) => localStorage.setItem(storagePrefix + key, value),
  removeItem: key => localStorage.removeItem(storagePrefix + key),
};
let auth, active, generation = 0, started = false, invoiceAllowed = false;
let invoicePlan, invoiceVerified = false;
let unsubscribe = [];
const activeSession = uid => active === uid && auth.currentUid() === uid;
window.raytechCanUseInvoiceAI = () => !!active && activeSession(active) && invoiceAllowed && navigator.onLine;
window.raytechInvoiceState = () => {
  if (!active || !activeSession(active)) return {visible: false, premium: false, reason: ''};
  const executable = window.raytechCanUseInvoiceAI();
  return {visible: true, premium: invoicePlan === 'premium' || executable,
    reason: executable ? '' : !invoiceVerified || !navigator.onLine ? 'Leitor indisponível offline.' :
      'O processamento de IA está desativado na homologação online.'};
};
window.raytechExtractInvoice = () => {
  if (!window.raytechCanUseInvoiceAI()) throw Error('INVOICE_DENIED');
  return auth.extractInvoice(active);
};
window.raytechAuthorizeInvoice = () => {
  if (!window.raytechCanUseInvoiceAI()) throw Error('INVOICE_DENIED');
  return auth.authorizeInvoice(active);
};
const notify = () => window.dispatchEvent(new Event('raytech-ai-entitlement-changed'));
const lock = () => {
  active = null;
  invoiceAllowed = false;
  invoiceVerified = false;
  window.raytechSessionRevoked = true;
  headerProfile.hidden = cloudProfile.hidden = true;
  cloudLogout.disabled = true;
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
  let offline = !navigator.onLine;
  const identity = {uid, original: false, prefix: 'raytech_v334_uid:' + uid + ':'};
  try {
    let account = null, role = null, expires, accessVerified = false;
    if (!offline) {
      try { [account,role] = await Promise.all([auth.profile(uid),auth.role(uid)]); }
      catch (error) {
        if (!['unavailable','deadline-exceeded','auth/network-request-failed'].includes(error.code)) throw error;
        offline = true;
      }
    }
    if (generation !== epoch || auth.currentUid() !== uid) return;
    if (!offline && account?.blocked !== false) { blocked(uid); return; }
    if (!offline) { recordOfflineAccess(raw,uid); accessVerified = true; }
    expires = verifyOfflineAccess(raw,uid);
    let stopAdmin = () => {}, deadline = null;
    const offlineSession = () => offline || !navigator.onLine || !accessVerified;
    const avatar = document.getElementById('v345Avatar');
    const label = user.displayName || account?.name || 'Conta de teste';
    avatar.textContent = label.trim().split(/\s+/).slice(0, 2).map(part => part[0]).join('').toUpperCase();
    const cloudPhoto = document.getElementById('productionCloudPhoto');
    const cloudInitial = document.getElementById('productionCloudInitial');
    cloudInitial.textContent = avatar.textContent;
    document.getElementById('productionCloudName').textContent = user.displayName || user.email || 'Conta Google';
    document.getElementById('productionCloudGuest').hidden = true;
    cloudProfile.hidden = cloudLogout.disabled = false;
    cloudProfile.classList.add('flex');
    if (!offline && location.protocol === 'https:' && user.photoURL) {
      try {
        const photo = new URL(user.photoURL);
        if (photo.origin === 'https://lh3.googleusercontent.com' && !photo.username && !photo.password) {
          const image = document.createElement('img');
          image.alt = '';
          image.referrerPolicy = 'no-referrer';
          image.onload = () => { if (activeSession(uid)) avatar.replaceChildren(image); };
          image.src = photo.href;
          cloudPhoto.onload = () => { if (activeSession(uid)) { cloudPhoto.hidden = false; cloudInitial.hidden = true; } };
          cloudPhoto.onerror = () => { cloudPhoto.hidden = true; cloudInitial.hidden = false; };
          cloudPhoto.src = photo.href;
        }
      } catch {}
    }
    const paintPlan = plan => {
      const cloudPlan = role ? 'premium' : plan;
      window.raytechCloudEntitlement = cloudEntitlement({plan: cloudPlan, role, verified: !!account});
      invoiceAllowed = auth.invoiceBackendAvailable && accessVerified && (plan === 'premium' || !!role);
      invoicePlan = plan;
      invoiceVerified = accessVerified;
      headerProfile.hidden = !accessVerified || !['owner','admin'].includes(role);
      if (headerProfile.hidden) headerProfile.querySelector('details').open = false;
      document.getElementById('productionCloudPlanLabel').textContent = plan === 'premium' ? 'Premium' : plan === 'free' ? 'Free' : 'Plano não verificado offline';
      document.getElementById('productionCloudPremiumGreeting').hidden = plan !== 'premium';
      document.getElementById('v345Identity').textContent =
        label + ' · ' +
        (role === 'owner' ? 'Owner' : role === 'admin' ? 'Admin' : plan === 'premium' ? 'Premium' : 'Free');
      notify();
    };
    active = uid;
    window.raytechSessionRevoked = false;
    window.raytechStorage = scopedStorage(raw, identity, who => activeSession(who) &&
      (!offlineSession() || Date.now() < expires));
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
    cloudLogout.addEventListener('click', logout, {capture: true});
    const cancelDeadline = () => { if (deadline !== null) clearTimeout(deadline); deadline = null; };
    const expireIfNecessary = () => {
      if (activeSession(uid) && offlineSession() && Date.now() >= expires) blocked(uid);
    };
    const scheduleExpiry = () => {
      cancelDeadline();
      expireIfNecessary();
      if (activeSession(uid) && offlineSession()) deadline = setTimeout(expireIfNecessary, Math.max(1,expires-Date.now()));
    };
    let stopWatch = [], revalidating = false;
    const detach = () => { for (const stop of stopWatch) stop(); stopWatch = []; stopAdmin(); stopAdmin = () => {}; };
    const watch = () => {
      detach();
      const refreshed = () => { recordOfflineAccess(raw,uid); expires = verifyOfflineAccess(raw,uid); };
      stopWatch = [
        auth.watchAccount(uid, record => {
          if (!activeSession(uid) || !navigator.onLine) return;
          if (!record || record.blocked !== false) { blocked(uid); return; }
          refreshed();
          if (record.plan !== account.plan) {
            account = record;
            paintPlan(account.plan);
            window.dispatchEvent(new Event('raytech-plan-changed'));
          }
        }, () => blocked(uid),goOffline),
        auth.watchRole(uid, current => {
          if (!activeSession(uid) || !navigator.onLine) return;
          if (current !== role) { lock(); location.reload(); }
        }, () => blocked(uid),goOffline),
      ];
      if (role) stopAdmin = mountAdmin({api:auth.admin(uid),role,uid});
    };
    const goOffline = () => {
      if (!activeSession(uid)) return;
      offline = true; accessVerified = false; invoiceAllowed = false; invoiceVerified = false;
      headerProfile.hidden = true;
      window.raytechOnlineAuthorizationPending = true;
      detach();
      notify();
      scheduleExpiry();
    };
    const revalidate = async () => {
      if (!activeSession(uid) || !navigator.onLine || revalidating || accessVerified) return;
      revalidating = true;
      try {
        const [fresh, currentRole] = await Promise.all([auth.profile(uid),auth.role(uid)]);
        if (!activeSession(uid) || !navigator.onLine) return;
        if (fresh?.blocked !== false) { blocked(uid); return; }
        const changed = fresh.plan !== account?.plan || currentRole !== role;
        account = fresh; role = currentRole; offline = false; accessVerified = true;
        recordOfflineAccess(raw,uid); expires = verifyOfflineAccess(raw,uid); cancelDeadline();
        window.raytechOnlineAuthorizationPending = false;
        paintPlan(account.plan);
        watch();
        if (changed) window.dispatchEvent(new Event('raytech-plan-changed'));
        window.dispatchEvent(new Event('raytech-online-verified'));
      } catch (error) {
        if (!activeSession(uid)) return;
        if (['unavailable','deadline-exceeded','auth/network-request-failed'].includes(error.code)) scheduleExpiry();
        else blocked(uid);
      } finally { revalidating = false; }
    };
    window.raytechOnlineAuthorizationPending = offline;
    window.addEventListener('offline',goOffline);
    window.addEventListener('online',revalidate);
    const revalidateVisible = () => {
      scheduleExpiry();
      if (document.visibilityState === 'visible') void revalidate();
    };
    document.addEventListener('visibilitychange',revalidateVisible);
    // A browser can report "online" with no route to Firestore.
    const retryAccess = setInterval(()=>{if(!accessVerified)void revalidate();},30000);
    unsubscribe.push(()=>{
      clearInterval(retryAccess);cancelDeadline();detach();
      window.removeEventListener('offline',goOffline);
      window.removeEventListener('online',revalidate);
      document.removeEventListener('visibilitychange',revalidateVisible);
    });
    if (offline) scheduleExpiry(); else watch();
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
