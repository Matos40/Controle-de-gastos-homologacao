const CACHE_NAME = 'homolog-controle-gastos-shell-v4';
const APP_SHELL = [
  './', './index.html', './manifest.json', './css/styles.css',
  './js/state.js', './js/app.js',
  './js/services/firebaseAuth.js', './js/services/firebaseExpenseLab.js', './js/services/firebaseOfflineQueue.js',
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
    await Promise.allSettled(APP_SHELL.map(url => cache.add(url)));
    await Promise.allSettled(CDN_ASSETS.map(url => cache.add(url)));
    await self.skipWaiting();
  })());
});
self.addEventListener('activate', event => {
  event.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(keys.filter(key => key.startsWith('homolog-controle-gastos-shell-') && key !== CACHE_NAME).map(key => caches.delete(key)));
    await self.clients.claim();
  })());
});
self.addEventListener('fetch', event => {
  const request = event.request;
  if (request.method !== 'GET') return;
  const url = new URL(request.url);
  if (url.origin !== self.location.origin && !CDN_ASSETS.some(asset => request.url.startsWith(asset.split('?')[0]))) return;
  if (url.origin === self.location.origin && !url.pathname.startsWith(new URL(self.registration.scope).pathname)) return;
  if (request.mode === 'navigate') {
    event.respondWith((async () => {
      try { const fresh = await fetch(request); const cache = await caches.open(CACHE_NAME); cache.put('./index.html', fresh.clone()); return fresh; }
      catch { return (await caches.match('./index.html')) || Response.error(); }
    })());
    return;
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
