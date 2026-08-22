import React, { useState } from "react";
import { X, Megaphone } from "lucide-react";
import { api } from "../api";

export default function NewAnnouncementModal({ onClose, onSent }) {
  const [message, setMessage] = useState("");
  const [image, setImage] = useState(null);
  const [imagePreview, setImagePreview] = useState(null);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState("");

  const handleImage = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setImage(file);
    setImagePreview(URL.createObjectURL(file));
  };

  const submit = async (e) => {
    e.preventDefault();
    if (!message.trim()) return;
    setSending(true);
    setError("");
    try {
      const form = new FormData();
      form.append("message", message.trim());
      if (image) form.append("image", image);
      await api.post("/announcements", form, { headers: { "Content-Type": "multipart/form-data" } });
      onSent();
    } catch (err) {
      setError(err.response?.data?.error || "Não foi possível enviar o comunicado.");
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50" onClick={onClose}>
      <div className="bg-white rounded-xl w-[400px] p-5" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-slate-800 font-semibold text-base flex items-center gap-2">
            <Megaphone size={18} className="text-[#25D366]" /> Comunicado geral
          </h3>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600"><X size={18} /></button>
        </div>

        <p className="text-xs text-slate-500 mb-4">Todo mundo que estiver com o chat aberto vai ver esse aviso na hora, em destaque no meio da tela.</p>

        <form onSubmit={submit}>
          <label className="text-xs font-medium text-slate-500 mb-1 block">Mensagem</label>
          <textarea
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            rows={4}
            className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm mb-3 focus:outline-none focus:ring-2 focus:ring-[#25D366] resize-none"
            placeholder="Escreva o comunicado..."
            required
          />

          <label className="text-xs font-medium text-slate-500 mb-1.5 block">Imagem (opcional)</label>
          {imagePreview ? (
            <img src={imagePreview} alt="Prévia" className="w-full h-32 object-cover rounded-lg mb-3" />
          ) : (
            <input type="file" accept="image/*" onChange={handleImage} className="w-full text-xs text-slate-500 mb-3" />
          )}

          {error && <div className="text-red-500 text-xs mb-3">{error}</div>}

          <button
            type="submit"
            disabled={sending || !message.trim()}
            className="w-full rounded-lg py-2.5 text-sm font-medium text-white disabled:opacity-40"
            style={{ background: "#25D366" }}
          >
            {sending ? "Enviando..." : "Enviar comunicado pra todo mundo"}
          </button>
        </form>
      </div>
    </div>
  );
}
