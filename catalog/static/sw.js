// Registered with scope /qurator only. It caches the offline page and its
// icon and nothing else: app chunks are content-hashed and redeployed often, and
// a cached shell would pin an installed app to a stale build.
const CACHE = 'qurator-offline-v1'
const OFFLINE = '/qurator-offline.html'
const ICON = '/qurator-192.png'

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll([OFFLINE, ICON])))
  self.skipWaiting()
})

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(
          keys
            .filter((k) => k.startsWith('qurator-') && k !== CACHE)
            .map((k) => caches.delete(k)),
        ),
      )
      .then(() => self.clients.claim()),
  )
})

self.addEventListener('fetch', (e) => {
  // The offline page's own icon request, which would fail offline too.
  if (new URL(e.request.url).pathname === ICON) {
    e.respondWith(caches.match(ICON).then((r) => r || fetch(e.request)))
    return
  }
  if (e.request.mode !== 'navigate') return
  e.respondWith(fetch(e.request).catch(() => caches.match(OFFLINE)))
})
