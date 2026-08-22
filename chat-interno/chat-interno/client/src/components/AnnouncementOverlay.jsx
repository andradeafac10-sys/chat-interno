import React, { useState } from "react";
import { X, Megaphone, Check } from "lucide-react";
import { fileUrl, api } from "../api";

export default function AnnouncementOverlay({ announcement, onClose }) {
  const [acking, setAcking] = useState(false);
  const [acked, setAcked] = useState(false);

  if (!announcement) return null;

  const handleAck = async () => {
    setAcking(true);
    try {
      await api.post(`/announcements/${announcement.id}/ack`);
      setAcked(true);
      setTimeout(onClose, 500);
    } finally {
      setAcking(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-[100] p-4">
      <div className="bg-white rounded-2xl w-full max-w-md overflow-hidden relative shadow-2xl">
        <button onClick={onClose} className="absolute top-3 right-3 w-8 h-8 rounded-full bg-black/40 hover:bg-black/60 flex items-center justify-center text-white z-10">
          <X size={18} />
        </button>

        {announcement.image_url && (
          <img src={fileUrl(announcement.image_url)} alt="Comunicado" className="w-full max-h-64 object-cover" />
        )}

        <div className="p-6">
          <div className="flex items-center gap-2 mb-3 text-[#25D366]">
            <Megaphone size={20} />
            <span className="text-xs font-semibold uppercase tracking-wide">Comunicado geral</span>
          </div>
          <p className="text-slate-800 text-[15px] whitespace-pre-wrap leading-relaxed">{announcement.message}</p>
          <div className="text-[12px] text-slate-400 mt-4 mb-5">
            {announcement.created_by_name} · {new Date(announcement.created_at).toLocaleString("pt-BR")}
          </div>

          <button
            onClick={handleAck}
            disabled={acking || acked}
            className="w-full rounded-lg py-2.5 text-sm font-medium text-white flex items-center justify-center gap-2 disabled:opacity-70"
            style={{ background: acked ? "#16A34A" : "#25D366" }}
          >
            <Check size={16} /> {acked ? "Confirmado!" : acking ? "Enviando..." : "Estou ciente"}
          </button>
        </div>
      </div>
    </div>
  );
}
