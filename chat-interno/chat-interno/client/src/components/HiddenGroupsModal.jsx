import React, { useEffect, useState } from "react";
import { X, Users, Eye } from "lucide-react";
import { api, fileUrl } from "../api";
import { useTheme } from "../context/ThemeContext";

/** Lista os grupos que a pessoa escondeu da própria lista, com opção de trazer de volta. */
export default function HiddenGroupsModal({ onClose, onChanged }) {
  const { colors } = useTheme();
  const [groups, setGroups] = useState([]);
  const [loading, setLoading] = useState(true);

  const load = () => {
    setLoading(true);
    api.get("/conversations/hidden-groups")
      .then(({ data }) => setGroups(data.groups))
      .finally(() => setLoading(false));
  };

  useEffect(() => { load(); }, []);

  const mostrar = async (groupId) => {
    await api.delete(`/conversations/groups/${groupId}/hide`);
    load();
    onChanged?.();
  };

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4" onClick={onClose}>
      <div className="rounded-xl w-[360px] max-h-[70vh] overflow-hidden flex flex-col" style={{ background: colors.panelBg }} onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between px-5 py-4 border-b" style={{ borderColor: colors.border }}>
          <h3 className="font-semibold text-base" style={{ color: colors.textPrimary }}>Grupos ocultos</h3>
          <button onClick={onClose} style={{ color: colors.textSecondary }}><X size={18} /></button>
        </div>

        <div className="overflow-y-auto p-3 flex flex-col gap-1.5">
          {loading && <div className="text-sm p-3" style={{ color: colors.textSecondary }}>Carregando...</div>}
          {!loading && groups.length === 0 && (
            <div className="text-sm p-3 text-center" style={{ color: colors.textSecondary }}>Nenhum grupo escondido.</div>
          )}
          {groups.map((g) => (
            <div key={g.id} className="flex items-center gap-3 rounded-lg px-3 py-2.5" style={{ background: colors.inputFieldBg }}>
              <div className="w-9 h-9 rounded-full flex items-center justify-center text-white shrink-0 overflow-hidden" style={{ background: "#334155" }}>
                {g.avatar_url ? <img src={fileUrl(g.avatar_url)} alt={g.name} className="w-full h-full object-cover" /> : <Users size={16} />}
              </div>
              <span className="text-sm flex-1 truncate" style={{ color: colors.textPrimary }}>{g.name}</span>
              <button
                onClick={() => mostrar(g.id)}
                className="flex items-center gap-1 text-[12px] font-medium px-2.5 py-1.5 rounded-lg text-white shrink-0"
                style={{ background: "#2563EB" }}
              >
                <Eye size={13} /> Mostrar
              </button>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
