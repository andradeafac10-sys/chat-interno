import React from "react";
import { X, Megaphone } from "lucide-react";
import { fileUrl } from "../api";

export default function AnnouncementOverlay({ announcement, onClose }) {
  if (!announcement) return null;

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
          <div className="text-[12px] text-slate-400 mt-4">
            {announcement.created_by_name} · {new Date(announcement.created_at).toLocaleString("pt-BR")}
          </div>
        </div>
      </div>
    </div>
  );
}
