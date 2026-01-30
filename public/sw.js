const CACHE_NAME = 'lmb-barberia-v1';
const urlsToCache = [
  '/',
  '/manifest.json',
  // NO cacheamos APIs de Supabase para permitir datos en tiempo real
];

self.addEventListener('install', function(event) {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(function(cache) {
        return cache.addAll(urlsToCache);
      })
  );
});

self.addEventListener('fetch', function(event) {
  const url = new URL(event.request.url);
  
  // NO interceptar peticiones a Supabase (APIs externas)
  if (url.hostname.includes('supabase')) {
    event.respondWith(fetch(event.request));
    return;
  }
  
  // Para el resto, usar cache con fallback a red
  event.respondWith(
    caches.match(event.request)
      .then(function(response) {
        // Cache hit - return response
        if (response) {
          return response;
        }
        return fetch(event.request);
      }
    )
  );
});
