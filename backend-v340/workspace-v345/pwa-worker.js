// The build injects the full immutable inventory before this script.
const prefix = 'raytech-cg-homologacao-pwa:';
const cacheName = prefix + BUILD.id;
const allowedOrigins = new Set([
  'https://raytech-cg-homologacao.web.app',
  'https://raytech-cg-homologacao.firebaseapp.com',
  'http://127.0.0.1:15003',
]);
const origin = self.location.origin;
if (!allowedOrigins.has(origin) || self.registration.scope !== origin + '/') {
  throw Error('PWA_SCOPE_MISMATCH');
}
const inventory = new Map(BUILD.files);
const digest = async bytes => Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',bytes)),
  byte => byte.toString(16).padStart(2,'0')).join('');

self.addEventListener('install', event => {
  event.waitUntil((async () => {
    const cache = await caches.open(cacheName);
    const entries = [...inventory.entries()];
    let cursor = 0;
    const results = await Promise.allSettled(Array.from({length: 8}, async () => {
      while (cursor < entries.length) {
        const [url, expected] = entries[cursor++];
        const response = await fetch(url,{cache:'reload',credentials:'omit',redirect:'error'});
        if (!response.ok || await digest(await response.clone().arrayBuffer()) !== expected) {
          throw Error('PWA_INCOMPLETE_BUILD');
        }
        await cache.put(url,response);
      }
    }));
    if (results.some(result => result.status === 'rejected')) {
      await caches.delete(cacheName);
      throw Error('PWA_INCOMPLETE_BUILD');
    }
  })());
});
self.addEventListener('activate', event => {
  event.waitUntil((async () => {
    for (const name of await caches.keys()) {
      if (name.startsWith(prefix) && name !== cacheName) await caches.delete(name);
    }
    await self.clients.claim();
  })());
});
self.addEventListener('fetch', event => {
  const request = event.request, url = new URL(request.url);
  if (request.method !== 'GET' || url.origin !== origin) return;
  const isShell = request.mode === 'navigate' && ['/', '/index.html'].includes(url.pathname);
  const key = isShell ? '/index.html' : url.pathname;
  if (!inventory.has(key)) return;
  event.respondWith((async () => {
    // A pinned shell cannot mix financial scripts from different releases.
    const cached = await (await caches.open(cacheName)).match(key);
    return cached || new Response('Arquivos locais indisponíveis. Reconecte para preparar o aplicativo.',{status:503});
  })());
});
