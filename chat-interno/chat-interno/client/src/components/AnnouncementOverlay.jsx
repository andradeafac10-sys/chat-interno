import React, { useEffect, useRef, useState } from "react";
import { Megaphone, Check, Volume2 } from "lucide-react";
import { fileUrl, api } from "../api";
import { startAlertLoop } from "../sound";
import { formatarTexto } from "../textFormat";
import ImageViewer from "./ImageViewer";

export default function AnnouncementOverlay({ announcement, onClose }) {
  const [acking, setAcking] = useState(false);
  const [acked, setAcked] = useState(false);
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
    try {
      await api.post(`/announcements/${announcement.id}/ack`);
      stopAlertRef.current?.();
      stopAlertRef.current = null;
      setAcked(true);
      setTimeout(onClose, 500);
    } finally {
      setAcking(false);
    }
  };

  return (
    <div className={`fixed inset-0 flex items-center justify-center z-[100] p-4 ${acked ? "" : "announcement-alert"}`}>
      {/* flex-col + max-h garante que o cartão nunca cresce além da tela; o que
          sobrar de conteúdo rola por dentro, mas o botão de CIENTE fica sempre
          visível, fixo embaixo — nunca precisa rolar pra achar ele. */}
      <div className={`bg-white rounded-2xl w-full max-w-md shadow-2xl flex flex-col max-h-[90vh] overflow-hidden relative ${acked ? "" : "announcement-card-pulse"}`}>
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
                className="w-full max-h-[50vh] object-contain bg-black cursor-zoom-in"
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
            style={{ background: acked ? "#1B7A4A" : "#2E6FD9" }}
          >
            <Check size={16} /> {acked ? "Confirmado!" : acking ? "Enviando..." : "ESTOU CIENTE"}
          </button>

          {!acked && (
            <p className="text-[11px] text-slate-400 text-center mt-2">
              O alerta só para quando você confirmar.
            </p>
          )}
        </div>
      </div>

      <ImageViewer image={viewingImage} onClose={() => setViewingImage(null)} />
    </div>
  );
}
