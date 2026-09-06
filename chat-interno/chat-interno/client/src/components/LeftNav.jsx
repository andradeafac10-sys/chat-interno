import React, { useEffect, useState } from "react";
import { NavLink, Link, useNavigate, useLocation } from "react-router-dom";
import {
  MessageCircle, Bell, MessageSquareText, GraduationCap, UserCog, Eye,
  LayoutDashboard, LayoutGrid, CalendarCheck, ClipboardList, Repeat, Trophy,
  Video, Settings, LogOut, ShieldCheck, Sun, Moon,
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
  const { theme, toggleTheme } = useTheme();
  const navigate = useNavigate();
  const location = useLocation();
  const isAdm = user.role === "admin";

  const [pendingFeedback, setPendingFeedback] = useState(0);
  const [pendingRoutines, setPendingRoutines] = useState(0);
  const [pendingTasks, setPendingTasks] = useState(0);
  const [pendingTrilha, setPendingTrilha] = useState(0);

  const carregarContadores = () => {
    api.get("/feedbacks/mine/pending-count").then(({ data }) => setPendingFeedback(data.count)).catch(() => {});
    api.get("/trilha/pendentes-count").then(({ data }) => setPendingTrilha(data.count)).catch(() => {});
    if (isAdm) {
      api.get("/gestao/recurrences/minhas/pendentes-count").then(({ data }) => setPendingRoutines(data.count)).catch(() => {});
      api.get("/gestao/tasks/minhas/pendentes-count").then(({ data }) => setPendingTasks(data.count)).catch(() => {});
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
      className="w-full flex items-center justify-between gap-2.5 px-4 py-2.5 text-[12.5px] transition-colors"
      style={{
        color: itemChatAtivo(view) ? "#fff" : "#B7C2D3",
        background: itemChatAtivo(view) ? "#12233D" : "transparent",
        borderLeft: itemChatAtivo(view) ? "3px solid #2563EB" : "3px solid transparent",
        fontWeight: itemChatAtivo(view) ? 600 : 400,
      }}
    >
      <span className="flex items-center gap-2.5"><Icon size={15} /> {label}</span>
      {badge > 0 && (
        <span className="text-white text-[10px] font-bold rounded-full px-1.5 py-0.5 min-w-[17px] text-center shrink-0" style={{ background: "#EF4444" }}>
          {badge}
        </span>
      )}
    </button>
  );

  const gestaoLinkStyle = ({ isActive }) => ({
    color: isActive ? "#fff" : "#8FA1BD",
    fontWeight: isActive ? 600 : 400,
  });

  return (
    <div className="w-[210px] h-full shrink-0 flex flex-col overflow-y-auto" style={{ background: "#081328" }}>
      <div className="px-4 pt-3.5 pb-3 flex items-center gap-2">
        <div className="w-6 h-6 rounded-md flex items-center justify-center shrink-0" style={{ background: "#2563EB" }}>
          <MessageCircle size={13} className="text-white" />
        </div>
        <span className="text-white text-[12.5px] font-semibold truncate">Chat Nacional</span>
      </div>

      <ItemChat view="chat" icon={MessageCircle} label="Chat" badge={unreadTotal} />
      <ItemChat view="notificacoes" icon={Bell} label="Notificação" />
      <ItemChat view="feedbacks" icon={MessageSquareText} label="Feedbacks" badge={pendingFeedback} />
      <ItemChat view="trilha" icon={GraduationCap} label="Trilha do Conhecimento" badge={pendingTrilha} />

      {isAdm && (
        <>
          <div className="h-px mx-4 my-2.5" style={{ background: "#1E3555" }} />

          <ItemChat view="users" icon={UserCog} label="Usuários" />
          <ItemChat view="monitoring" icon={Eye} label="Monitoria" />

          <div className="px-4 py-2.5 text-[12.5px] flex items-center gap-2.5" style={{ color: "#B7C2D3" }}>
            <LayoutDashboard size={15} /> Gestão
          </div>
          <div className="flex flex-col ml-[27px] pl-5" style={{ borderLeft: "1px solid #1E3555" }}>
            <NavLink to="/gestao" end className="flex items-center gap-1.5 py-1.5 text-[11.5px]" style={gestaoLinkStyle}>
              <LayoutGrid size={12} /> Visão Geral
            </NavLink>
            <NavLink to="/gestao/minha-rotina" className="flex items-center justify-between py-1.5 text-[11.5px]" style={gestaoLinkStyle}>
              <span className="flex items-center gap-1.5"><CalendarCheck size={12} /> Minha Rotina</span>
              {pendingRoutines > 0 && (
                <span className="text-white font-bold rounded-full px-1.5 min-w-[15px] text-center" style={{ background: "#EF4444", fontSize: 9.5 }}>
                  {pendingRoutines}
                </span>
              )}
            </NavLink>
            <NavLink to="/gestao/tarefas" className="flex items-center justify-between py-1.5 text-[11.5px]" style={gestaoLinkStyle}>
              <span className="flex items-center gap-1.5"><ClipboardList size={12} /> Tarefas</span>
              {pendingTasks > 0 && (
                <span className="text-white font-bold rounded-full px-1.5 min-w-[15px] text-center" style={{ background: "#EF4444", fontSize: 9.5 }}>
                  {pendingTasks}
                </span>
              )}
            </NavLink>
            <NavLink to="/gestao/rotinas" className="flex items-center gap-1.5 py-1.5 text-[11.5px]" style={gestaoLinkStyle}>
              <Repeat size={12} /> Rotinas
            </NavLink>
            <NavLink to="/gestao/ranking" className="flex items-center gap-1.5 py-1.5 text-[11.5px]" style={gestaoLinkStyle}>
              <Trophy size={12} /> Ranking
            </NavLink>
            <NavLink to="/gestao/feedbacks" className="flex items-center gap-1.5 py-1.5 text-[11.5px]" style={gestaoLinkStyle}>
              <MessageSquareText size={12} /> Feedbacks
            </NavLink>
            <NavLink to="/gestao/trilha" className="flex items-center gap-1.5 py-1.5 text-[11.5px]" style={gestaoLinkStyle}>
              <GraduationCap size={12} /> Trilha do Conhecimento
            </NavLink>
            <NavLink to="/gestao/reuniao" className="flex items-center gap-1.5 py-1.5 text-[11.5px]" style={gestaoLinkStyle}>
              <Video size={12} /> Reunião
              <span className="text-[8px] font-semibold rounded px-1 py-0.5 ml-0.5" style={{ background: "#334155", color: "#CBD5E1" }}>
                EM CONSTRUÇÃO
              </span>
            </NavLink>
          </div>
        </>
      )}

      <div className="flex-1" />

      <div className="border-t px-4 pt-3 pb-1" style={{ borderColor: "#1E3555" }}>
        <div className="flex items-center gap-2 mb-1">
          <div className="w-6.5 h-6.5 rounded-full flex items-center justify-center text-white text-[10px] font-semibold overflow-hidden shrink-0" style={{ background: user.color, width: 26, height: 26 }}>
            {user.avatar_url ? <img src={fileUrl(user.avatar_url)} alt={user.name} className="w-full h-full object-cover" /> : user.name.split(" ").map((p) => p[0]).slice(0, 2).join("").toUpperCase()}
          </div>
          <div className="min-w-0">
            <div className="text-white text-[11.5px] font-semibold truncate">{user.name}</div>
            <div className="text-[10px] flex items-center gap-1" style={{ color: "#8FA1BD" }}>
              {isAdm && <ShieldCheck size={10} />} {isAdm ? "Administrador" : "Operador"}
            </div>
          </div>
        </div>
      </div>
      <button onClick={onOpenAccount} className="flex items-center gap-2.5 px-4 py-2 text-[12.5px]" style={{ color: "#B7C2D3" }}>
        <Settings size={14} /> Configurações
      </button>
      <button onClick={toggleTheme} className="flex items-center gap-2.5 px-4 py-2 text-[12.5px]" style={{ color: "#B7C2D3" }}>
        {theme === "dark" ? <Sun size={14} /> : <Moon size={14} />} {theme === "dark" ? "Tema claro" : "Tema escuro"}
      </button>
      <button onClick={logout} className="flex items-center gap-2.5 px-4 py-2 mb-1 text-[12.5px]" style={{ color: "#F87171" }}>
        <LogOut size={14} /> Sair
      </button>
    </div>
  );
}
