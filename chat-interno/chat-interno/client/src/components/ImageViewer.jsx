import React, { useEffect } from "react";
import { X, Download } from "lucide-react";
import { fileUrl } from "../api";

export default function ImageViewer({ image, onClose }) {
  // Fecha com a tecla Esc
  useEffect(() => {
    if (!image) return;
    const onKey = (e) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [image, onClose]);

  if (!image) return null;

  return (
    <div className="fixed inset-0 bg-black/90 z-[110] flex items-center justify-center p-6" onClick={onClose}>
      <div className="absolute top-4 right-4 flex items-center gap-2">
        <a
          href={fileUrl(image.url)}
          download={image.name || "imagem"}
          onClick={(e) => e.stopPropagation()}
          title="Baixar"
          className="w-10 h-10 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center text-white"
        >
          <Download size={18} />
        </a>
        <button
          onClick={onClose}
          title="Fechar"
          className="w-10 h-10 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center text-white"
        >
          <X size={20} />
        </button>
      </div>

      {image.name && (
        <div className="absolute top-6 left-6 text-white/70 text-sm max-w-[60%] truncate">{image.name}</div>
      )}

      <img
        src={fileUrl(image.url)}
        alt={image.name || "Imagem"}
        onClick={(e) => e.stopPropagation()}
        className="max-w-full max-h-full object-contain rounded-lg shadow-2xl"
      />
    </div>
  );
}
