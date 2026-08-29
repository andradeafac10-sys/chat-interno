import React, { useEffect, useState } from "react";
import { ShieldCheck } from "lucide-react";
import { api, fileUrl } from "../api";
import { useTheme } from "../context/ThemeContext";
import { useAuth } from "../context/AuthContext";

// Mesmo formato que o servidor usa pra identificar uma conversa privada
const pairDmId = (a, b) => {
  const [x, y] = [Number(a), Number(b)].sort((n, m) => n - m);
  return `dm-${x}-${y}`;
};

/**
 * Painel da direita: mostra todo mundo do sistema (online em cima, offline embaixo).
 * Clicar em alguém abre (ou começa) uma conversa privada com essa pessoa,
 * mesmo que vocês nunca tenham trocado mensagem ainda.
 */
export default function OnlinePanel({ onlineUsers, onOpenConversation }) {
  const { colors } = useTheme();
  const { user: me } = useAuth();
  const [users, setUsers] = useState([]);

  useEffect(() => {
    api.get("/users/directory").then(({ data }) => setUsers(data.users.filter((u) => u.id !== me.id)));
  }, [me.id]);

  const online = users.filter((u) => onlineUsers?.has(u.id));
  const offline = users.filter((u) => !onlineUsers?.has(u.id));

  const abrir = (u) => {
    onOpenConversation({
      id: pairDmId(me.id, u.id),
      type: "dm",
      title: u.name,
      color: u.color,
      avatarUrl: u.avatar_url,
      otherUserId: u.id,
      isAdmin: u.role === "admin",
    });
  };

  const Linha = ({ u, apagado }) => {
    const initials = u.name.split(" ").map((p) => p[0]).slice(0, 2).join("").toUpperCase();
    return (
      <button
        key={u.id}
        onClick={() => abrir(u)}
        className="w-full flex items-center gap-2.5 px-3 py-1.5 text-left"
        style={{ opacity: apagado ? 0.5 : 1 }}
      >
        <div className="relative w-7 h-7 shrink-0">
          <div className="w-7 h-7 rounded-full flex items-center justify-center text-white text-[10px] font-semibold overflow-hidden" style={{ background: u.color || "#2E6FD9" }}>
            {u.avatar_url ? <img src={fileUrl(u.avatar_url)} alt={u.name} className="w-full h-full object-cover" /> : initials}
          </div>
          {!apagado && (
            <span className="absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 rounded-full bg-[#22C55E]" style={{ border: `2px solid ${colors.sidebarBg}` }} />
          )}
        </div>
        <span className="text-sm truncate flex items-center gap-1" style={{ color: colors.textPrimary }}>
          {u.name}
          {u.role === "admin" && <ShieldCheck size={11} className="text-[#2E6FD9] shrink-0" />}
        </span>
      </button>
    );
  };

  return (
    <div className="hidden lg:block w-[200px] shrink-0 border-l overflow-y-auto py-3" style={{ background: colors.sidebarBg, borderColor: colors.border }}>
      <div className="px-3 pb-1.5 text-[11px] font-semibold tracking-wide" style={{ color: colors.textSecondary }}>
        ONLINE — {online.length}
      </div>
      {online.map((u) => <Linha key={u.id} u={u} />)}

      {offline.length > 0 && (
        <>
          <div className="px-3 pt-3 pb-1.5 text-[11px] font-semibold tracking-wide" style={{ color: colors.textSecondary }}>
            OFFLINE — {offline.length}
          </div>
          {offline.map((u) => <Linha key={u.id} u={u} apagado />)}
        </>
      )}
    </div>
  );
}
