// Service worker mínimo — só existe pra permitir "Instalar app" no Chrome/Android.
// Nunca intercepta API, uploads nem o socket — só ajuda a carregar mais rápido
// o "esqueleto" visual do site (arquivos JS/CSS/HTML fixos).
const CACHE_NAME = "chat-nacional-v1";

self.addEventListener("install", () => {
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((nomes) =>
      Promise.all(nomes.filter((n) => n !== CACHE_NAME).map((n) => caches.delete(n)))
    )
  );
  self.clients.claim();
});

self.addEventListener("fetch", (event) => {
  const { request } = event;
  if (request.method !== "GET") return;

  const url = new URL(request.url);
  // Nunca mexe em API, upload de arquivo ou na conexão em tempo real
  if (
    url.pathname.startsWith("/api/") ||
    url.pathname.startsWith("/socket.io/") ||
    url.pathname.startsWith("/uploads/")
  ) {
    return;
  }

  event.respondWith(
    caches.match(request).then((cached) => {
      const buscaDaRede = fetch(request)
        .then((resposta) => {
          if (resposta.ok) {
            const copia = resposta.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(request, copia));
          }
          return resposta;
        })
        .catch(() => cached);
      return cached || buscaDaRede;
    })
  );
});
