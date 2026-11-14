const CACHE_NAME = 'homolog-controle-gastos-shell-v13';
const APP_SHELL = [
  './', './index.html', './manifest.json', './css/styles.css',
  './js/state.js', './js/app.js',
  './js/services/firebaseAuth.js', './js/services/firebaseAuthLite.js', './js/services/firebaseAuthAvailability.js', './js/services/firebaseExpenseLab.js', './js/services/firebaseOfflineQueue.js',
  './js/services/firebaseFinancialPilot.mjs', './js/services/firebaseFinancialPilotModel.mjs',
  './js/services/storageService.js', './js/services/geminiService.js', './js/services/excelService.js',
  './js/onboarding.js', './js/cloudTest/state.js', './js/cloudTest/storage.js', './js/cloudTest/export.js',
  './js/cloudTest/app.js', './js/cloudTest/model.mjs', './js/cloudTest/sync.mjs', './cloud-test.html',
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
    // Do not activate an incomplete release. Versioned JS URLs defeat a stale v12 worker.
    await Promise.all(APP_SHELL.map(url => cache.add(new Request(url,{cache:'reload'}))));
    await Promise.all(APP_SHELL.filter(url=>url.startsWith('./js/')).map(url=>cache.add(new Request(url+'?v=rc1',{cache:'reload'}))));
    await Promise.allSettled(CDN_ASSETS.map(url => cache.add(url)));
    await self.skipWaiting();
  })());
});
self.addEventListener('activate', event => {
  event.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(keys.filter(key => key.startsWith('homolog-controle-gastos-shell-') && key !== CACHE_NAME && key !== 'homolog-controle-gastos-shell-v12').map(key => caches.delete(key)));
    await self.clients.claim();
  })());
});
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
    event.respondWith((async () => {
      try { const fresh = await fetch(request,{cache:'no-store'}); const cache = await caches.open(CACHE_NAME); if(fresh.ok && (url.pathname.endsWith('/index.html')||url.pathname===new URL(self.registration.scope).pathname)) await cache.put('./index.html', fresh.clone()); return fresh; }
      catch { return (await caches.match('./index.html')) || Response.error(); }
    })());
    return;
  }
  if ((url.origin===self.location.origin && url.pathname.includes('/js/') && url.searchParams.get('v')==='rc1') || url.pathname.includes('/js/cloudTest/') || (url.origin==='https://www.gstatic.com' && url.pathname.startsWith('/firebasejs/11.10.0/'))) {
    event.respondWith((async()=>{const cache=await caches.open(CACHE_NAME);const cached=await cache.match(request);if(cached)return cached;const fresh=await fetch(request,{cache:'reload'});if(fresh.ok)await cache.put(request,fresh.clone());return fresh;})());return;
  }
  event.respondWith((async () => {
    const cached = await (await caches.open(CACHE_NAME)).match(request);
    const network = fetch(request).then(response => {
      if (response && response.ok) caches.open(CACHE_NAME).then(cache => cache.put(request, response.clone()));
      return response;
    }).catch(() => cached);
    return cached || network;
  })());
});
