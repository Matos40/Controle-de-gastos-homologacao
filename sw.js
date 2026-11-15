const CACHE_NAME = 'homolog-controle-gastos-shell-v18';
const APP_SHELL = [
  './', './index.html', './manifest.json', './css/styles.css',
  './js/state.js', './js/app.js',
  './js/services/firebaseAuth.js', './js/services/firebaseAuthLite.js', './js/services/firebaseAuthAvailability.js', './js/services/firebaseExpenseLab.js', './js/services/firebaseOfflineQueue.js',
  './js/services/firebaseFinancialPilot.mjs', './js/services/firebaseFinancialPilotModel.mjs',
  './js/services/storageService.js', './js/services/geminiService.js', './js/services/excelService.js',
  './js/onboarding.js', './js/cloudTest/state.js', './js/cloudTest/storage.js', './js/cloudTest/export.js',
  './js/cloudTest/app.js', './js/cloudTest/model.mjs', './js/cloudTest/capacityV2.mjs', './js/cloudTest/sync.mjs', './cloud-test.html',
  './js/ui/renderSummary.js', './js/ui/renderExpenses.js', './js/ui/renderCards.js',
  './js/ui/renderAnalytics.js', './js/ui/renderHistory.js'
];
const CDN_ASSETS = [
  'https://www.gstatic.com/firebasejs/11.10.0/firebase-app.js',
  'https://www.gstatic.com/firebasejs/11.10.0/firebase-auth.js',
  'https://www.gstatic.com/firebasejs/11.10.0/firebase-firestore.js',
  'https://cdn.tailwindcss.com',
  'https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/css/all.min.css',
  'https://cdn.jsdelivr.net/npm/xlsx@0.18.5/dist/xlsx.full.min.js',
  'https://cdn.jsdelivr.net/npm/chart.js@4.4.1/dist/chart.umd.min.js',
  'https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800&display=swap'
];
self.addEventListener('install', event => {
  event.waitUntil((async () => {
    const cache = await caches.open(CACHE_NAME);
    // Do not activate an incomplete release. Versioned JS URLs defeat a stale worker.
    await Promise.all(APP_SHELL.map(url => cache.add(new Request(url,{cache:'reload'}))));
    await Promise.all(APP_SHELL.filter(url=>url.startsWith('./js/')).map(url=>cache.add(new Request(url+'?v=v2hotfix1',{cache:'reload'}))));
    await Promise.allSettled(CDN_ASSETS.map(url => cache.add(url)));
    await self.skipWaiting();
  })());
});
self.addEventListener('activate', event => {
  event.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(keys.filter(key => key.startsWith('homolog-controle-gastos-shell-') && key !== CACHE_NAME && key !== 'homolog-controle-gastos-shell-v15' && key !== 'homolog-controle-gastos-shell-v16' && key !== 'homolog-controle-gastos-shell-v17').map(key => caches.delete(key)));
    await self.clients.claim();
  })());
});
// Keep the installed HTML paired with the modules of the same release.
async function navigateShell(request) {
  const cache = await caches.open(CACHE_NAME).catch(() => null);
  const shell = () => cache ? cache.match('./index.html').catch(() => undefined) : Promise.resolve(undefined);
  if (self.navigator?.onLine === false) return (await shell()) || Response.error();
  const controller = new AbortController();
  let timer;
  try {
    const fresh = await Promise.race([
      fetch(request,{cache:'no-store',signal:controller.signal}),
      new Promise((_,reject) => { timer=setTimeout(() => { reject(Error('NAVIGATION_TIMEOUT'));controller.abort(); },3500); })
    ]);
    if(fresh.ok)return fresh;
    return (await shell()) || fresh;
  } catch {
    return (await shell()) || Response.error();
  } finally {
    if(timer!==undefined)clearTimeout(timer);
  }
}
self.addEventListener('fetch', event => {
  const request = event.request;
  if (request.method !== 'GET') return;
  const url = new URL(request.url);
  if (url.origin !== self.location.origin && !CDN_ASSETS.some(asset => request.url.startsWith(asset.split('?')[0]))) return;
  if (url.origin === self.location.origin && !url.pathname.startsWith(new URL(self.registration.scope).pathname)) return;
  // Both modes use the identical shell. Legacy URL only redirects; never cache it as index.
  if (request.mode === 'navigate' && url.pathname.endsWith('/cloud-test.html')) {
    event.respondWith(Promise.resolve(Response.redirect(new URL('./index.html?mode=cloud', self.registration.scope).href,302)));
    return;
  }
  if (request.mode === 'navigate') {
    event.respondWith(navigateShell(request));
    return;
  }
  if ((url.origin===self.location.origin && url.pathname.includes('/js/') && url.searchParams.get('v')==='v2hotfix1') || url.pathname.includes('/js/cloudTest/') || (url.origin==='https://www.gstatic.com' && url.pathname.startsWith('/firebasejs/11.10.0/'))) {
    event.respondWith((async()=>{const cache=await caches.open(CACHE_NAME);const cached=await cache.match(request);if(cached)return cached;const fresh=await fetch(request,{cache:'reload'});if(fresh.ok)await cache.put(request,fresh.clone());return fresh;})());return;
  }
  // Clone synchronously before the browser can consume the original body.
  // Keep cache refresh alive on hits and isolate cache write failures from the response.
  const cache = caches.open(CACHE_NAME);
  const cached = cache.then(c => c.match(request)).catch(() => undefined);
  const network = fetch(request).then(response => ({response, copy: response.ok ? response.clone() : null}));
  event.waitUntil(network.then(({copy}) => copy ? cache.then(c => c.put(request, copy)) : undefined).catch(() => {}));
  event.respondWith(cached.then(hit => hit || network.then(({response}) => response).catch(() => Response.error())));
});
