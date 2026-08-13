/*
 * Service worker do DoseCerta.
 *
 * Estratégia: NETWORK-FIRST com fallback para cache.
 *
 * Cache-first puro congelaria o shell do app: uma vez cacheado o index.html e
 * o bundle, eles seguiriam sendo servidos para sempre — inclusive depois de
 * deploys com correção de bug — até alguém trocar o nome do cache na mão.
 *
 * Suba CACHE_NAME junto com qualquer correção relevante.
 */
const CACHE_NAME = 'dosecerta-v2';
const SHELL = ['/', '/index.html', '/manifest.webmanifest', '/icons/icon.svg'];

self.addEventListener('install', (evento) => {
  evento.waitUntil(
    caches
      .open(CACHE_NAME)
      .then((cache) => cache.addAll(SHELL))
      .then(() => self.skipWaiting()),
  );
});

self.addEventListener('activate', (evento) => {
  evento.waitUntil(
    caches
      .keys()
      .then((nomes) =>
        Promise.all(nomes.filter((nome) => nome !== CACHE_NAME).map((nome) => caches.delete(nome))),
      )
      .then(() => self.clients.claim()),
  );
});

self.addEventListener('fetch', (evento) => {
  const { request } = evento;

  if (request.method !== 'GET') return;

  const url = new URL(request.url);
  // Só cuidamos da própria origem. Firebase e afins têm o próprio offline.
  if (url.origin !== self.location.origin) return;

  evento.respondWith(
    fetch(request)
      .then((resposta) => {
        if (resposta && resposta.status === 200 && resposta.type === 'basic') {
          const copia = resposta.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(request, copia));
        }
        return resposta;
      })
      .catch(async () => {
        const emCache = await caches.match(request);
        if (emCache) return emCache;
        // Navegação offline sem cache do recurso: devolve o shell.
        if (request.mode === 'navigate') {
          const shell = await caches.match('/index.html');
          if (shell) return shell;
        }
        return Response.error();
      }),
  );
});
