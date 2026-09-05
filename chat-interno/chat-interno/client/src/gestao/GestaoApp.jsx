import React, { useState } from "react";
import { Link, NavLink, Outlet } from "react-router-dom";
import {
  ArrowLeft, LayoutGrid, CalendarCheck, ClipboardList,
  Repeat, Trophy, Menu, X, MessageSquareText, GraduationCap,
} from "lucide-react";
import { useAuth } from "../context/AuthContext";

const MENU = [
  { to: "/gestao", end: true, label: "Visão Geral", icon: LayoutGrid },
  { to: "/gestao/minha-rotina", label: "Minha Rotina", icon: CalendarCheck },
  { to: "/gestao/tarefas", label: "Tarefas", icon: ClipboardList },
  { to: "/gestao/rotinas", label: "Rotinas", icon: Repeat },
  { to: "/gestao/ranking", label: "Ranking", icon: Trophy },
  { to: "/gestao/feedbacks", label: "Feedbacks", icon: MessageSquareText },
  { to: "/gestao/trilha", label: "Trilha do Conhecimento", icon: GraduationCap },
];

/**
 * Casca do Painel Gestão Nacional: barra lateral branca (272px) + área
 * principal. No celular vira um menu que abre por cima (☰ no topo).
 */
export default function GestaoApp() {
  const { user } = useAuth();
  const [menuAberto, setMenuAberto] = useState(false);

  return (
    <div className="w-screen h-screen flex flex-col md:flex-row" style={{ background: "#F7F9FB" }}>
      <div className="md:hidden h-14 flex items-center gap-3 px-4 border-b shrink-0 bg-white" style={{ borderColor: "#E6EAF0" }}>
        <button onClick={() => setMenuAberto(true)} style={{ color: "#14213D" }}>
          <Menu size={22} />
        </button>
        <div className="text-[13px] font-semibold" style={{ color: "#14213D" }}>Gestão Nacional</div>
      </div>

      {menuAberto && (
        <div className="md:hidden fixed inset-0 bg-black/50 z-40" onClick={() => setMenuAberto(false)} />
      )}

      <aside
        className={`w-[272px] shrink-0 flex flex-col border-r fixed md:static inset-y-0 left-0 z-50 transition-transform md:translate-x-0 bg-white ${
          menuAberto ? "translate-x-0" : "-translate-x-full"
        }`}
        style={{ borderColor: "#E6EAF0" }}
      >
        <div className="flex items-start gap-3" style={{ padding: "24px 24px 18px 28px" }}>
          <div className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0 mt-0.5" style={{ background: "#2563EB" }}>
            <LayoutGrid size={16} className="text-white" />
          </div>
          <div className="min-w-0 flex-1">
            <div className="truncate" style={{ fontSize: 16, fontWeight: 600, color: "#14213D" }}>
              Gestão Nacional
            </div>
            <div className="truncate mt-0.5" style={{ fontSize: 13, color: "#667085" }}>
              {user?.name}
            </div>
          </div>
          <button onClick={() => setMenuAberto(false)} className="md:hidden shrink-0" style={{ color: "#667085" }}>
            <X size={18} />
          </button>
        </div>

        <div className="mx-5 border-t" style={{ borderColor: "#EEF1F4" }} />

        <nav className="flex-1 overflow-y-auto py-3 px-3 flex flex-col gap-1">
          {MENU.map(({ to, end, label, icon: Icon }) => (
            <NavLink
              key={to}
              to={to}
              end={end}
              onClick={() => setMenuAberto(false)}
              className="flex items-center relative transition-colors"
              style={({ isActive }) => ({
                height: 47,
                paddingLeft: 16,
                paddingRight: 12,
                gap: 13,
                borderRadius: 6,
                background: isActive ? "#EFF4FF" : "transparent",
                color: isActive ? "#2563EB" : "#475467",
                fontSize: 14,
                fontWeight: 500,
              })}
            >
              {({ isActive }) => (
                <>
                  {isActive && (
                    <span className="absolute left-0 top-1/2 -translate-y-1/2" style={{ width: 3, height: "60%", background: "#2563EB", borderRadius: 0 }} />
                  )}
                  <Icon size={17} className="shrink-0" />
                  {label}
                </>
              )}
            </NavLink>
          ))}
        </nav>

        <div className="border-t px-3 py-3" style={{ borderColor: "#EEF1F4" }}>
          <Link
            to="/"
            className="flex items-center gap-2.5 px-3 py-2.5"
            style={{ fontSize: 14, fontWeight: 500, color: "#344054" }}
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
