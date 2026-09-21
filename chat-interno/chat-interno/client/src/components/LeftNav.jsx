import React, { useEffect, useState } from "react";
import { NavLink, Link, useNavigate, useLocation } from "react-router-dom";
import {
  MessageCircle, Bell, MessageSquareText, GraduationCap, UserCog, Eye,
  LayoutDashboard, LayoutGrid, CalendarCheck, ClipboardList, Repeat, Trophy, Users2,
  Video, Settings, LogOut, ShieldCheck, Sun, Moon, ChevronLeft, ChevronRight,
} from "lucide-react";
import { useAuth } from "../context/AuthContext";
import { api, fileUrl } from "../api";
import { getSocket } from "../socket";
import { useTheme } from "../context/ThemeContext";

// Coluna de navegação fixa, única pro sistema inteiro — substitui o antigo
// menu suspenso do canto superior direito e o menu lateral que só existia
// dentro da Gestão. Aparece igual em qualquer tela (Chat ou Gestão), porque
// usa navegação de verdade (react-router) pros itens da Gestão, e um parâmetro
// na URL (?view=) pros itens do Chat, que não são rotas separadas.
export default function LeftNav({ unreadTotal = 0, onOpenAccount }) {
  const { user, logout } = useAuth();
  const { theme, toggleTheme, colors } = useTheme();
  const navigate = useNavigate();
  const location = useLocation();
  const isAdm = user.role === "admin";

  const [pendingFeedback, setPendingFeedback] = useState(0);
  const [pendingRoutines, setPendingRoutines] = useState(0);
  const [pendingTasks, setPendingTasks] = useState(0);
  const [pendingTrilha, setPendingTrilha] = useState(0);
  const [reunioesHoje, setReunioesHoje] = useState(0);

  // Recolher o menu (só ícones) — guardado no navegador, então continua do
  // jeito que a pessoa deixou mesmo depois de fechar e abrir de novo.
  const [colapsado, setColapsado] = useState(() => localStorage.getItem("chatinterno_menu_colapsado") === "1");
  useEffect(() => {
    localStorage.setItem("chatinterno_menu_colapsado", colapsado ? "1" : "0");
  }, [colapsado]);

  const carregarContadores = () => {
    api.get("/feedbacks/mine/pending-count").then(({ data }) => setPendingFeedback(data.count)).catch(() => {});
    api.get("/trilha/pendentes-count").then(({ data }) => setPendingTrilha(data.count)).catch(() => {});
    if (isAdm) {
      api.get("/gestao/recurrences/minhas/pendentes-count").then(({ data }) => setPendingRoutines(data.count)).catch(() => {});
      api.get("/gestao/tasks/minhas/atrasadas-count").then(({ data }) => setPendingTasks(data.count)).catch(() => {});
      api.get("/reunioes/hoje").then(({ data }) => setReunioesHoje(data.count)).catch(() => {});
    }
  };

  useEffect(() => {
    carregarContadores();
    const intervalo = setInterval(carregarContadores, 30000);
    const onRotina = () => carregarContadores();
    const onTarefa = () => carregarContadores();
    const onFeedbackAtualizado = () => carregarContadores();
    window.addEventListener("rotina:atualizada", onRotina);
    window.addEventListener("tarefa:atualizada", onTarefa);
    window.addEventListener("feedback:atualizado", onFeedbackAtualizado);

    const socket = getSocket();
    const onFeedbackNovo = () => setPendingFeedback((n) => n + 1);
    socket?.on("feedback:novo", onFeedbackNovo);

    return () => {
      clearInterval(intervalo);
      window.removeEventListener("rotina:atualizada", onRotina);
      window.removeEventListener("tarefa:atualizada", onTarefa);
      window.removeEventListener("feedback:atualizado", onFeedbackAtualizado);
      socket?.off("feedback:novo", onFeedbackNovo);
    };
  }, [isAdm]); // eslint-disable-line react-hooks/exhaustive-deps

  // Itens do Chat não são rotas próprias (vivem como estado dentro de Chat.jsx),
  // então navegar até eles é ir pra "/" com ?view=... — o Chat.jsx lê esse
  // parâmetro pra saber qual tela interna mostrar.
  const params = new URLSearchParams(location.search);
  const viewAtual = location.pathname === "/" ? params.get("view") || "chat" : null;

  const itemChatAtivo = (view) => viewAtual === view;
  const irPara = (view) => navigate(view === "chat" ? "/" : `/?view=${view}`);

  const ItemChat = ({ view, icon: Icon, label, badge }) => (
    <button
      onClick={() => irPara(view)}
      title={colapsado ? label : undefined}
      className={colapsado ? "w-full flex items-center justify-center py-2.5 relative transition-colors" : "w-full flex items-center justify-between gap-2.5 px-4 py-2.5 text-[12.5px] transition-colors"}
      style={{
        color: itemChatAtivo(view) ? colors.sidebarText : colors.sidebarTextSecondary,
        background: itemChatAtivo(view) ? colors.sidebarActive : "transparent",
        borderLeft: itemChatAtivo(view) ? "3px solid #2563EB" : "3px solid transparent",
        fontWeight: itemChatAtivo(view) ? 600 : 400,
      }}
    >
      {colapsado ? (
        <>
          <Icon size={17} />
          {badge > 0 && (
            <span className="absolute top-1 right-1/2 translate-x-3 w-2 h-2 rounded-full" style={{ background: "#EF4444" }} />
          )}
        </>
      ) : (
        <>
          <span className="flex items-center gap-2.5"><Icon size={15} /> {label}</span>
          {badge > 0 && (
            <span className="text-white text-[10px] font-bold rounded-full px-1.5 py-0.5 min-w-[17px] text-center shrink-0" style={{ background: "#EF4444" }}>
              {badge}
            </span>
          )}
        </>
      )}
    </button>
  );

  // Item de dentro da Gestão (Visão Geral, Minha Rotina...). Recolhido, vira
  // ícone sozinho com o nome em tooltip, na mesma coluna dos outros ícones.
  const ItemGestao = ({ to, end, icon: Icon, label, badge }) => (
    <NavLink
      to={to}
      end={end}
      title={colapsado ? label : undefined}
      className={colapsado ? "flex items-center justify-center py-2 relative" : "flex items-center justify-between py-1.5 text-[11.5px]"}
      style={gestaoLinkStyle}
    >
      {colapsado ? (
        <>
          <Icon size={15} />
          {badge > 0 && (
            <span className="absolute top-0.5 right-1/2 translate-x-3 w-2 h-2 rounded-full" style={{ background: "#EF4444" }} />
          )}
        </>
      ) : (
        <>
          <span className="flex items-center gap-1.5"><Icon size={12} /> {label}</span>
          {badge > 0 && (
            <span className="text-white font-bold rounded-full px-1.5 min-w-[15px] text-center" style={{ background: "#EF4444", fontSize: 9.5 }}>
              {badge}
            </span>
          )}
        </>
      )}
    </NavLink>
  );

  const gestaoLinkStyle = ({ isActive }) => ({
    color: isActive ? colors.sidebarText : colors.sidebarTextSecondary,
    fontWeight: isActive ? 600 : 400,
  });

  return (
    <div className={colapsado ? "w-[64px] h-full shrink-0 flex flex-col overflow-y-auto transition-all" : "w-[210px] h-full shrink-0 flex flex-col overflow-y-auto transition-all"} style={{ background: colors.sidebarBg }}>
      <div className={colapsado ? "px-0 pt-3.5 pb-3 flex items-center justify-center" : "px-4 pt-3.5 pb-3 flex items-center gap-2"}>
        <div className="w-6 h-6 rounded-md flex items-center justify-center shrink-0" style={{ background: "#2563EB" }}>
          <MessageCircle size={13} className="text-white" />
        </div>
        {!colapsado && <span className="text-white text-[12.5px] font-semibold truncate">Chat Nacional</span>}
      </div>

      <ItemChat view="chat" icon={MessageCircle} label="Chat" badge={unreadTotal} />
      <ItemChat view="notificacoes" icon={Bell} label="Notificação" />
      <ItemChat view="feedbacks" icon={MessageSquareText} label="Alinhamento" badge={pendingFeedback} />
      <ItemChat view="trilha" icon={GraduationCap} label="Treinamentos" badge={pendingTrilha} />

      {isAdm && (
        <>
          <ItemChat view="users" icon={UserCog} label="Usuários" />
          <ItemChat view="monitoring" icon={Eye} label="Monitoria" />

          {/* A linha separa só a Gestão do resto do menu */}
          <div className="h-px mx-4 my-2.5" style={{ background: colors.sidebarBorder }} />

          {!colapsado && (
            <div className="px-4 py-2.5 text-[12.5px] flex items-center gap-2.5" style={{ color: colors.sidebarTextSecondary }}>
              <LayoutDashboard size={15} /> Gestão
            </div>
          )}
          <div className={colapsado ? "flex flex-col items-center" : "flex flex-col ml-[27px] pl-5"} style={colapsado ? {} : { borderLeft: "1px solid #1E3555" }}>
            <ItemGestao to="/gestao" end icon={LayoutGrid} label="Visão Geral" />
            <ItemGestao to="/gestao/minha-rotina" icon={CalendarCheck} label="Minha Rotina" badge={pendingRoutines} />
            <ItemGestao to="/gestao/tarefas" icon={ClipboardList} label="Tarefas" badge={pendingTasks} />
            <ItemGestao to="/gestao/tarefas-equipe" icon={Users2} label="Painel da Equipe" />
            <ItemGestao to="/gestao/rotinas" icon={Repeat} label="Rotinas" />
            <ItemGestao to="/gestao/feedbacks" icon={MessageSquareText} label="Alinhamento" />
            <ItemGestao to="/gestao/trilha" icon={GraduationCap} label="Treinamentos" />
            <ItemGestao to="/gestao/reuniao" icon={Video} label="Reuniões" badge={reunioesHoje} />
          </div>
        </>
      )}

      <div className="flex-1" />

      <button
        onClick={() => setColapsado((v) => !v)}
        title={colapsado ? "Expandir menu" : "Recolher menu"}
        className={colapsado ? "flex items-center justify-center py-2 mx-2 mb-1 rounded-lg" : "flex items-center gap-2 px-4 py-2 mb-1 text-[11.5px]"}
        style={{ color: colors.sidebarTextSecondary, background: colors.sidebarHover }}
      >
        {colapsado ? <ChevronRight size={15} /> : <><ChevronLeft size={14} /> Recolher menu</>}
      </button>

      <div className={colapsado ? "border-t pt-3 pb-1 flex flex-col items-center" : "border-t px-4 pt-3 pb-1"} style={{ borderColor: colors.sidebarBorder }}>
        <div className={colapsado ? "mb-1" : "flex items-center gap-2 mb-1"} title={colapsado ? user.name : undefined}>
          <div className="rounded-full flex items-center justify-center text-white text-[10px] font-semibold overflow-hidden shrink-0" style={{ background: user.color, width: 26, height: 26 }}>
            {user.avatar_url ? <img src={fileUrl(user.avatar_url)} alt={user.name} className="w-full h-full object-cover" /> : user.name.split(" ").map((p) => p[0]).slice(0, 2).join("").toUpperCase()}
          </div>
          {!colapsado && (
            <div className="min-w-0">
              <div className="text-white text-[11.5px] font-semibold truncate">{user.name}</div>
              <div className="text-[10px] flex items-center gap-1" style={{ color: colors.sidebarTextSecondary }}>
                {isAdm && <ShieldCheck size={10} />} {isAdm ? "Administrador" : "Operador"}
              </div>
            </div>
          )}
        </div>
      </div>
      <button onClick={onOpenAccount} title={colapsado ? "Configurações" : undefined} className={colapsado ? "flex items-center justify-center py-2 text-[12.5px]" : "flex items-center gap-2.5 px-4 py-2 text-[12.5px]"} style={{ color: colors.sidebarTextSecondary }}>
        <Settings size={14} /> {!colapsado && "Configurações"}
      </button>
      <button onClick={toggleTheme} title={colapsado ? (theme === "dark" ? "Tema claro" : "Tema escuro") : undefined} className={colapsado ? "flex items-center justify-center py-2 text-[12.5px]" : "flex items-center gap-2.5 px-4 py-2 text-[12.5px]"} style={{ color: colors.sidebarTextSecondary }}>
        {theme === "dark" ? <Sun size={14} /> : <Moon size={14} />} {!colapsado && (theme === "dark" ? "Tema claro" : "Tema escuro")}
      </button>
      <button onClick={logout} title={colapsado ? "Sair" : undefined} className={colapsado ? "flex items-center justify-center py-2 mb-1 text-[12.5px]" : "flex items-center gap-2.5 px-4 py-2 mb-1 text-[12.5px]"} style={{ color: "#F87171" }}>
        <LogOut size={14} /> {!colapsado && "Sair"}
      </button>
    </div>
  );
}
