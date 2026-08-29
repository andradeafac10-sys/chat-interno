import React, { useEffect, useRef, useState } from "react";
import { Search, Bell, ChevronDown, Megaphone, Sun, Moon, Settings, LogOut, ShieldCheck } from "lucide-react";
import { useAuth } from "../context/AuthContext";
import { useTheme } from "../context/ThemeContext";
import { fileUrl } from "../api";

/**
 * Barra global fixa no topo — logo, busca, notificações e o menu da conta
 * (que reúne comunicados, tema, configurações e sair, pra não sobrecarregar
 * a barra lateral esquerda com ícones).
 */
export default function Topbar({ onOpenAccount, onOpenAnnouncement, isOnline }) {
  const { user, logout } = useAuth();
  const { theme, toggleTheme, colors } = useTheme();
  const [menuAberto, setMenuAberto] = useState(false);
  const menuRef = useRef(null);
  const isDark = theme === "dark";

  useEffect(() => {
    if (!menuAberto) return;
    const fechar = (e) => { if (menuRef.current && !menuRef.current.contains(e.target)) setMenuAberto(false); };
    window.addEventListener("mousedown", fechar);
    return () => window.removeEventListener("mousedown", fechar);
  }, [menuAberto]);

  return (
    <div
      className="h-14 shrink-0 flex items-center gap-4 px-4"
      style={{ background: colors.topbarBg }}
    >
      <div className="flex items-center gap-2 shrink-0">
        <img src="/logo.svg" alt="" className="w-6 h-6" />
        <span className="text-white text-[14px] font-semibold hidden sm:inline">Chat Nacional</span>
      </div>

      <div className="flex-1 max-w-[420px] hidden md:block">
        <div className="relative">
          <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-white/50" />
          <input
            placeholder="Buscar conversa..."
            aria-label="Buscar conversa"
            disabled
            title="Em breve: busca global. Por enquanto, use a busca na barra lateral."
            className="w-full h-9 pl-9 pr-3 rounded-lg text-[13px] text-white placeholder-white/50 bg-white/10 outline-none cursor-not-allowed"
          />
        </div>
      </div>

      <div className="flex-1" />

      <button
        onClick={onOpenAnnouncement}
        title="Comunicados"
        aria-label="Comunicados"
        className="text-white/80 hover:text-white shrink-0"
      >
        <Bell size={18} />
      </button>

      <div className="w-px h-6 bg-white/15 shrink-0" />

      <div className="relative shrink-0" ref={menuRef}>
        <button
          onClick={() => setMenuAberto((v) => !v)}
          className="flex items-center gap-2"
          aria-label="Menu da conta"
        >
          <div className="relative">
            <div
              className="w-8 h-8 rounded-full flex items-center justify-center text-white text-[11px] font-semibold overflow-hidden"
              style={{ background: user.color }}
            >
              {user.avatar_url ? (
                <img src={fileUrl(user.avatar_url)} alt={user.name} className="w-full h-full object-cover" />
              ) : (
                user.name.split(" ").map((p) => p[0]).slice(0, 2).join("").toUpperCase()
              )}
            </div>
            {isOnline && (
              <span className="absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 rounded-full bg-[#22C55E]" style={{ border: `2px solid ${colors.topbarBg}` }} />
            )}
          </div>
          <ChevronDown size={14} className="text-white/70 hidden sm:block" />
        </button>

        {menuAberto && (
          <div
            className="absolute top-full right-0 mt-2 w-56 rounded-xl shadow-lg border py-1.5 z-50"
            style={{ background: colors.panelBg, borderColor: colors.border }}
          >
            <div className="px-3.5 py-2.5 border-b" style={{ borderColor: colors.borderLight || colors.border }}>
              <div className="text-[13px] font-semibold truncate" style={{ color: colors.textPrimary }}>{user.name}</div>
              <div className="flex items-center gap-1 text-[11px] mt-0.5" style={{ color: colors.accent }}>
                {user.role === "admin" && <ShieldCheck size={11} />}
                {user.role === "admin" ? "Administrador" : "Operador"}
              </div>
            </div>

            <button
              onClick={() => { setMenuAberto(false); onOpenAccount?.(); }}
              className="w-full flex items-center gap-2.5 px-3.5 py-2.5 text-[13px] hover:brightness-95 text-left"
              style={{ color: colors.textPrimary }}
            >
              <Settings size={15} /> Configurações
            </button>
            <button
              onClick={() => { setMenuAberto(false); toggleTheme(); }}
              className="w-full flex items-center gap-2.5 px-3.5 py-2.5 text-[13px] hover:brightness-95 text-left"
              style={{ color: colors.textPrimary }}
            >
              {isDark ? <Sun size={15} /> : <Moon size={15} />} {isDark ? "Tema claro" : "Tema escuro"}
            </button>
            <button
              onClick={() => { setMenuAberto(false); logout(); }}
              className="w-full flex items-center gap-2.5 px-3.5 py-2.5 text-[13px] hover:brightness-95 text-left"
              style={{ color: colors.danger || "#EF4444" }}
            >
              <LogOut size={15} /> Sair
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
