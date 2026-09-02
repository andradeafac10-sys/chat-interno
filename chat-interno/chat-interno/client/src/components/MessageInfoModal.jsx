import React, { useEffect, useState } from "react";
import { X, Check, CheckCheck } from "lucide-react";
import { api, fileUrl } from "../api";

// "Dados da mensagem" — mostra quem já leu e quem ainda não, igual o WhatsApp
// mostra quando você toca numa mensagem que mandou e escolhe "Info".
export default function MessageInfoModal({ messageId, onClose }) {
  const [dados, setDados] = useState(null);
  const [erro, setErro] = useState("");

  useEffect(() => {
    api.get(`/conversations/messages/${messageId}/reads`)
      .then(({ data }) => setDados(data))
      .catch((err) => setErro(err.response?.data?.error || "Não consegui carregar quem leu essa mensagem."));
  }, [messageId]);

  const fmtHora = (iso) => new Date(iso).toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" });

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-[100] p-3" onClick={onClose}>
      <div className="bg-white rounded-2xl w-[94vw] max-w-sm shadow-2xl flex flex-col max-h-[80vh] overflow-hidden" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100 shrink-0">
          <div className="text-slate-800 font-semibold text-base">Dados da mensagem</div>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600"><X size={19} /></button>
        </div>

        <div className="overflow-y-auto flex-1 min-h-0 px-5 py-4">
          {erro && <p className="text-xs text-red-500">{erro}</p>}
          {!erro && !dados && <p className="text-xs text-slate-400">Carregando...</p>}

          {dados && (
            <>
              <div className="flex items-center gap-2 text-[13px] font-semibold text-slate-700 mb-2">
                <CheckCheck size={16} className="text-[#2563EB]" /> Lido ({dados.lido_por.length})
              </div>
              {dados.lido_por.length === 0 ? (
                <p className="text-xs text-slate-400 mb-4">Ninguém leu ainda.</p>
              ) : (
                <div className="flex flex-col gap-2 mb-4">
                  {dados.lido_por.map((p) => (
                    <div key={p.id} className="flex items-center gap-2.5">
                      <div className="w-8 h-8 rounded-full flex items-center justify-center text-white text-[10px] font-semibold shrink-0 overflow-hidden" style={{ background: p.color || "#2563EB" }}>
                        {p.avatar_url ? <img src={fileUrl(p.avatar_url)} alt={p.name} className="w-full h-full object-cover" /> : p.name?.[0]?.toUpperCase()}
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="text-[13px] text-slate-700 truncate">{p.name}</div>
                        <div className="text-[11px] text-slate-400">{fmtHora(p.lido_em)}</div>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              <div className="flex items-center gap-2 text-[13px] font-semibold text-slate-700 mb-2">
                <Check size={16} className="text-slate-400" /> Enviado, ainda não lido ({dados.nao_lido_por.length})
              </div>
              {dados.nao_lido_por.length === 0 ? (
                <p className="text-xs text-slate-400">Todo mundo já leu.</p>
              ) : (
                <div className="flex flex-col gap-2">
                  {dados.nao_lido_por.map((p) => (
                    <div key={p.id} className="flex items-center gap-2.5">
                      <div className="w-8 h-8 rounded-full flex items-center justify-center text-white text-[10px] font-semibold shrink-0 overflow-hidden" style={{ background: p.color || "#2563EB" }}>
                        {p.avatar_url ? <img src={fileUrl(p.avatar_url)} alt={p.name} className="w-full h-full object-cover" /> : p.name?.[0]?.toUpperCase()}
                      </div>
                      <div className="text-[13px] text-slate-700 truncate">{p.name}</div>
                    </div>
                  ))}
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
