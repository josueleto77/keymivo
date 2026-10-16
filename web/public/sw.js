// Keymivo service worker: keeps the app shell available offline (e.g. in a basement during a showing).
// Navigations: network first, fall back to the cached shell. Built assets (/assets/*, hashed): cache first.
// API calls to Supabase are never cached here — offline captures go through the in-app IndexedDB queue.
const CACHE = 'keymivo-shell-v2'
const SHELL = ['/', '/index.html', '/manifest.webmanifest', '/icon.svg', '/favicon.svg']

self.addEventListener('install', (event) => {
  event.waitUntil(caches.open(CACHE).then((c) => c.addAll(SHELL)).then(() => self.skipWaiting()))
})

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)))).then(() => self.clients.claim()),
  )
})

self.addEventListener('fetch', (event) => {
  const req = event.request
  if (req.method !== 'GET') return
  const url = new URL(req.url)
  if (url.origin !== self.location.origin) return
  // Server-handled paths (OAuth callbacks, domain verification) must always reach the network untouched.
  if (url.pathname.startsWith('/oauth/') || url.pathname.startsWith('/.well-known/')) return

  if (req.mode === 'navigate') {
    event.respondWith(
      fetch(req)
        .then((res) => {
          // Only a real app page may replace the cached shell (never a redirect or an error page).
          if (res.ok && res.type === 'basic' && (res.headers.get('content-type') || '').includes('text/html')) {
            const copy = res.clone()
            caches.open(CACHE).then((c) => c.put('/index.html', copy))
          }
          return res
        })
        .catch(() => caches.match('/index.html')),
    )
    return
  }

  if (url.pathname.startsWith('/assets/')) {
    event.respondWith(
      caches.match(req).then((hit) => hit || fetch(req).then((res) => {
        const copy = res.clone()
        caches.open(CACHE).then((c) => c.put(req, copy))
        return res
      })),
    )
  }
})
