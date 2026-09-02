import React, { useEffect, useRef, useState } from "react";
import { Megaphone, Check, Volume2 } from "lucide-react";
import { fileUrl, api } from "../api";
import { startAlertLoop } from "../sound";
import ImageViewer from "./ImageViewer";

// Destaca @menções, aplica formatação estilo WhatsApp (*negrito*, _itálico_,
// ~riscado~) e transforma links em clicáveis.
function formatarTexto(texto) {
  if (!texto) return texto;
  const regex = /(@[\wÀ-ÿ]+(?:\s[\wÀ-ÿ]+)?)|\*([^*\n]+)\*|_([^_\n]+)_|~([^~\n]+)~|(https?:\/\/[^\s]+|www\.[^\s]+)/g;
  const partes = [];
  let ultimo = 0;
  let key = 0;
  let m;
  while ((m = regex.exec(texto)) !== null) {
    if (m.index > ultimo) partes.push(texto.slice(ultimo, m.index));
    if (m[1]) {
      partes.push(<span key={key++} className="font-semibold text-[#2563EB]">{m[1]}</span>);
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
          className="underline text-[#2563EB] break-all"
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

export default function AnnouncementOverlay({ announcement, onClose }) {
  const [acking, setAcking] = useState(false);
  const [acked, setAcked] = useState(false);
  const [erro, setErro] = useState("");
  const [viewingImage, setViewingImage] = useState(null);
  const stopAlertRef = useRef(null);

  // Começa o alerta sonoro quando o comunicado aparece e para quando sai
  useEffect(() => {
    if (!announcement) return;
    stopAlertRef.current = startAlertLoop();

    // Se o navegador bloqueou o áudio automático, tenta de novo no primeiro clique/tecla
    const retryOnInteraction = () => {
      if (!stopAlertRef.current) return;
      stopAlertRef.current();
      stopAlertRef.current = startAlertLoop();
      window.removeEventListener("pointerdown", retryOnInteraction);
      window.removeEventListener("keydown", retryOnInteraction);
    };
    window.addEventListener("pointerdown", retryOnInteraction, { once: true });
    window.addEventListener("keydown", retryOnInteraction, { once: true });

    return () => {
      stopAlertRef.current?.();
      stopAlertRef.current = null;
      window.removeEventListener("pointerdown", retryOnInteraction);
      window.removeEventListener("keydown", retryOnInteraction);
    };
  }, [announcement?.id]);

  if (!announcement) return null;

  const handleAck = async () => {
    setAcking(true);
    setErro("");
    try {
      await api.post(`/announcements/${announcement.id}/ack`);
      stopAlertRef.current?.();
      stopAlertRef.current = null;
      setAcked(true);
      setTimeout(onClose, 500);
      setAcking(false);
    } catch {
      // Se der erro (ou o timeout de 15s do api.js estourar), avisa a pessoa
      // e libera o botão de novo — antes ficava preso em "Enviando..." sem
      // nenhuma explicação.
      setErro("Não deu pra confirmar agora. Tente de novo.");
      setAcking(false);
    }
  };

  return (
    <div className={`fixed inset-0 flex items-center justify-center z-[100] p-3 ${acked ? "" : "announcement-alert"}`}>
      {/* w-[94vw] + max-w-md garante que cabe em qualquer tela (mesmo notebook
          pequeno) sem precisar diminuir o zoom do navegador. max-h-[92vh] +
          flex-col garante que, mesmo com imagem grande e texto longo, o botão
          de CIENTE fica sempre visível, fixo embaixo — o que sobrar rola por
          dentro do cartão, nunca o cartão inteiro passa da tela. */}
      <div className={`bg-white rounded-2xl w-[94vw] max-w-md shadow-2xl flex flex-col max-h-[92vh] overflow-hidden relative ${acked ? "" : "announcement-card-pulse"}`}>
        {/* Sem botão de fechar (X) de propósito: comunicado geral só sai
            confirmando "ESTOU CIENTE" — ninguém pode dispensar sem ler/confirmar. */}
        <div className="overflow-y-auto flex-1 min-h-0">
          {announcement.image_url && (
            <button
              onClick={() => setViewingImage({ url: announcement.image_url, name: "Comunicado" })}
              className="block w-full"
              title="Clique para ver em tamanho maior"
            >
              <img
                src={fileUrl(announcement.image_url)}
                alt="Comunicado"
                className="w-full max-h-[38vh] object-contain bg-black cursor-zoom-in"
                onError={(e) => { e.target.style.display = "none"; }}
              />
            </button>
          )}

          <div className="p-6 pb-2">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2 text-red-600">
                <Megaphone size={20} />
                <span className="text-xs font-semibold uppercase tracking-wide">Comunicado geral</span>
              </div>
              {!acked && (
                <div className="flex items-center gap-1 text-[11px] text-slate-400">
                  <Volume2 size={13} /> alerta ativo
                </div>
              )}
            </div>

            <p className="text-slate-800 text-[15px] whitespace-pre-wrap leading-relaxed select-text">
              {formatarTexto(announcement.message)}
            </p>
            <div className="text-[12px] text-slate-400 mt-4">
              {announcement.created_by_name} · {new Date(announcement.created_at).toLocaleString("pt-BR")}
            </div>
          </div>
        </div>

        <div className="p-6 pt-4 shrink-0 border-t border-slate-100">
          <button
            onClick={handleAck}
            disabled={acking || acked}
            className="w-full rounded-lg py-3 text-sm font-semibold text-white flex items-center justify-center gap-2 disabled:opacity-70"
            style={{ background: acked ? "#1B7A4A" : "#2563EB" }}
          >
            <Check size={16} /> {acked ? "Confirmado!" : acking ? "Enviando..." : "ESTOU CIENTE"}
          </button>

          {!acked && !erro && (
            <p className="text-[11px] text-slate-400 text-center mt-2">
              O alerta só para quando você confirmar.
            </p>
          )}
          {erro && (
            <p className="text-[11px] text-red-500 text-center mt-2 font-medium">
              {erro}
            </p>
          )}
        </div>
      </div>

      <ImageViewer image={viewingImage} onClose={() => setViewingImage(null)} />
    </div>
  );
}
