import React, { useState } from "react";
import { Link, NavLink, Outlet } from "react-router-dom";
import {
  ArrowLeft, LayoutDashboard, CalendarCheck, ClipboardList,
  Repeat, Trophy, Menu, X,
} from "lucide-react";
import { useAuth } from "../context/AuthContext";
import { useTheme } from "../context/ThemeContext";

const MENU = [
  { to: "/gestao", end: true, label: "Visão Geral", icon: LayoutDashboard },
  { to: "/gestao/minha-rotina", label: "Minha Rotina", icon: CalendarCheck },
  { to: "/gestao/tarefas", label: "Tarefas", icon: ClipboardList },
  { to: "/gestao/rotinas", label: "Rotinas", icon: Repeat },
  { to: "/gestao/ranking", label: "Ranking", icon: Trophy },
];

/**
 * Casca do Painel Gestão Nacional: barra lateral + área de conteúdo.
 * No celular, a barra lateral vira um menu que abre por cima da tela
 * (aperta o ☰ no topo); no computador continua sempre visível do lado.
 */
export default function GestaoApp() {
  const { user } = useAuth();
  const { colors } = useTheme();
  const [menuAberto, setMenuAberto] = useState(false);

  return (
    <div className="w-screen h-screen flex flex-col md:flex-row" style={{ background: colors.chatBg }}>
      {/* Barra de topo — só aparece no celular */}
      <div
        className="md:hidden h-14 flex items-center gap-3 px-4 border-b shrink-0"
        style={{ background: colors.sidebarBg, borderColor: colors.border }}
      >
        <button onClick={() => setMenuAberto(true)} style={{ color: colors.textPrimary }}>
          <Menu size={22} />
        </button>
        <div className="text-[13px] font-semibold" style={{ color: colors.textPrimary }}>Gestão Nacional</div>
      </div>

      {/* Fundo escuro atrás do menu, só no celular quando está aberto */}
      {menuAberto && (
        <div
          className="md:hidden fixed inset-0 bg-black/50 z-40"
          onClick={() => setMenuAberto(false)}
        />
      )}

      <aside
        className={`w-[240px] shrink-0 flex flex-col border-r fixed md:static inset-y-0 left-0 z-50 transition-transform md:translate-x-0 ${
          menuAberto ? "translate-x-0" : "-translate-x-full"
        }`}
        style={{ background: colors.sidebarBg, borderColor: colors.border }}
      >
        <div className="h-16 flex items-center gap-2.5 px-4 border-b shrink-0" style={{ borderColor: colors.border }}>
          <LayoutDashboard size={20} className="text-[#2E6FD9] shrink-0" />
          <div className="min-w-0 flex-1">
            <div className="text-[13px] font-semibold truncate" style={{ color: colors.textPrimary }}>
              Gestão Nacional
            </div>
            <div className="text-[11px] truncate" style={{ color: colors.textSecondary }}>
              {user?.name}
            </div>
          </div>
          <button onClick={() => setMenuAberto(false)} className="md:hidden shrink-0" style={{ color: colors.textSecondary }}>
            <X size={18} />
          </button>
        </div>

        <nav className="flex-1 overflow-y-auto py-2 px-2 flex flex-col gap-0.5">
          {MENU.map(({ to, end, label, icon: Icon }) => (
            <NavLink
              key={to}
              to={to}
              end={end}
              onClick={() => setMenuAberto(false)}
              className="flex items-center gap-2.5 px-3 py-2.5 rounded-lg text-[13px] font-medium transition-colors"
              style={({ isActive }) => ({
                background: isActive ? colors.sidebarActive : "transparent",
                color: isActive ? "#2E6FD9" : colors.textSecondary,
              })}
            >
              <Icon size={16} className="shrink-0" />
              {label}
            </NavLink>
          ))}
        </nav>

        <div className="p-2 border-t" style={{ borderColor: colors.border }}>
          <Link
            to="/"
            className="flex items-center gap-2.5 px-3 py-2.5 rounded-lg text-[13px] font-medium"
            style={{ color: colors.textSecondary }}
          >
            <ArrowLeft size={16} className="shrink-0" />
            Voltar para o Chat
          </Link>
        </div>
      </aside>

      <main className="flex-1 overflow-y-auto">
        <Outlet />
      </main>
    </div>
  );
}
