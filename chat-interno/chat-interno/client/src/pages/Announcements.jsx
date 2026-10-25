import React, { useEffect, useState } from "react";
import { ArrowLeft, Megaphone, Plus, ChevronDown, Check, Clock, Trash2, BarChart3, Copy, Users as UsersIcon, User, X } from "lucide-react";
import { api, fileUrl } from "../api";
import NewAnnouncementModal from "../components/NewAnnouncementModal";
import ImageViewer from "../components/ImageViewer";
import { useAuth } from "../context/AuthContext";

// Destaca @menções, aplica formatação estilo WhatsApp (*negrito*, _itálico_,
// ~riscado~) e transforma links em clicáveis.
function formatarTexto(texto) {
  if (!texto) return texto;
  const regex = /(@[\wÀ-ÿ]+(?:\s[\wÀ-ÿ]+)?)|\*([^*\n]+)\*|_([^_\n]+)_|~([^~\n]+)~|(https?:\/\/[^\s]+|www\.[^\s]+)/g;
  const partes = [];
  let ultimo = 0;
  let key = 0;
  let m;
  while ((m = regex.exec(texto)) !== null) {
    if (m.index > ultimo) partes.push(texto.slice(ultimo, m.index));
    if (m[1]) {
      partes.push(<span key={key++} className="font-semibold text-[#2563EB]">{m[1]}</span>);
    } else if (m[2] !== undefined) {
      partes.push(<strong key={key++}>{m[2]}</strong>);
    } else if (m[3] !== undefined) {
      partes.push(<em key={key++}>{m[3]}</em>);
    } else if (m[4] !== undefined) {
      partes.push(<s key={key++}>{m[4]}</s>);
    } else if (m[5] !== undefined) {
      let url = m[5];
      let sufixo = "";
      const pontuacaoFinal = url.match(/^(.*?)([.,;:!?)\]]+)$/);
      if (pontuacaoFinal) { url = pontuacaoFinal[1]; sufixo = pontuacaoFinal[2]; }
      const href = url.startsWith("http") ? url : `https://${url}`;
      partes.push(
        <a
          key={key++}
          href={href}
          target="_blank"
          rel="noreferrer"
          onClick={(e) => e.stopPropagation()}
          className="underline text-[#2563EB] break-all"
        >
          {url}
        </a>
      );
      if (sufixo) partes.push(sufixo);
    }
    ultimo = regex.lastIndex;
  }
  if (ultimo < texto.length) partes.push(texto.slice(ultimo));
  return partes;
}

