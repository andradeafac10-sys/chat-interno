// Toca um "blip" curto sem precisar de nenhum arquivo de áudio externo.
export function playNotificationSound() {
  try {
    const ctx = new (window.AudioContext || window.webkitAudioContext)();
    const o = ctx.createOscillator();
    const g = ctx.createGain();
    o.type = "sine";
    o.frequency.setValueAtTime(880, ctx.currentTime);
    o.frequency.exponentialRampToValueAtTime(660, ctx.currentTime + 0.15);
    g.gain.setValueAtTime(0.18, ctx.currentTime);
    g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.35);
    o.connect(g);
    g.connect(ctx.destination);
    o.start();
    o.stop(ctx.currentTime + 0.35);
  } catch (err) {
    // navegador bloqueou áudio automático (comum antes da 1a interação do usuário) — sem problema, ignora
  }
}

// Alerta de comunicado geral: duas notas em sequência, mais insistente que o blip normal.
function playAlertBeep(ctx) {
  const notes = [
    { freq: 988, start: 0, dur: 0.22 },
    { freq: 740, start: 0.26, dur: 0.28 },
  ];
  notes.forEach(({ freq, start, dur }) => {
    const o = ctx.createOscillator();
    const g = ctx.createGain();
    o.type = "square";
    o.frequency.setValueAtTime(freq, ctx.currentTime + start);
    g.gain.setValueAtTime(0.0001, ctx.currentTime + start);
    g.gain.exponentialRampToValueAtTime(0.16, ctx.currentTime + start + 0.02);
    g.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + start + dur);
    o.connect(g);
    g.connect(ctx.destination);
    o.start(ctx.currentTime + start);
    o.stop(ctx.currentTime + start + dur);
  });
}

/**
 * Começa a tocar o alerta do comunicado em loop (a cada 1,6s).
 * Devolve uma função que, quando chamada, para o alerta.
 */
export function startAlertLoop() {
  let ctx = null;
  let timer = null;

  try {
    ctx = new (window.AudioContext || window.webkitAudioContext)();
    // Se o navegador tiver suspendido o áudio, tenta retomar
    if (ctx.state === "suspended") ctx.resume().catch(() => {});
    playAlertBeep(ctx);
    timer = setInterval(() => {
      try {
        if (ctx.state === "suspended") ctx.resume().catch(() => {});
        playAlertBeep(ctx);
      } catch (err) { /* ignora */ }
    }, 1600);
  } catch (err) {
    // navegador bloqueou o áudio — o alerta visual (piscar) continua funcionando
  }

  return function stopAlertLoop() {
    if (timer) clearInterval(timer);
    try { ctx?.close(); } catch (err) { /* ignora */ }
  };
}
