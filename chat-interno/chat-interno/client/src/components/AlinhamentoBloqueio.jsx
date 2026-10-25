import React, { useEffect, useState } from "react";
import { Lock, Check } from "lucide-react";
import { api, fileUrl } from "../api";
import { getSocket } from "../socket";
import { useAuth } from "../context/AuthContext";

// Trava a tela inteira enquanto a pessoa tiver alinhamento sem ciência.
// A trava vem do servidor (lista de pendentes), então F5, fechar e abrir ou trocar
// de aparelho não escapa dela. Só libera quando todos forem confirmados.
export default function AlinhamentoBloqueio() {
  const { user, logout } = useAuth();
  const [pendentes, setPendentes] = useState([]);
  const [lido, setLido] = useState(false);
  const [confirmando, setConfirmando] = useState(false);
  const [erro, setErro] = useState("");

  const carregar = () => {
    api.get("/feedbacks/mine")
      .then(({ data }) => {
        const lista = data.feedbacks.filter((f) => !f.acknowledged_at).sort((a, b) => new Date(a.created_at) - new Date(b.created_at));
        setPendentes(lista);
      })
      .catch(() => {});
  };

  useEffect(() => {
    if (!user) return;
    carregar();
    const intervalo = setInterval(carregar, 60 * 1000);
    const aoVoltar = () => { if (document.visibilityState === "visible") carregar(); };
    document.addEventListener("visibilitychange", aoVoltar);
    window.addEventListener("focus", aoVoltar);
    window.addEventListener("feedback:atualizado", carregar);
    const socket = getSocket();
    socket?.on("feedback:novo", carregar);
    return () => {
      clearInterval(intervalo);
      document.removeEventListener("visibilitychange", aoVoltar);
      window.removeEventListener("focus", aoVoltar);
      window.removeEventListener("feedback:atualizado", carregar);
      socket?.off("feedback:novo", carregar);
    };
  }, [user?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  const atual = pendentes[0];
  useEffect(() => { setLido(false); setErro(""); }, [atual?.id]);

  if (!user || !atual) return null;

  const confirmar = async () => {
    setConfirmando(true);
    setErro("");
    try {
      await api.post(`/feedbacks/${atual.id}/ack`);
      setPendentes((p) => p.filter((f) => f.id !== atual.id));
      window.dispatchEvent(new Event("feedback:atualizado"));
    } catch {
      setErro("Não deu pra confirmar agora. Tente de novo.");
    } finally {
      setConfirmando(false);
    }
  };

  const d = new Date(atual.created_at);
  const quando = `${d.toLocaleDateString("pt-BR")} às ${d.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}`;

  return (
    <div className="fixed inset-0 z-[250] flex items-center justify-center p-3" style={{ background: "rgba(30, 10, 70, 0.95)" }}>
      <div className="bg-white rounded-2xl w-full max-w-lg max-h-[96vh] flex flex-col shadow-2xl" style={{ outline: "3px solid #EF4444" }}>
        <div className="p-5 pb-2 overflow-y-auto min-h-0">
          <div className="flex items-center justify-between mb-3 text-[11px] font-bold tracking-wide">
            <span className="flex items-center gap-1.5 text-red-600"><Lock size={13} /> ALINHAMENTO OBRIGATÓRIO</span>
            <span className="text-slate-500 font-semibold">{pendentes.length > 1 ? `1 de ${pendentes.length} pendentes` : "1 pendente"}</span>
          </div>
          <h3 className="text-[17px] font-semibold text-slate-800 break-words [overflow-wrap:anywhere]">{atual.title}</h3>
          <div className="text-[11.5px] text-slate-400 mt-1 mb-3">Aplicado por {atual.created_by_name} · {quando}</div>
          <div className="text-[14px] leading-relaxed text-slate-600 whitespace-pre-wrap break-words [overflow-wrap:anywhere] select-text">{atual.content}</div>
          {atual.attachment_url && (
            <a href={fileUrl(atual.attachment_url)} target="_blank" rel="noreferrer" className="inline-block mt-3 text-[12.5px] underline text-[#7C3AED]">
              📎 {atual.attachment_name || "Ver anexo"}
            </a>
          )}
        </div>
        <div className="p-5 pt-3 border-t border-slate-100 shrink-0">
          <label className="flex items-start gap-2 border border-slate-200 rounded-lg p-2.5 cursor-pointer mb-2.5">
            <input type="checkbox" checked={lido} onChange={(e) => setLido(e.target.checked)} className="mt-0.5 accent-[#7C3AED]" />
            <span className="text-[12.5px] text-slate-600">Li e estou ciente do conteúdo deste alinhamento</span>
          </label>
          <button
            onClick={confirmar}
            disabled={!lido || confirmando}
            className="w-full rounded-lg py-3 text-sm font-bold text-white flex items-center justify-center gap-2 disabled:opacity-40 disabled:cursor-not-allowed"
            style={{ background: "#7C3AED" }}
          >
            <Check size={16} /> {confirmando ? "Confirmando..." : "OK, CIENTE"}
          </button>
          {!lido && <p className="text-[11px] text-slate-400 text-center mt-2">Marque a caixinha acima pra liberar o botão</p>}
          {erro && <p className="text-[11.5px] text-red-500 text-center mt-2">{erro}</p>}
          <p className="text-[11px] text-red-600 font-semibold text-center mt-2">O sistema só é liberado depois da sua ciência.</p>
          <button onClick={logout} className="w-full text-[11.5px] text-slate-400 mt-2 hover:text-slate-600">Sair da conta</button>
        </div>
      </div>
    </div>
  );
}
