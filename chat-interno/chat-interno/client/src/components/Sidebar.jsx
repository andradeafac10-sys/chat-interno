import React, { useState } from "react";
import { Search, Plus, Users, Lock, ShieldCheck, LogOut, Settings, UserCog, Megaphone, Sun, Moon, Eye } from "lucide-react";
import { useAuth } from "../context/AuthContext";
import { useTheme } from "../context/ThemeContext";
import { fileUrl } from "../api";

const fmtTime = (ts) => new Date(ts).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });

function preview(last) {
  if (!last) return "";
  if (last.type === "text") return last.content;
  if (last.type === "image") return "📎 Foto";
  if (last.type === "audio") return "🎤 Áudio";
  return "📎 Arquivo";
}

export default function Sidebar({ conversations, activeConvId, setActiveConvId, onNewGroup, onOpenAccount, onOpenUsers, onOpenAnnouncement, onOpenMonitoring, onlineUsers, flashIds }) {
  const { user, logout } = useAuth();
  const { theme, toggleTheme, colors } = useTheme();
  const [filter, setFilter] = useState("");
  const [tab, setTab] = useState("all"); // all | groups | unread
  const isAdm = user.role === "admin";
  const isDark = theme === "dark";

  const filtered = conversations
    .filter((c) => c.title.toLowerCase().includes(filter.toLowerCase()))
    .filter((c) => {
      if (tab === "groups") return c.type === "group";
      if (tab === "unread") return flashIds?.has(c.id);
      return true;
    })
    .sort((a, b) => {
      const at = a.lastMessage?.created_at ? new Date(a.lastMessage.created_at).getTime() : 0;
      const bt = b.lastMessage?.created_at ? new Date(b.lastMessage.created_at).getTime() : 0;
      return bt - at;
    });

  return (
    <div className="w-[320px] flex flex-col border-r" style={{ background: colors.sidebarBg, borderColor: colors.border }}>
      <div className="flex items-center gap-2.5 px-3 py-3.5">
        <div className="w-9 h-9 rounded-full flex items-center justify-center text-white text-xs font-semibold shrink-0 overflow-hidden" style={{ background: user.color }}>
          {user.avatar_url ? (
            <img src={fileUrl(user.avatar_url)} alt={user.name} className="w-full h-full object-cover" />
          ) : (
            user.name.split(" ").map((p) => p[0]).slice(0, 2).join("").toUpperCase()
          )}
        </div>
        <div className="min-w-0 flex-1">
          <div className="text-sm font-medium truncate" style={{ color: colors.textPrimary }}>{user.name}</div>
          <div className="flex items-center gap-1 text-[11px] font-mono" style={{ color: isAdm ? "#2E6FD9" : colors.textSecondary }}>
            {isAdm && <ShieldCheck size={11} />}
            {isAdm ? "ADMINISTRADOR" : "OPERADOR"}
          </div>
        </div>
        <button onClick={onOpenAnnouncement} title="Comunicados" className="shrink-0" style={{ color: colors.textSecondary }}>
          <Megaphone size={16} />
        </button>
        <button onClick={toggleTheme} title={isDark ? "Tema claro" : "Tema escuro"} className="shrink-0" style={{ color: colors.textSecondary }}>
          {isDark ? <Sun size={16} /> : <Moon size={16} />}
        </button>
        <button onClick={onOpenAccount} title="Minha conta" className="shrink-0" style={{ color: colors.textSecondary }}>
          <Settings size={16} />
        </button>
        <button onClick={logout} title="Sair" className="shrink-0" style={{ color: colors.textSecondary }}>
          <LogOut size={16} />
        </button>
      </div>


      <div className="px-3 pb-2">
        <div className="relative">
          <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2" style={{ color: colors.textSecondary }} />
          <input
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
            placeholder="Buscar conversa"
            className="w-full text-sm rounded-lg pl-8 pr-3 py-2 border border-transparent focus:outline-none focus:border-[#2E6FD9]"
            style={{ background: colors.inputFieldBg, color: colors.textPrimary }}
          />
        </div>
      </div>

      {(
        <div className="px-3 pb-2 flex gap-1.5">
          {[
            { id: "all", label: "Todas" },
            { id: "groups", label: "Grupos" },
            { id: "unread", label: "Não lidos" },
          ].map((t) => (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className="flex-1 text-[12px] font-medium rounded-full py-1.5 transition-colors"
              style={{
                background: tab === t.id ? "#2E6FD9" : colors.inputFieldBg,
                color: tab === t.id ? "#0B1410" : colors.textSecondary,
              }}
            >
              {t.label}
            </button>
          ))}
        </div>
      )}

      {!isAdm && (
        <div className="mx-3 mb-2 flex items-start gap-2 rounded-lg border px-2.5 py-2" style={{ background: colors.inputFieldBg, borderColor: colors.border }}>
          <Lock size={13} className="mt-0.5 shrink-0" style={{ color: colors.textSecondary }} />
          <p className="text-[11px] leading-tight" style={{ color: colors.textSecondary }}>Você só conversa com o ADM e com os grupos em que foi adicionado.</p>
        </div>
      )}

      {isAdm && (
        <div className="px-3 pb-2">
          <button
            onClick={onNewGroup}
            className="w-full flex items-center justify-center gap-1.5 text-sm font-medium rounded-lg py-2 text-white"
            style={{ background: "#2E6FD9" }}
          >
            <Plus size={15} /> Novo grupo
          </button>
        </div>
      )}

      <div className="flex-1 overflow-y-auto px-1.5 pb-2">
        {filtered.map((c) => {
          const active = c.id === activeConvId;
          return (
            <button
              key={c.id}
              onClick={() => setActiveConvId(c.id)}
              className={`w-full flex items-center gap-2.5 px-2.5 py-2.5 rounded-lg text-left ${flashIds?.has(c.id) ? "flash-new-message" : ""}`}
              style={{ background: active ? colors.sidebarActive : "transparent" }}
            >
              <div className="w-10 h-10 rounded-full flex items-center justify-center text-white text-xs font-semibold shrink-0 overflow-hidden relative" style={{ background: c.type === "group" ? "#334155" : c.color || "#2E6FD9" }}>
                {c.avatarUrl ? (
                  <img src={fileUrl(c.avatarUrl)} alt={c.title} className="w-full h-full object-cover" />
                ) : c.type === "group" ? (
                  <Users size={16} />
                ) : (
                  c.title.split(" ").map((p) => p[0]).slice(0, 2).join("").toUpperCase()
                )}
                {c.type === "dm" && onlineUsers?.has(c.otherUserId) && (
                  <span className="absolute bottom-0 right-0 w-3 h-3 rounded-full bg-[#2E6FD9]" style={{ border: `2px solid ${colors.sidebarBg}` }} />
                )}
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium truncate" style={{ color: colors.textPrimary }}>{c.title}</span>
                  {c.lastMessage && <span className="text-[10px] font-mono shrink-0 ml-1" style={{ color: colors.textSecondary }}>{fmtTime(c.lastMessage.created_at)}</span>}
                  {flashIds?.has(c.id) && <span className="w-2 h-2 rounded-full bg-[#2E6FD9] shrink-0 ml-1" />}
                </div>
                <div className="text-[12px] truncate" style={{ color: colors.textSecondary }}>{preview(c.lastMessage) || (c.type === "group" ? `${c.memberCount} membro(s)` : "")}</div>
              </div>
            </button>
          );
        })}
        {filtered.length === 0 && <div className="text-center text-sm mt-8" style={{ color: colors.textSecondary }}>Nenhuma conversa encontrada</div>}
      </div>
    </div>
  );
}
