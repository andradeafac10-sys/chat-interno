import React, { useEffect, useRef } from "react";
import { Video, Check } from "lucide-react";
import { startReuniaoAlertLoop } from "../sound";

// Mesmo padrão do AnnouncementOverlay (comunicado geral), mas roxo e com som
// diferente — dispara 1h e 5min antes de uma reunião, só pra participante.
export default function ReuniaoAlertOverlay({ alerta, onClose }) {
  const stopAlertRef = useRef(null);

  useEffect(() => {
    if (!alerta) return;
    stopAlertRef.current = startReuniaoAlertLoop();

    const retryOnInteraction = () => {
      if (!stopAlertRef.current) return;
      stopAlertRef.current();
      stopAlertRef.current = startReuniaoAlertLoop();
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
  }, [alerta?.reuniaoId, alerta?.faltam]);

  if (!alerta) return null;

  const fechar = () => {
    stopAlertRef.current?.();
    stopAlertRef.current = null;
    onClose();
  };

  return (
    <div className="fixed inset-0 flex items-center justify-center z-[100] p-3 reuniao-alert">
      <div className="bg-white rounded-2xl w-[94vw] max-w-sm shadow-2xl p-6 reuniao-card-pulse">
        <div className="flex items-center gap-2 mb-3" style={{ color: "#7C3AED" }}>
          <Video size={20} />
          <span className="text-xs font-semibold uppercase tracking-wide">Reunião em {alerta.faltam}</span>
        </div>
        <div className="text-slate-800 text-[17px] font-semibold mb-1">{alerta.titulo}</div>
        <div className="text-slate-500 text-[13px]">
          {new Date(alerta.inicio).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}
          {alerta.local ? ` · ${alerta.local}` : ""}
        </div>
        <button
          onClick={fechar}
          className="w-full rounded-lg py-3 mt-5 text-sm font-semibold text-white flex items-center justify-center gap-2"
          style={{ background: "#7C3AED" }}
        >
          <Check size={16} /> OK, ANOTADO
        </button>
      </div>
    </div>
  );
}
