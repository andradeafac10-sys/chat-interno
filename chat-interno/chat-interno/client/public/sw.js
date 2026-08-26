// Service worker mínimo — só existe pra permitir "Instalar app" no Chrome/Android.
// Nunca intercepta API, uploads nem o socket.
//
// IMPORTANTE: busca sempre a versão mais NOVA primeiro (network-first). Como
// esse é um sistema que muda com frequência, mostrar uma cópia antiga guardada
// e só atualizar "por baixo dos panos" fazia a pessoa nunca ver a mudança na
// primeira vez que recarregava — só a versão anterior. Agora só usa o que está
// guardado se a pessoa estiver sem internet.
const CACHE_NAME = "chat-nacional-v2";

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
    fetch(request)
      .then((resposta) => {
        if (resposta.ok) {
          const copia = resposta.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(request, copia));
        }
        return resposta;
      })
      .catch(() => caches.match(request)) // só usa o cache se a rede falhar (ex: sem internet)
  );
});
