const CACHE_NAME = 'raytech-hml-smart326-shell-v1';
const APP_SHELL = [
  './', './index.html', './manifest.json', './favicon.ico', './raytech-icon-192.png', './raytech-icon-512.png', './css/styles.css',
  './js/state.js', './js/app.js', './js/onboarding.js', './js/ui/categoryPicker.js', './js/productionV2/preview.mjs', './js/productionV2/legacyPhase2.mjs', './js/productionV2/cleanWorkspace.mjs', './js/productionV2/model.mjs', './js/productionV2/cloudPanel.mjs', './js/productionV2/eventRuntime.mjs', './js/productionV2/initialTransfer.mjs', './js/productionV2/config.mjs', './js/productionV2/queue.mjs', './js/productionV2/capacity.mjs', './js/productionV2/firebaseAdapter.mjs', './js/productionV2/syncEngine.mjs', './js/experimentalSync/session.mjs', './js/experimentalSync/engine.mjs', './js/experimentalSync/history.mjs', './js/experimentalSync/runtime.mjs', './js/experimentalSync/backupFiles.mjs',
  './js/services/storageService.js', './js/services/geminiService.js', './js/services/excelService.js',
  './js/ui/renderSummary.js', './js/ui/renderExpenses.js', './js/ui/renderCards.js',
  './js/ui/renderAnalytics.js', './js/ui/renderHistory.js'
];
const CDN_ASSETS = [
  'https://cdn.tailwindcss.com',
  'https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/css/all.min.css',
  'https://cdn.jsdelivr.net/npm/xlsx@0.18.5/dist/xlsx.full.min.js',
  'https://cdn.jsdelivr.net/npm/chart.js@4.4.1/dist/chart.umd.min.js',
  'https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800&display=swap'
];
self.addEventListener('install', event => {
  event.waitUntil((async () => {
    const cache = await caches.open(CACHE_NAME);
    await Promise.all(APP_SHELL.map(url => cache.add(new Request(url,{cache:'reload'}))));
    await Promise.allSettled(CDN_ASSETS.map(url => cache.add(url)));
    await self.skipWaiting();
  })());
});
self.addEventListener('activate', event => {
  event.waitUntil((async () => {
    // Preserve old shell caches and cross-app caches. Asset caches do not contain the financial database.
    // No cache deletion is performed by this release.
    await self.clients.claim();
  })());
});
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
  if (request.mode === 'navigate') {
    event.respondWith(navigateShell(request));
    return;
  }
  const cache = caches.open(CACHE_NAME);
  const cached = cache.then(c => c.match(request)).catch(() => undefined);
  const network = fetch(request).then(response => ({response, copy: response.ok ? response.clone() : null}));
  event.waitUntil(network.then(({copy}) => copy ? cache.then(c => c.put(request, copy)) : undefined).catch(() => {}));
  event.respondWith(cached.then(hit => hit || network.then(({response}) => response).catch(() => Response.error())));
});
