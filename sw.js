const CACHE_NAME = 'mi-tapadita-v1';
const ARCHIVOS = [
  '/',
  '/index.html',
  '/app.html',
  '/style.css',
  '/app.js',
  '/supabase.js'
];

self.addEventListener('install', function(e) {
  e.waitUntil(
    caches.open(CACHE_NAME).then(function(cache) {
      return cache.addAll(ARCHIVOS);
    })
  );
});

self.addEventListener('fetch', function(e) {
  e.respondWith(
    caches.match(e.request).then(function(respuesta) {
      return respuesta || fetch(e.request);
    })
  );
});