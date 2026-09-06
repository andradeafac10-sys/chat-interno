import React, { useEffect, useState } from "react";
import { MessageSquareText, ChevronDown, ChevronRight } from "lucide-react";
import { api, fileUrl } from "../api";

// Tela "Feedbacks" — os que a pessoa recebeu, com a confirmação "Li e estou
// ciente" obrigatória antes de liberar o "OK, CIENTE". Agora é uma página de
// verdade (item fixo da coluna de navegação), não um modal.
//
// A lista mostra só o título de cada feedback — clicar em cima expande e
// mostra o conteúdo, anexo e o botão de confirmar.
export default function FeedbacksPage() {
  const [feedbacks, setFeedbacks] = useState(null);
  const [erro, setErro] = useState("");
  const [confirmando, setConfirmando] = useState(null);
  const [lidos, setLidos] = useState({});
  const [abertoId, setAbertoId] = useState(null);

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
      window.dispatchEvent(new Event("feedback:atualizado"));
    } catch {
      alert("Não deu pra confirmar agora. Tente de novo.");
    } finally {
      setConfirmando(null);
    }
  };

  return (
    <div className="flex-1 flex flex-col overflow-hidden">
      <div className="h-16 flex items-center gap-3 px-6 border-b border-slate-200 bg-white shrink-0">
        <MessageSquareText size={18} className="text-[#2563EB]" />
        <div className="text-slate-800 text-sm font-semibold">Feedbacks</div>
      </div>

      <div className="flex-1 overflow-y-auto p-6" style={{ background: "#F7F9FB" }}>
        <div className="max-w-2xl mx-auto">
          {erro && <p className="text-[13px] text-red-500">{erro}</p>}
          {!erro && feedbacks === null && <p className="text-[13px] text-slate-400">Carregando...</p>}
          {feedbacks?.length === 0 && (
            <div className="text-center py-16">
              <MessageSquareText size={28} className="mx-auto text-slate-300 mb-2" />
              <p className="text-[13px] text-slate-400">Você ainda não recebeu nenhum feedback.</p>
            </div>
          )}

          {feedbacks?.length > 0 && (
            <div className="flex flex-col gap-2">
              {feedbacks.map((f) => {
                const pendente = !f.acknowledged_at;
                const aberto = abertoId === f.id;
                return (
                  <div
                    key={f.id}
                    className="bg-white rounded-lg border overflow-hidden"
                    style={pendente ? { background: "#FEF2F2", borderColor: "#FCA5A5" } : { borderColor: "#E2E8F0" }}
                  >
                    <button
                      onClick={() => setAbertoId(aberto ? null : f.id)}
                      className="w-full flex items-center gap-2 px-4 py-3 text-left"
                    >
                      {aberto ? <ChevronDown size={15} className="text-slate-400 shrink-0" /> : <ChevronRight size={15} className="text-slate-400 shrink-0" />}
                      <span className="text-[13.5px] font-semibold text-slate-800 flex-1 truncate">{f.title}</span>
                      {pendente ? (
                        <span className="text-[10px] font-bold rounded-full px-2 py-0.5 shrink-0" style={{ background: "#FEE2E2", color: "#DC2626" }}>PENDENTE</span>
                      ) : (
                        <span className="text-[10px] font-bold rounded-full px-2 py-0.5 shrink-0" style={{ background: "#DCFCE7", color: "#16A34A" }}>CIENTE</span>
                      )}
                    </button>

                    {aberto && (
                      <div className="px-4 pb-4 pt-0.5 border-t" style={{ borderColor: pendente ? "#FCA5A5" : "#E2E8F0" }}>
                        <div className="text-[13px] text-slate-600 whitespace-pre-wrap mt-3">{f.content}</div>
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
                            <label className="flex items-start gap-2 mt-2.5 bg-white border border-slate-200 rounded-lg p-2.5 cursor-pointer max-w-md">
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
                              className="rounded-lg py-2 px-5 text-[12.5px] font-semibold text-white mt-2 disabled:opacity-40 disabled:cursor-not-allowed"
                              style={{ background: "#2563EB" }}
                            >
                              {confirmando === f.id ? "Confirmando..." : "✓ OK, CIENTE"}
                            </button>
                            {!lidos[f.id] && (
                              <p className="text-[10.5px] text-slate-400 mt-1">Marque a caixinha acima pra liberar o botão</p>
                            )}
                          </>
                        ) : (
                          <div className="text-[11px] text-emerald-600 font-medium mt-2">
                            ✓ Confirmado como lido em: {new Date(f.acknowledged_at).toLocaleDateString("pt-BR")} às {new Date(f.acknowledged_at).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
