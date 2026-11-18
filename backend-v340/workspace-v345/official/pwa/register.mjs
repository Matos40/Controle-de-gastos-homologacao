const allowed = new Set([
  'https://raytech-cg-homologacao.web.app',
  'https://raytech-cg-homologacao.firebaseapp.com',
  'http://127.0.0.1:15003',
]);
let installEvent, registration, phase = 'preparing';
const publish = next => {
  phase = next;
  window.dispatchEvent(new CustomEvent('raytech-pwa-state',{detail:snapshot()}));
};
const snapshot = () => Object.freeze({
  version:'34.7.4.1', phase, canInstall: !!installEvent,
  standalone: matchMedia('(display-mode: standalone)').matches || navigator.standalone === true,
});
window.raytechPwa = Object.freeze({
  state: snapshot,
  async install() {
    if (!installEvent) return {outcome:'unavailable'};
    const prompt = installEvent;
    installEvent = null;
    try { return await prompt.prompt(); }
    finally {publish(phase);}
  },
  async checkUpdate() {
    if (registration && navigator.onLine) {await registration.update(); if(registration.waiting)publish('update-waiting');}
    return snapshot();
  },
});
window.addEventListener('beforeinstallprompt', event => {
  event.preventDefault();
  installEvent = event;
  publish(phase);
});
window.addEventListener('appinstalled', () => {
  installEvent = null;
  publish(phase);
});
if (allowed.has(location.origin) && navigator.serviceWorker) {
  try {
    registration = await navigator.serviceWorker.register('/raytech-pwa-sw.js',{scope:'/',updateViaCache:'none'});
    const refresh = () => {
      if (registration.waiting) publish('update-waiting');
      else if (registration.active?.state === 'activated') publish('ready');
      else publish('preparing');
    };
    const watch = () => {
      const worker = registration.installing;
      worker?.addEventListener('statechange', () => {
        if (worker.state === 'redundant') publish(registration.active ? 'update-failed' : 'unavailable');
        else refresh();
      });
      refresh();
    };
    registration.addEventListener('updatefound',watch);
    navigator.serviceWorker.addEventListener('controllerchange',refresh);
    watch();
    if(navigator.onLine)void registration.update().catch(()=>{});
    document.addEventListener('visibilitychange',()=>{if(document.visibilityState==='visible'&&navigator.onLine)void registration.update().catch(()=>{});});
  } catch { publish('unavailable'); }
} else publish('unavailable');
