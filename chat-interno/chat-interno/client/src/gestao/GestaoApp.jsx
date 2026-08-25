import React from "react";
import { Link, NavLink, Outlet } from "react-router-dom";
import {
  ArrowLeft, LayoutDashboard, CalendarCheck, ClipboardList, Users,
  CalendarDays, Repeat, Trophy, History as HistoryIcon,
} from "lucide-react";
import { useAuth } from "../context/AuthContext";
import { useTheme } from "../context/ThemeContext";

const MENU = [
  { to: "/gestao", end: true, label: "Visão Geral", icon: LayoutDashboard },
  { to: "/gestao/minha-rotina", label: "Minha Rotina", icon: CalendarCheck },
  { to: "/gestao/tarefas", label: "Tarefas", icon: ClipboardList },
  { to: "/gestao/equipe", label: "Equipe", icon: Users },
  { to: "/gestao/cronograma", label: "Cronograma", icon: CalendarDays },
  { to: "/gestao/rotinas", label: "Rotinas", icon: Repeat },
  { to: "/gestao/ranking", label: "Ranking", icon: Trophy },
  { to: "/gestao/historico", label: "Histórico", icon: HistoryIcon },
];

/**
 * Casca do Painel Gestão Nacional: barra lateral + área de conteúdo.
 * Cada item do menu é uma página própria, renderizada dentro do <Outlet/>.
 * (Etapa 2 — ainda sem dados reais; isso entra na Etapa 3 em diante.)
 */
export default function GestaoApp() {
  const { user } = useAuth();
  const { colors } = useTheme();

  return (
    <div className="w-screen h-screen flex" style={{ background: colors.chatBg }}>
      <aside
        className="w-[240px] shrink-0 flex flex-col border-r"
        style={{ background: colors.sidebarBg, borderColor: colors.border }}
      >
        <div className="h-16 flex items-center gap-2.5 px-4 border-b shrink-0" style={{ borderColor: colors.border }}>
          <LayoutDashboard size={20} className="text-[#2E6FD9] shrink-0" />
          <div className="min-w-0">
            <div className="text-[13px] font-semibold truncate" style={{ color: colors.textPrimary }}>
              Gestão Nacional
            </div>
            <div className="text-[11px] truncate" style={{ color: colors.textSecondary }}>
              {user?.name}
            </div>
          </div>
        </div>

        <nav className="flex-1 overflow-y-auto py-2 px-2 flex flex-col gap-0.5">
          {MENU.map(({ to, end, label, icon: Icon }) => (
            <NavLink
              key={to}
              to={to}
              end={end}
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
