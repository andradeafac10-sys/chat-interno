import React, { useEffect, useState } from "react";
import { X, MessageSquareText } from "lucide-react";
import { api, fileUrl } from "../api";

// Tela própria de "Meus feedbacks" — os que a pessoa recebeu, com a
// confirmação "Li e estou ciente" obrigatória antes de liberar o "OK, CIENTE".
export default function FeedbacksModal({ onClose, onFeedbackAcked }) {
  const [feedbacks, setFeedbacks] = useState(null); // null = carregando
  const [erro, setErro] = useState("");
  const [confirmando, setConfirmando] = useState(null);
  const [lidos, setLidos] = useState({});

  const carregar = () => {
    api.get("/feedbacks/mine")
      .then(({ data }) => setFeedbacks(data.feedbacks))
      .catch((err) => setErro(err.response?.data?.error || "Não deu pra carregar seus feedbacks."));
  };

  useEffect(() => { carregar(); }, []);

  const confirmarCiente = async (id) => {
    setConfirmando(id);
    try {
      await api.post(`/feedbacks/${id}/ack`);
      setFeedbacks((prev) => prev.map((f) => (f.id === id ? { ...f, acknowledged_at: new Date().toISOString() } : f)));
      onFeedbackAcked?.();
    } catch {
      alert("Não deu pra confirmar agora. Tente de novo.");
    } finally {
      setConfirmando(null);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50" onClick={onClose}>
      <div className="bg-white rounded-xl w-[380px] max-h-[85vh] overflow-y-auto p-5" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-slate-800 font-semibold text-base">Feedbacks</h3>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600"><X size={18} /></button>
        </div>

        {erro && <p className="text-[13px] text-red-500">{erro}</p>}
        {!erro && feedbacks === null && <p className="text-[13px] text-slate-400">Carregando...</p>}
        {feedbacks?.length === 0 && (
          <div className="text-center py-6">
            <MessageSquareText size={28} className="mx-auto text-slate-300 mb-2" />
            <p className="text-[13px] text-slate-400">Você ainda não recebeu nenhum feedback.</p>
          </div>
        )}

        {feedbacks?.length > 0 && (
          <div className="flex flex-col gap-3 max-h-[70vh] overflow-y-auto">
            {feedbacks.map((f) => {
              const pendente = !f.acknowledged_at;
              return (
                <div
                  key={f.id}
                  className="rounded-lg p-3 border"
                  style={pendente ? { background: "#FEF2F2", borderColor: "#FCA5A5" } : { borderColor: "#E2E8F0" }}
                >
                  <div className="text-[13.5px] font-semibold text-slate-800">{f.title}</div>
                  <div className="text-[13px] text-slate-600 whitespace-pre-wrap mt-1">{f.content}</div>
                  {f.attachment_url && (
                    <a
                      href={fileUrl(f.attachment_url)}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex items-center gap-1 text-[12px] text-[#2563EB] font-medium mt-2 underline"
                    >
                      📎 {f.attachment_name || "Ver anexo"}
                    </a>
                  )}
                  <div className="text-[11px] text-slate-400 mt-2">
                    {f.created_by_name} · {new Date(f.created_at).toLocaleDateString("pt-BR")}
                  </div>
                  {pendente ? (
                    <>
                      <label className="flex items-start gap-2 mt-2.5 bg-white border border-slate-200 rounded-lg p-2.5 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={!!lidos[f.id]}
                          onChange={(e) => setLidos((prev) => ({ ...prev, [f.id]: e.target.checked }))}
                          className="mt-0.5 accent-[#2563EB]"
                        />
                        <span className="text-[12px] text-slate-600">Li e estou ciente do conteúdo deste feedback</span>
                      </label>
                      <button
                        onClick={() => confirmarCiente(f.id)}
                        disabled={!lidos[f.id] || confirmando === f.id}
                        className="w-full rounded-lg py-2 text-[12.5px] font-semibold text-white mt-2 disabled:opacity-40 disabled:cursor-not-allowed"
                        style={{ background: "#2563EB" }}
                      >
                        {confirmando === f.id ? "Confirmando..." : "✓ OK, CIENTE"}
                      </button>
                      {!lidos[f.id] && (
                        <p className="text-[10.5px] text-slate-400 text-center mt-1">Marque a caixinha acima pra liberar o botão</p>
                      )}
                    </>
                  ) : (
                    <div className="text-[11px] text-emerald-600 font-medium mt-2">
                      ✓ Confirmado em {new Date(f.acknowledged_at).toLocaleDateString("pt-BR")}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
