import React, { useState, useEffect, useRef } from "react";
import { Plus, Users, ShieldCheck, Eye, EyeOff, Pin, PinOff, X, MailPlus, VolumeX } from "lucide-react";
import { useAuth } from "../context/AuthContext";
import { useTheme } from "../context/ThemeContext";
import { fileUrl } from "../api";

const fmtTime = (ts) => new Date(ts).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });

export default function Sidebar({ conversations, activeConvId, setActiveConvId, onNewGroup, onOpenUsers, onOpenMonitoring, onlineUsers, unreadCounts, onHideGroup, hiddenGroupsCount, onOpenHiddenGroups, onTogglePinConversation, onCloseConversation, onMarkUnread, escondidoNoMobile }) {
  const { user } = useAuth();
  const { colors } = useTheme();
  const [tab, setTab] = useState("all"); // all | groups | unread
  const isAdm = user.role === "admin";
  const [menuAberto, setMenuAberto] = useState(null); // { convId, x, y }
  const menuRef = useRef(null);

  useEffect(() => {
    if (!menuAberto) return;
    const fechar = () => setMenuAberto(null);
    window.addEventListener("click", fechar);
    window.addEventListener("contextmenu", fechar);
    return () => {
      window.removeEventListener("click", fechar);
      window.removeEventListener("contextmenu", fechar);
    };
  }, [menuAberto]);

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
    <div className={`w-full md:w-[320px] flex-col border-r ${escondidoNoMobile ? "hidden md:flex" : "flex"}`} style={{ background: colors.panelBg, borderColor: colors.border }}>
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

      {/* Lista de conversas — estilo Discord: só foto + nome, sem prévia de mensagem */}
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
              onContextMenu={(e) => {
                e.preventDefault();
                e.stopPropagation();
                setMenuAberto({ convId: c.id, x: e.clientX, y: e.clientY });
              }}
              className="group w-full flex items-center gap-3 pl-2.5 pr-2 py-2.5 rounded-lg text-left cursor-pointer transition-colors relative"
              style={{
                background: active ? colors.border : "transparent",
                borderLeft: active ? `3px solid ${colors.accent}` : "3px solid transparent",
              }}
              onMouseEnter={(e) => { if (!active) e.currentTarget.style.background = colors.borderLight ?? colors.border; }}
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
                  <span className="absolute bottom-0 right-0 w-3 h-3 rounded-full" style={{ background: colors.success || "#22C55E", border: `2px solid ${colors.panelBg}` }} />
                )}
              </div>
              <div className="min-w-0 flex-1 flex items-center justify-between gap-2">
                <span className="min-w-0 flex items-center gap-1">
                  {c.pinned && <Pin size={11} className="shrink-0" style={{ color: colors.accent }} />}
                  <span
                    className="text-[14px] truncate"
                    style={{ color: colors.textPrimary, fontWeight: naoLida ? 700 : 500 }}
                  >
                    {c.title}
                  </span>
                </span>
                {c.lastMessage && (
                  <span className="text-[11px] shrink-0" style={{ color: naoLida ? "#DC2626" : colors.textMuted || colors.textSecondary, fontWeight: naoLida ? 700 : 400 }}>
                    {fmtTime(c.lastMessage.created_at)}
                  </span>
                )}
              </div>
              {naoLida && (
                <span
                  className="min-w-[20px] h-[20px] px-1.5 rounded-full text-white text-[11px] font-bold shrink-0 flex items-center justify-center"
                  style={{ background: "#DC2626" }}
                  title={`${unreadCounts[c.id]} não lida(s)`}
                >
                  {unreadCounts[c.id] > 99 ? "99+" : unreadCounts[c.id]}
                </span>
              )}
            </div>
          );
        })}
        {filtered.length === 0 && <div className="text-center text-sm mt-8" style={{ color: colors.textSecondary }}>Nenhuma conversa encontrada</div>}
      </div>

      {/* Menu de botão direito: Fixar, Marcar como não lido, Fechar/Silenciar */}
      {menuAberto && (() => {
        const conv = conversations.find((c) => c.id === menuAberto.convId);
        if (!conv) return null;
        return (
          <div
            ref={menuRef}
            className="fixed z-50 rounded-lg py-1 w-[190px] shadow-lg"
            style={{ top: menuAberto.y, left: menuAberto.x, background: colors.panelBg, border: `1px solid ${colors.border}` }}
            onClick={(e) => e.stopPropagation()}
          >
            <button
              onClick={() => { onTogglePinConversation?.(conv.id, !conv.pinned); setMenuAberto(null); }}
              className="w-full flex items-center gap-2 px-3 py-2 text-[13px] text-left hover:opacity-80"
              style={{ color: colors.textPrimary }}
            >
              {conv.pinned ? <PinOff size={14} /> : <Pin size={14} />} {conv.pinned ? "Desafixar" : "Fixar"}
            </button>
            <button
              onClick={() => { onMarkUnread?.(conv.id); setMenuAberto(null); }}
              className="w-full flex items-center gap-2 px-3 py-2 text-[13px] text-left hover:opacity-80"
              style={{ color: colors.textPrimary }}
            >
              <MailPlus size={14} /> Marcar como não lido
            </button>
            {conv.type === "group" ? (
              <button
                onClick={() => { onHideGroup?.(conv.groupId, conv.title); setMenuAberto(null); }}
                className="w-full flex items-center gap-2 px-3 py-2 text-[13px] text-left hover:opacity-80"
                style={{ color: colors.textPrimary }}
              >
                <VolumeX size={14} /> Silenciar
              </button>
            ) : (
              <button
                onClick={() => { onCloseConversation?.(conv.id, conv.title); setMenuAberto(null); }}
                className="w-full flex items-center gap-2 px-3 py-2 text-[13px] text-left hover:opacity-80"
                style={{ color: "#DC2626" }}
              >
                <X size={14} /> Fechar conversa
              </button>
            )}
          </div>
        );
      })()}
    </div>

  );
}