export default function Announcements({ onBack }) {
  const { user } = useAuth();
  const isAdm = user.role === "admin";
  const [announcements, setAnnouncements] = useState([]);
  const [totalActive, setTotalActive] = useState(0);
  const [loading, setLoading] = useState(true);
  const [showNew, setShowNew] = useState(false);
  const [dadosId, setDadosId] = useState(null);
  const [filtro, setFiltro] = useState("todos");
  const [busca, setBusca] = useState("");
  const [viewingImage, setViewingImage] = useState(null);
  const [acks, setAcks] = useState({}); // { [id]: { acked: [], pending: [] } }

  const [error, setError] = useState("");

  const load = () => {
    setLoading(true);
    setError("");
    api.get("/announcements")
      .then(({ data }) => {
        setAnnouncements(data.announcements);
        setTotalActive(data.totalActive);
      })
      .catch((err) => setError(err.response?.data?.error || "Não foi possível carregar os comunicados."))
      .finally(() => setLoading(false));
  };

  const remove = async (id) => {
    if (!window.confirm("Apagar esse comunicado? Isso não pode ser desfeito.")) return;
    await api.delete(`/announcements/${id}`);
    load();
  };

  useEffect(() => { load(); }, []);

  const [viewingAnnouncement, setViewingAnnouncement] = useState(null); // cartão grande, igual ao que o operador vê

  const abrirDados = async (id) => {
    setDadosId(id);
    setFiltro("todos");
    setBusca("");
    setViewingAnnouncement(null);
    try {
      const { data } = await api.get(`/announcements/${id}/acks`);
      setAcks((prev) => ({ ...prev, [id]: data }));
    } catch {
      setAcks((prev) => ({ ...prev, [id]: { erro: true, acked: [], pending: [], grupos: [] } }));
    }
  };

  const dadosAnn = announcements.find((x) => x.id === dadosId);
  const dados = dadosId ? acks[dadosId] : null;
  const fmtMin = (ms) => {
    const m = Math.round(ms / 60000);
    if (m < 1) return "< 1 min";
    if (m < 60) return `${m} min`;
    if (m < 1440) return `${Math.floor(m / 60)} h ${m % 60 ? (m % 60) + " min" : ""}`.trim();
    return `${Math.floor(m / 1440)} d`;
  };
  const tempoDe = (u) => fmtMin(new Date(u.acked_at) - new Date(dadosAnn.created_at));
  const tempoMedio = dados && dados.acked.length && dadosAnn
    ? fmtMin(dados.acked.reduce((t, u) => t + (new Date(u.acked_at) - new Date(dadosAnn.created_at)), 0) / dados.acked.length)
    : "—";
  const norm = (t) => String(t || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
  const passa = (u) => !busca || norm(u.name).includes(norm(busca));
  const copiarPendentes = () => {
    const txt = (dados?.pending || []).map((u) => u.name).join("\n");
    try { navigator.clipboard.writeText(txt); } catch {}
  };

  return (
    <div className="flex-1 flex flex-col min-w-0 w-full max-w-full overflow-x-hidden" style={{ background: "var(--pagina-fundo)" }}>
      <div className="h-16 flex items-center gap-3 px-4 border-b border-[#D1D7DB] bg-white shrink-0">
        <button onClick={onBack} className="text-slate-500 hover:text-slate-700">
          <ArrowLeft size={20} />
        </button>
        <div className="text-slate-800 text-sm font-semibold flex items-center gap-2">
          <Megaphone size={16} className="text-[#2563EB]" /> Comunicados
        </div>
        {isAdm && (
          <button
            onClick={() => setShowNew(true)}
            className="ml-auto flex items-center gap-1.5 text-sm font-medium rounded-lg px-3 py-2 text-white"
            style={{ background: "#2563EB" }}
          >
            <Plus size={15} /> Novo comunicado
          </button>
        )}
      </div>

      <div className="flex-1 overflow-y-auto overflow-x-hidden p-3 sm:p-4 min-w-0">
        {loading ? (
          <div className="text-slate-400 text-sm">Carregando...</div>
        ) : error ? (
          <div className="text-red-500 text-sm">{error}</div>
        ) : announcements.length === 0 ? (
          <div className="text-slate-400 text-sm">Nenhum comunicado enviado ainda.</div>
        ) : (
          <div className="flex flex-col gap-3">
            {announcements.map((a) => (
              <div key={a.id} className="bg-white rounded-xl border border-[#D1D7DB] overflow-hidden min-w-0 max-w-full">
                <button onClick={() => setViewingAnnouncement(a)} className="w-full min-w-0 text-left p-3 sm:p-4 flex gap-3">
                  {a.image_url && (
                    <img src={fileUrl(a.image_url)} alt="" className="w-14 h-14 rounded-lg object-cover shrink-0" />
                  )}
                  <div className="min-w-0 flex-1">
                    <p className="text-sm text-slate-800 select-text break-words [overflow-wrap:anywhere] line-clamp-2">{formatarTexto(a.message)}</p>
                    <div className="text-[11px] text-slate-400 mt-1">
                      {a.created_by_name} · {new Date(a.created_at).toLocaleString("pt-BR")}
                    </div>
                    <div className="text-[11px] text-slate-400 mt-1 flex items-center gap-1">
                      {a.audience === "groups" ? <><UsersIcon size={11} /> Grupos escolhidos</>
                        : a.audience === "users" ? <><User size={11} /> Pessoas escolhidas</>
                        : <><Megaphone size={11} /> Todos</>}
                    </div>
                  </div>
                  <ChevronDown size={18} className="shrink-0 text-slate-400 -rotate-90" />
                </button>
                {isAdm && (
                  <div className="px-3 sm:px-4 pb-3 flex items-center gap-2">
                    <span className="text-[12px] font-medium text-[#2563EB] flex items-center gap-1">
                      <Check size={13} /> {a.ack_count} de {a.target_count}
                    </span>
                    <button
                      onClick={() => abrirDados(a.id)}
                      className="ml-auto flex items-center gap-1.5 text-xs font-semibold rounded-lg px-3 py-1.5 border border-[#7C3AED] text-[#7C3AED]"
                    >
                      <BarChart3 size={13} /> Dados
                    </button>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {showNew && (
        <NewAnnouncementModal
          onClose={() => setShowNew(false)}
          onSent={() => {
            setShowNew(false);
            load();
          }}
        />
      )}

      <ImageViewer image={viewingImage} onClose={() => setViewingImage(null)} />

      {dadosId && dadosAnn && (
        <div className="fixed inset-0 z-[100] flex flex-col" style={{ background: "var(--pagina-fundo)" }}>
          <div className="h-16 flex items-center gap-3 px-4 border-b border-[#D1D7DB] bg-white shrink-0">
            <button onClick={() => setDadosId(null)} className="text-slate-500 hover:text-slate-700"><ArrowLeft size={20} /></button>
            <div className="text-slate-800 text-sm font-semibold flex items-center gap-2"><BarChart3 size={16} className="text-[#7C3AED]" /> Dados do comunicado</div>
            <button
              onClick={() => { setDadosId(null); remove(dadosAnn.id); }}
              className="ml-auto flex items-center gap-1.5 text-xs text-red-500"
            >
              <Trash2 size={14} /> Apagar
            </button>
          </div>
          <div className="flex-1 overflow-y-auto overflow-x-hidden p-3 sm:p-4 min-w-0">
            {!dados ? (
              <div className="text-sm text-slate-400">Carregando...</div>
            ) : dados.erro ? (
              <div className="text-sm text-red-500">Não foi possível carregar os dados.</div>
            ) : (
              <div className="max-w-4xl mx-auto">
                <p className="text-sm text-slate-800 break-words [overflow-wrap:anywhere] whitespace-pre-wrap line-clamp-3 mb-1">{dadosAnn.message}</p>
                <div className="text-[11px] text-slate-400 mb-3">{dadosAnn.created_by_name} · {new Date(dadosAnn.created_at).toLocaleString("pt-BR")}</div>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mb-4">
                  {[
                    ["Enviados", dados.total, "#1e293b"],
                    ["Confirmaram", dados.acked.length, "#16a34a"],
                    ["Pendentes", dados.pending.length, "#d97706"],
                    ["Tempo médio", tempoMedio, "#1e293b"],
                  ].map(([t, v, c]) => (
                    <div key={t} className="bg-white rounded-xl border border-[#D1D7DB] p-3">
                      <div className="text-xl font-bold" style={{ color: c }}>{v}</div>
                      <div className="text-[11px] text-slate-500">{t}</div>
                    </div>
                  ))}
                </div>

                {dados.grupos.length > 0 && (
                  <div className="bg-white rounded-xl border border-[#D1D7DB] p-4 mb-4">
                    <div className="text-xs font-semibold text-slate-500 mb-3">Confirmação por grupo</div>
                    <div className="flex flex-col gap-2">
                      {dados.grupos.map((g) => {
                        const pct = Math.round((g.confirmaram / Math.max(g.total, 1)) * 100);
                        return (
                          <div key={g.id} className="flex items-center gap-2 text-xs text-slate-700">
                            <span className="w-28 sm:w-40 truncate">{g.name}</span>
                            <div className="flex-1 h-2 rounded-full bg-slate-100 overflow-hidden"><div className="h-full bg-[#2563EB]" style={{ width: `${pct}%` }} /></div>
                            <span className="w-20 text-right text-slate-500">{g.confirmaram}/{g.total} · {pct}%</span>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}

                <div className="flex flex-wrap items-center gap-2 mb-3">
                  {[["todos", "Todos"], ["confirmaram", "Confirmaram"], ["pendentes", "Pendentes"]].map(([k, l]) => (
                    <button key={k} onClick={() => setFiltro(k)}
                      className="px-3 py-1.5 rounded-full text-xs border"
                      style={filtro === k ? { background: "#7C3AED", color: "#fff", borderColor: "#7C3AED" } : { color: "#64748b", borderColor: "#cbd5e1" }}>{l}</button>
                  ))}
                  <input value={busca} onChange={(e) => setBusca(e.target.value)} placeholder="Buscar pessoa…"
                    className="flex-1 min-w-[140px] px-3 py-1.5 rounded-lg border border-[#D1D7DB] text-xs bg-white text-slate-800" />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {filtro !== "pendentes" && (
                    <div className="bg-white rounded-xl border border-[#D1D7DB] p-4">
                      <div className="text-xs font-semibold text-slate-500 mb-2 flex items-center gap-1"><Check size={12} className="text-[#2563EB]" /> Confirmaram ({dados.acked.length})</div>
                      <div className="flex flex-col gap-1.5">
                        {dados.acked.filter(passa).map((u) => (
                          <div key={u.id} className="text-xs text-slate-700 flex items-center justify-between gap-2 min-w-0">
                            <span className="min-w-0 break-words">{u.name}</span>
                            <span className="text-[10px] text-slate-400 font-mono shrink-0">
                              {new Date(u.acked_at).toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" })} · {tempoDe(u)}
                            </span>
                          </div>
                        ))}
                        {dados.acked.length === 0 && <div className="text-xs text-slate-400">Ninguém ainda.</div>}
                      </div>
                    </div>
                  )}
                  {filtro !== "confirmaram" && (
                    <div className="bg-white rounded-xl border border-[#D1D7DB] p-4">
                      <div className="text-xs font-semibold text-slate-500 mb-2 flex items-center gap-1"><Clock size={12} className="text-amber-500" /> Pendentes ({dados.pending.length})</div>
                      <div className="flex flex-col gap-1.5">
                        {dados.pending.filter(passa).map((u) => (
                          <div key={u.id} className="text-xs text-slate-600 break-words">{u.name}</div>
                        ))}
                        {dados.pending.length === 0 && <div className="text-xs text-slate-400">Todo mundo já confirmou!</div>}
                      </div>
                      {dados.pending.length > 0 && (
                        <button onClick={copiarPendentes} className="mt-3 flex items-center gap-1.5 text-xs font-medium rounded-lg px-3 py-1.5 border border-[#2563EB] text-[#2563EB]">
                          <Copy size={12} /> Copiar lista de pendentes
                        </button>
                      )}
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {viewingAnnouncement && (
        <div
          className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60"
          onClick={() => setViewingAnnouncement(null)}
        >
          <div
            className="bg-white rounded-2xl w-full max-w-md shadow-2xl flex flex-col max-h-[85vh] overflow-hidden relative"
            onClick={(e) => e.stopPropagation()}
          >
            <button
              onClick={() => setViewingAnnouncement(null)}
              className="absolute top-3 right-3 z-10 w-7 h-7 rounded-full bg-black/40 hover:bg-black/60 text-white flex items-center justify-center"
            >
              <X size={15} />
            </button>
            <div className="overflow-y-auto flex-1 min-h-0">
              {viewingAnnouncement.image_url && (
                <button
                  onClick={() => setViewingImage({ url: viewingAnnouncement.image_url, name: "Comunicado" })}
                  className="block w-full"
                  title="Clique para ver em tamanho maior"
                >
                  <img
                    src={fileUrl(viewingAnnouncement.image_url)}
                    alt="Comunicado"
                    className="w-full max-h-[50vh] object-contain bg-black cursor-zoom-in"
                  />
                </button>
              )}
              <div className="p-6">
                <div className="flex items-center gap-2 text-red-600 mb-3">
                  <Megaphone size={20} />
                  <span className="text-xs font-semibold uppercase tracking-wide">Comunicado</span>
                </div>
                <p className="text-slate-800 text-[15px] whitespace-pre-wrap leading-relaxed select-text break-words [overflow-wrap:anywhere]">
                  {formatarTexto(viewingAnnouncement.message)}
                </p>
                <div className="text-[12px] text-slate-400 mt-4">
                  {viewingAnnouncement.created_by_name} · {new Date(viewingAnnouncement.created_at).toLocaleString("pt-BR")}
                </div>
                {isAdm && (
                  <button
                    onClick={() => abrirDados(viewingAnnouncement.id)}
                    className="mt-4 w-full rounded-lg py-2.5 text-sm font-semibold text-white flex items-center justify-center gap-2"
                    style={{ background: "#7C3AED" }}
                  >
                    <BarChart3 size={15} /> Dados
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
