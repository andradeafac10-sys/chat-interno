import React from "react";

// Destaca @menções, aplica formatação estilo WhatsApp (*negrito*, _itálico_,
// ~riscado~) e transforma links em clicáveis. Usado tanto nas mensagens do
// chat quanto nos comunicados, pra funcionar igual nos dois lugares.
export function formatarTexto(texto) {
  if (!texto) return texto;
  const regex = /(@[\wÀ-ÿ]+(?:\s[\wÀ-ÿ]+)?)|\*([^*\n]+)\*|_([^_\n]+)_|~([^~\n]+)~|(https?:\/\/[^\s]+|www\.[^\s]+)/g;
  const partes = [];
  let ultimo = 0;
  let key = 0;
  let m;
  while ((m = regex.exec(texto)) !== null) {
    if (m.index > ultimo) partes.push(texto.slice(ultimo, m.index));
    if (m[1]) {
      partes.push(<span key={key++} className="font-semibold text-[#2E6FD9]">{m[1]}</span>);
    } else if (m[2] !== undefined) {
      partes.push(<strong key={key++}>{m[2]}</strong>);
    } else if (m[3] !== undefined) {
      partes.push(<em key={key++}>{m[3]}</em>);
    } else if (m[4] !== undefined) {
      partes.push(<s key={key++}>{m[4]}</s>);
    } else if (m[5] !== undefined) {
      let url = m[5];
      let sufixo = "";
      const pontuacaoFinal = url.match(/^(.*?)([.,;:!?)\]]+)$/);
      if (pontuacaoFinal) { url = pontuacaoFinal[1]; sufixo = pontuacaoFinal[2]; }
      const href = url.startsWith("http") ? url : `https://${url}`;
      partes.push(
        <a
          key={key++}
          href={href}
          target="_blank"
          rel="noreferrer"
          onClick={(e) => e.stopPropagation()}
          className="underline text-[#2E6FD9] break-all"
        >
          {url}
        </a>
      );
      if (sufixo) partes.push(sufixo);
    }
    ultimo = regex.lastIndex;
  }
  if (ultimo < texto.length) partes.push(texto.slice(ultimo));
  return partes;
}
