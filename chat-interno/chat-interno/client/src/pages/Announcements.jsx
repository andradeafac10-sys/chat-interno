import React, { useEffect, useState } from "react";
import { ArrowLeft, Megaphone, Plus, ChevronDown, ChevronUp, Check, Clock, Trash2, Users as UsersIcon, User } from "lucide-react";
import { api, fileUrl } from "../api";
import NewAnnouncementModal from "../components/NewAnnouncementModal";
import { useAuth } from "../context/AuthContext";

export default function Announcements({ onBack }) {
  const { user } = useAuth();
  const isAdm = user.role === "admin";
  const [announcements, setAnnouncements] = useState([]);
  const [totalActive, setTotalActive] = useState(0);
  const [loading, setLoading] = useState(true);
  const [showNew, setShowNew] = useState(false);
  const [expandedId, setExpandedId] = useState(null);
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

  const toggleExpand = async (id) => {
    if (expandedId === id) {
      setExpandedId(null);
      return;
    }
    setExpandedId(id);
    if (!isAdm) return; // operador não vê a lista de quem confirmou
    if (!acks[id]) {
      const { data } = await api.get(`/announcements/${id}/acks`);
      setAcks((prev) => ({ ...prev, [id]: data }));
    }
  };

  return (
    <div className="flex-1 flex flex-col" style={{ background: "#EFEAE2" }}>
      <div className="h-16 flex items-center gap-3 px-4 border-b border-[#D1D7DB] bg-white shrink-0">
        <button onClick={onBack} className="text-slate-500 hover:text-slate-700">
          <ArrowLeft size={20} />
        </button>
        <div className="text-slate-800 text-sm font-semibold flex items-center gap-2">
          <Megaphone size={16} className="text-[#2E6FD9]" /> Comunicados gerais
        </div>
        {isAdm && (
          <button
            onClick={() => setShowNew(true)}
            className="ml-auto flex items-center gap-1.5 text-sm font-medium rounded-lg px-3 py-2 text-white"
            style={{ background: "#2E6FD9" }}
          >
            <Plus size={15} /> Novo comunicado
          </button>
        )}
      </div>

      <div className="flex-1 overflow-y-auto p-4">
        {loading ? (
          <div className="text-slate-400 text-sm">Carregando...</div>
        ) : error ? (
          <div className="text-red-500 text-sm">{error}</div>
        ) : announcements.length === 0 ? (
          <div className="text-slate-400 text-sm">Nenhum comunicado enviado ainda.</div>
        ) : (
          <div className="flex flex-col gap-3">
            {announcements.map((a) => (
              <div key={a.id} className="bg-white rounded-xl border border-[#D1D7DB] overflow-hidden">
                <button onClick={() => toggleExpand(a.id)} className="w-full text-left p-4 flex gap-3">
                  {a.image_url && (
                    <img src={fileUrl(a.image_url)} alt="" className="w-14 h-14 rounded-lg object-cover shrink-0" />
                  )}
                  <div className="min-w-0 flex-1">
                    <p className="text-sm text-slate-800 line-clamp-2">{a.message}</p>
                    <div className="text-[11px] text-slate-400 mt-1">
                      {a.created_by_name} · {new Date(a.created_at).toLocaleString("pt-BR")}
                    </div>
                    <div className="flex items-center gap-3 mt-1.5">
                      {isAdm && (
                        <div className="text-[12px] font-medium text-[#2E6FD9] flex items-center gap-1">
                          <Check size={13} /> {a.ack_count} de {totalActive} confirmaram
                        </div>
                      )}
                      <span className="text-[11px] text-slate-400 flex items-center gap-1">
                        {a.audience === "groups" ? <><UsersIcon size={11} /> Grupos escolhidos</>
                          : a.audience === "users" ? <><User size={11} /> Pessoas escolhidas</>
                          : <><Megaphone size={11} /> Todos</>}
                      </span>
                    </div>
                  </div>
                  <div className="shrink-0 flex items-center gap-1 text-slate-400">
                    {isAdm && (
                      <span
                        role="button"
                        onClick={(e) => { e.stopPropagation(); remove(a.id); }}
                        title="Apagar comunicado"
                        className="p-1.5 hover:text-red-500 cursor-pointer"
                      >
                        <Trash2 size={15} />
                      </span>
                    )}
                    {expandedId === a.id ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
                  </div>
                </button>

                {expandedId === a.id && !isAdm && (
                  <div className="border-t border-slate-100 p-4">
                    <p className="text-sm text-slate-700 whitespace-pre-wrap">{a.message}</p>
                    {a.image_url && (
                      <img src={fileUrl(a.image_url)} alt="" className="mt-3 rounded-lg max-h-72 object-contain" />
                    )}
                  </div>
                )}

                {expandedId === a.id && isAdm && (
                  <div className="border-t border-slate-100 p-4">
                    {!acks[a.id] ? (
                      <div className="text-xs text-slate-400">Carregando...</div>
                    ) : (
                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <div className="text-[11px] font-semibold text-slate-500 mb-2 flex items-center gap-1">
                            <Check size={12} className="text-[#2E6FD9]" /> Confirmaram ({acks[a.id].acked.length})
                          </div>
                          <div className="flex flex-col gap-1">
                            {acks[a.id].acked.map((u) => (
                              <div key={u.id} className="text-xs text-slate-700 flex items-center justify-between gap-2">
                                <span>{u.name}</span>
                                <span className="text-[10px] text-slate-400 font-mono shrink-0">
                                  {new Date(u.acked_at).toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" })}
                                </span>
                              </div>
                            ))}
                            {acks[a.id].acked.length === 0 && <div className="text-xs text-slate-400">Ninguém ainda.</div>}
                          </div>
                        </div>
                        <div>
                          <div className="text-[11px] font-semibold text-slate-500 mb-2 flex items-center gap-1">
                            <Clock size={12} className="text-amber-500" /> Ainda não viram ({acks[a.id].pending.length})
                          </div>
                          <div className="flex flex-col gap-1">
                            {acks[a.id].pending.map((u) => (
                              <div key={u.id} className="text-xs text-slate-500">{u.name}</div>
                            ))}
                            {acks[a.id].pending.length === 0 && <div className="text-xs text-slate-400">Todo mundo já viu!</div>}
                          </div>
                        </div>
                      </div>
                    )}
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
    </div>
  );
}
