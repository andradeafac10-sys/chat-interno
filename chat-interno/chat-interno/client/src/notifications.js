// Notificações do sistema (Windows/Mac/Android) — mesma coisa que WhatsApp,
// Slack etc. fazem: um aviso que aparece mesmo com o navegador minimizado.
//
// IMPORTANTE: como o app agora tem um Service Worker (por causa do PWA
// instalável), o navegador espera que a notificação seja mostrada por ELE,
// não direto pela página — daí o motivo de só funcionar uma vez e depois
// parar. Usamos registration.showNotification(), que é o jeito certo.

export function pedirPermissaoNotificacao() {
  if (!("Notification" in window)) return;
  if (Notification.permission === "default") {
    Notification.requestPermission().catch(() => {});
  }
}

export async function mostrarNotificacaoDesktop({ titulo, corpo, conversationId }) {
  if (!("Notification" in window)) return;
  if (Notification.permission !== "granted") return;

  try {
    if ("serviceWorker" in navigator) {
      const registration = await navigator.serviceWorker.ready;
      await registration.showNotification(titulo, {
        body: corpo,
        icon: "/icon-192.png",
        badge: "/icon-192.png",
        tag: conversationId || undefined, // agrupa por conversa, sem travar novas notificações de outra pessoa
        renotify: true,
        data: { conversationId },
      });
      return;
    }
    // Reserva, pra navegador sem suporte a service worker
    const notif = new Notification(titulo, { body: corpo, icon: "/icon-192.png" });
    notif.onclick = () => { window.focus(); notif.close(); };
  } catch {
    // se der erro, só ignora — o resto do app continua normal
  }
}
