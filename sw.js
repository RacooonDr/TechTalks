const CACHE_NAME = 'techtalks-v6-' + new Date().toISOString().slice(0,10);
const ASSETS = [
  '/',
  '/index.html',
  '/style.css',
  '/script.js',
  '/crypto.js',
  '/404.html',
  '/okak-cat.png',
  '/manifest.json',
  '/cache-control.js'
];

// Массив внешних ресурсов
const EXTERNAL_ASSETS = [
  'https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/css/all.min.css'
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => {
        console.log('[ServiceWorker] Caching core assets');
        return cache.addAll(ASSETS.map(url => `${url}?v=${CACHE_NAME}`));
      })
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then(cacheNames => {
      return Promise.all(
        cacheNames.map(cache => {
          if (cache !== CACHE_NAME) {
            console.log('[ServiceWorker] Removing old cache:', cache);
            return caches.delete(cache);
          }
        })
      );
    }).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET') return;

  const requestUrl = new URL(event.request.url);
  const isCoreAsset = ASSETS.some(asset =>
    requestUrl.pathname === asset.split('?')[0]
  );
  const isExternalAsset = EXTERNAL_ASSETS.some(url =>
    event.request.url.startsWith(url)
  );

  // Кэширование новостей
  if (event.request.url.includes('/api/news')) {
    event.respondWith(
      fetch(event.request)
        .then(response => {
          const clone = response.clone();
          caches.open('news-cache')
            .then(cache => cache.put(event.request, clone));
          return response;
        })
        .catch(() => caches.match(event.request))
    );
    return;
  }

  // Кэширование других API
  if (event.request.url.includes('/api/')) {
    event.respondWith(
      fetch(event.request)
        .then(response => {
          const clone = response.clone();
          caches.open('api-cache')
            .then(cache => cache.put(event.request, clone));
          return response;
        })
        .catch(() => caches.match(event.request))
    );
    return;
  }

  // Для статики используем стратегию "Сеть сначала, потом кеш"
  event.respondWith(
    fetch(event.request.clone())
      .then(networkResponse => {
        // Обновляем кеш
        if (networkResponse.ok) {
          const responseClone = networkResponse.clone();
          caches.open(CACHE_NAME).then(cache =>
            cache.put(event.request, responseClone)
          );
        }
        return networkResponse;
      })
      .catch(() => {
        // Если сеть недоступна, возвращаем из кеша
        return caches.match(event.request).then(cachedResponse => {
          if (cachedResponse) {
            return cachedResponse;
          }
          // Для HTML запросов возвращаем страницу ошибки
          if (requestUrl.pathname.endsWith('.html') || requestUrl.pathname === '/') {
            return caches.match('/404.html');
          }
          return new Response('Offline', {
            status: 503,
            headers: { 'Content-Type': 'text/plain' }
          });
        });
      })
  );
});

self.addEventListener('message', (event) => {
  if (event.data === 'skipWaiting') {
    self.skipWaiting();
  }
});