import React, { useEffect, useState } from "react";
import { X, Search, Forward, Users as UsersIcon, User, Check } from "lucide-react";
import { api } from "../api";

// Reencaminha uma mensagem (texto, imagem, áudio ou arquivo) pra uma ou mais
// conversas — grupos e privado (DM) juntos na mesma lista, igual WhatsApp.
export default function ForwardMessageModal({ message, onClose, onSent }) {
  const [conversations, setConversations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState([]);
  const [filter, setFilter] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    api.get("/conversations").then(({ data }) => {
      setConversations(data.conversations);
      setLoading(false);
    }).catch(() => setLoading(false));
  }, []);

  const toggle = (id) =>
    setSelected((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));

  const filtradas = conversations.filter((c) =>
    c.title.toLowerCase().includes(filter.toLowerCase())
  );

  const enviar = async () => {
    if (selected.length === 0) return;
    setSending(true);
    setError("");
    try {
      await api.post(`/conversations/messages/${message.id}/forward`, { conversationIds: selected });
      onSent();
    } catch (err) {
      setError(err.response?.data?.error || "Não deu pra reencaminhar. Tente de novo.");
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-[100] p-3" onClick={onClose}>
      <div
        className="bg-white rounded-2xl w-[94vw] max-w-sm shadow-2xl flex flex-col max-h-[80vh] overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100 shrink-0">
          <div className="flex items-center gap-2 text-slate-800 font-semibold text-base">
            <Forward size={17} className="text-[#2563EB]" /> Reencaminhar mensagem
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600">
            <X size={19} />
          </button>
        </div>

        <div className="px-5 pt-3 pb-1 shrink-0">
          <div className="relative">
            <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              value={filter}
              onChange={(e) => setFilter(e.target.value)}
              placeholder="Buscar pessoa ou grupo..."
              className="w-full border border-slate-200 rounded-lg pl-8 pr-3 py-1.5 text-[13px] focus:outline-none focus:ring-2 focus:ring-[#2563EB]"
            />
          </div>
        </div>

        <div className="overflow-y-auto flex-1 min-h-0 px-2 py-2">
          {loading ? (
            <div className="text-xs text-slate-400 px-3 py-2">Carregando...</div>
          ) : filtradas.length === 0 ? (
            <div className="text-xs text-slate-400 px-3 py-2">Nada encontrado.</div>
          ) : (
            filtradas.map((c) => {
              const marcado = selected.includes(c.id);
              return (
                <button
                  key={c.id}
                  onClick={() => toggle(c.id)}
                  className="w-full flex items-center gap-2.5 px-3 py-2 rounded-lg hover:bg-slate-50 text-left"
                >
                  <div
                    className="w-8 h-8 rounded-full flex items-center justify-center text-white text-[11px] font-semibold shrink-0"
                    style={{ background: c.color || "#2563EB" }}
                  >
                    {c.type === "group" ? <UsersIcon size={14} /> : (c.title?.[0] || "?").toUpperCase()}
                  </div>
                  <span className="text-sm text-slate-700 flex-1 truncate">{c.title}</span>
                  <div
                    className="w-5 h-5 rounded-full border flex items-center justify-center shrink-0"
                    style={{
                      borderColor: marcado ? "#2563EB" : "#CBD5E1",
                      background: marcado ? "#2563EB" : "transparent",
                    }}
                  >
                    {marcado && <Check size={12} color="white" />}
                  </div>
                </button>
              );
            })
          )}
        </div>

        {error && <p className="text-xs text-red-500 px-5 pb-2">{error}</p>}

        <div className="px-5 py-4 border-t border-slate-100 shrink-0">
          <button
            onClick={enviar}
            disabled={selected.length === 0 || sending}
            className="w-full rounded-lg py-2.5 text-sm font-semibold text-white disabled:opacity-50"
            style={{ background: "#2563EB" }}
          >
            {sending ? "Enviando..." : selected.length > 0 ? `Reencaminhar para ${selected.length}` : "Reencaminhar"}
          </button>
        </div>
      </div>
    </div>
  );
}
