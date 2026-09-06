import React, { useState } from "react";
import { Plus, Users, ShieldCheck, Eye, EyeOff, VolumeX, Pin, PinOff, X } from "lucide-react";
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

export default function Sidebar({ conversations, activeConvId, setActiveConvId, onNewGroup, onOpenUsers, onOpenMonitoring, onlineUsers, unreadCounts, onHideGroup, hiddenGroupsCount, onOpenHiddenGroups, onTogglePinConversation, onCloseConversation, escondidoNoMobile }) {
  const { user } = useAuth();
  const { colors } = useTheme();
  const [tab, setTab] = useState("all"); // all | groups | unread
  const isAdm = user.role === "admin";

  const filtered = conversations
    .filter((c) => {
      if (tab === "groups") return c.type === "group";
      if (tab === "unread") return !!unreadCounts?.[c.id];
      return true;
    })
    .sort((a, b) => {
      if (a.pinned && !b.pinned) return -1;
      if (!a.pinned && b.pinned) return 1;
      const at = a.lastMessage?.created_at ? new Date(a.lastMessage.created_at).getTime() : 0;
      const bt = b.lastMessage?.created_at ? new Date(b.lastMessage.created_at).getTime() : 0;
      return bt - at;
    });

  return (
    <div className={`w-full md:w-[320px] flex-col border-r ${escondidoNoMobile ? "hidden md:flex" : "flex"}`} style={{ background: colors.sidebarBg, borderColor: colors.border }}>
      {/* Filtros — segmented control discreto, sem virar tudo azul */}
      <div className="px-3 pb-2.5 pt-3 flex gap-1 p-0.5 rounded-lg" style={{ background: colors.chatBg }}>
        {[
          { id: "all", label: "Todas" },
          { id: "groups", label: "Grupos" },
          { id: "unread", label: "Não lidas" },
        ].map((t) => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className="flex-1 text-[12px] font-medium rounded-md py-1.5 transition-colors"
            style={{
              background: tab === t.id ? colors.surface || "#fff" : "transparent",
              color: tab === t.id ? colors.accent : colors.textSecondary,
              boxShadow: tab === t.id ? "0 1px 2px rgba(16,24,40,0.06)" : "none",
            }}
          >
            {t.label}
          </button>
        ))}
      </div>

      {isAdm && (
        <div className="px-3 pb-1">
          <button
            onClick={onNewGroup}
            className="w-full flex items-center gap-2 text-[13px] font-medium rounded-lg py-2 px-1"
            style={{ color: colors.accent }}
          >
            <Plus size={16} /> Novo grupo
          </button>
        </div>
      )}

      {hiddenGroupsCount > 0 && (
        <div className="px-3 pb-2">
          <button
            onClick={onOpenHiddenGroups}
            className="w-full flex items-center justify-center gap-1.5 text-[12px] font-medium py-1"
            style={{ color: colors.textSecondary }}
          >
            <EyeOff size={12} /> {hiddenGroupsCount} grupo(s) oculto(s) — mostrar
          </button>
        </div>
      )}

      {/* Lista de conversas */}
      <div className="flex-1 overflow-y-auto px-2 pb-2">
        {filtered.map((c) => {
          const active = c.id === activeConvId;
          const naoLida = unreadCounts?.[c.id] > 0;
          return (
            <div
              key={c.id}
              role="button"
              tabIndex={0}
              onClick={() => setActiveConvId(c.id)}
              onKeyDown={(e) => e.key === "Enter" && setActiveConvId(c.id)}
              className="group w-full flex items-center gap-3 pl-2.5 pr-2 py-2.5 rounded-lg text-left cursor-pointer transition-colors relative"
              style={{
                background: active ? colors.sidebarActive : "transparent",
                borderLeft: active ? `3px solid ${colors.accent}` : "3px solid transparent",
              }}
              onMouseEnter={(e) => { if (!active) e.currentTarget.style.background = colors.sidebarHover; }}
              onMouseLeave={(e) => { if (!active) e.currentTarget.style.background = "transparent"; }}
            >
              <div className="w-10 h-10 rounded-full flex items-center justify-center text-white text-xs font-semibold shrink-0 overflow-hidden relative" style={{ background: c.type === "group" ? "#334155" : c.color || colors.accent }}>
                {c.avatarUrl ? (
                  <img src={fileUrl(c.avatarUrl)} alt={c.title} className="w-full h-full object-cover" />
                ) : c.type === "group" ? (
                  <Users size={16} />
                ) : (
                  c.title.split(" ").map((p) => p[0]).slice(0, 2).join("").toUpperCase()
                )}
                {c.type === "dm" && onlineUsers?.has(c.otherUserId) && (
                  <span className="absolute bottom-0 right-0 w-3 h-3 rounded-full" style={{ background: colors.success || "#22C55E", border: `2px solid ${colors.sidebarBg}` }} />
                )}
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-center justify-between gap-2">
                  <span
                    className="text-[13.5px] truncate flex items-center gap-1"
                    style={{ color: colors.textPrimary, fontWeight: naoLida ? 700 : 600 }}
                  >
                    {c.pinned && <Pin size={11} className="shrink-0" style={{ color: colors.accent }} />}
                    {c.title}
                  </span>
                  {c.lastMessage && <span className="text-[11px] shrink-0 ml-1" style={{ color: colors.textMuted || colors.textSecondary }}>{fmtTime(c.lastMessage.created_at)}</span>}
                </div>
                <div className="flex items-center justify-between gap-2 mt-0.5">
                  <div className="text-[12.5px] truncate" style={{ color: colors.textSecondary }}>{preview(c.lastMessage) || (c.type === "group" ? `${c.memberCount} membro(s)` : "")}</div>
                  {naoLida && (
                    <span
                      className="min-w-[20px] h-[20px] px-1.5 rounded-full text-white text-[11px] font-bold shrink-0 flex items-center justify-center"
                      style={{ background: colors.accent }}
                      title={`${unreadCounts[c.id]} não lida(s)`}
                    >
                      {unreadCounts[c.id] > 99 ? "99+" : unreadCounts[c.id]}
                    </span>
                  )}
                </div>
              </div>
              <div className="shrink-0 flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity absolute right-2 top-2 rounded-md p-0.5" style={{ background: active ? colors.sidebarActive : colors.sidebarHover }}>
                <button
                  onClick={(e) => { e.stopPropagation(); onTogglePinConversation?.(c.id, !c.pinned); }}
                  title={c.pinned ? "Desafixar conversa" : "Fixar conversa no topo"}
                  aria-label={c.pinned ? "Desafixar conversa" : "Fixar conversa"}
                  className="p-1"
                  style={{ color: c.pinned ? colors.accent : colors.textSecondary }}
                >
                  {c.pinned ? <PinOff size={13} /> : <Pin size={13} />}
                </button>
                {c.type === "group" ? (
                  <button
                    onClick={(e) => { e.stopPropagation(); onHideGroup?.(c.groupId, c.title); }}
                    title="Silenciar (esconder da minha lista)"
                    aria-label="Silenciar grupo"
                    className="p-1"
                    style={{ color: colors.textSecondary }}
                  >
                    <VolumeX size={14} />
                  </button>
                ) : (
                  <button
                    onClick={(e) => { e.stopPropagation(); onCloseConversation?.(c.id, c.title); }}
                    title="Fechar (some da lista, histórico continua salvo)"
                    aria-label="Fechar conversa"
                    className="p-1"
                    style={{ color: colors.textSecondary }}
                  >
                    <X size={14} />
                  </button>
                )}
              </div>
            </div>
          );
        })}
        {filtered.length === 0 && <div className="text-center text-sm mt-8" style={{ color: colors.textSecondary }}>Nenhuma conversa encontrada</div>}
      </div>
    </div>
  );
}
