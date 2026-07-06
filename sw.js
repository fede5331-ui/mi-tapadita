const CACHE_NAME = 'mi-tapadita-v2';
const ARCHIVOS = [
  '/',
  '/index.html',
  '/app.html',
  '/style.css',
  '/app.js',
  '/supabase.js'
];

self.addEventListener('install', function(e) {
  self.skipWaiting(); // no esperar a que se cierren las pestañas viejas
  e.waitUntil(
    caches.open(CACHE_NAME).then(function(cache) {
      return cache.addAll(ARCHIVOS);
    })
  );
});

self.addEventListener('activate', function(e) {
  e.waitUntil(
    caches.keys().then(function(nombres) {
      return Promise.all(
        nombres
          .filter(function(nombre) { return nombre !== CACHE_NAME; })
          .map(function(nombre) { return caches.delete(nombre); })
      );
    }).then(function() {
      return self.clients.claim(); // tomar control inmediato de las pestañas abiertas
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