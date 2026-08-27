// Notificações do sistema (Windows/Mac/Android) — mesma coisa que WhatsApp,
// Slack etc. fazem: um aviso que aparece mesmo com o navegador minimizado.

/** Pede permissão pra mostrar notificação. Chamar uma vez, no início do app. */
export function pedirPermissaoNotificacao() {
  if (!("Notification" in window)) return; // navegador não suporta
  if (Notification.permission === "default") {
    Notification.requestPermission().catch(() => {});
  }
}

/**
 * Mostra uma notificação do sistema, se a pessoa já tiver permitido.
 * onClick: função chamada quando a pessoa clica na notificação (ex: abrir a conversa).
 */
export function mostrarNotificacaoDesktop({ titulo, corpo, onClick }) {
  if (!("Notification" in window)) return;
  if (Notification.permission !== "granted") return;

  try {
    const notif = new Notification(titulo, {
      body: corpo,
      icon: "/icon-192.png",
      badge: "/icon-192.png",
      tag: "chat-nacional", // evita empilhar 20 notificações — a mais nova substitui
    });
    notif.onclick = () => {
      window.focus();
      onClick?.();
      notif.close();
    };
  } catch (err) {
    // se der erro (ex: contexto sem suporte), só ignora — o resto do app continua normal
  }
}
