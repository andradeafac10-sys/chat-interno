import React, { useState } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import {
  MessageCircle, Bell, MessageSquareText, GraduationCap, UserCog, Eye, LayoutGrid, CalendarCheck,
  ClipboardList, ListChecks, LifeBuoy, Users2, Repeat, Video, Settings, LogOut, Sun, Moon, X, MoreHorizontal, LayoutDashboard,
} from "lucide-react";
import { useTheme } from "../context/ThemeContext";

// Navegação do CELULAR: barra fixa embaixo + folha "Mais" com todos os itens
// da lateral. No computador isso não aparece (o LeftNav normal continua igual).
export default function MobileNav({ isAdm, unreadTotal, pendingFeedback, pendingTrilha, pendingRoutines, pendingTasks, reunioesHoje, chamadosVencendo = 0, onOpenAccount, onLogout, escondido }) {
  const navigate = useNavigate();
  const location = useLocation();
  const { theme, toggleTheme } = useTheme();
  const [maisAberto, setMaisAberto] = useState(false);

  const params = new URLSearchParams(location.search);
  const noGestao = location.pathname.startsWith("/gestao");
  const view = location.pathname === "/" ? params.get("view") || "chat" : null;
  const gestaoBadge = pendingRoutines + pendingTasks + reunioesHoje + chamadosVencendo;

  const ir = (destino) => { setMaisAberto(false); navigate(destino); };

  const abas = [
    { id: "chat", label: "Chat", icon: MessageCircle, badge: unreadTotal, ativo: view === "chat", acao: () => ir("/") },
    { id: "avisos", label: "Avisos", icon: Bell, ativo: view === "notificacoes", acao: () => ir("/?view=notificacoes") },
    { id: "treinos", label: "Treinos", icon: GraduationCap, badge: pendingTrilha, ativo: view === "trilha", acao: () => ir("/?view=trilha") },
    isAdm
      ? { id: "gestao", label: "Gestão", icon: LayoutDashboard, badge: gestaoBadge, ativo: noGestao, acao: () => ir("/gestao/minha-rotina") }
      : { id: "alinh", label: "Alinhamento", icon: MessageSquareText, badge: pendingFeedback, ativo: view === "feedbacks", acao: () => ir("/?view=feedbacks") },
  ];
  const maisAtivo = maisAberto || (view && !["chat", "notificacoes", "trilha"].includes(view) && !(!isAdm && view === "feedbacks"));

  const Selo = ({ n }) => (n > 0 ? <span className="mobnav-selo">{n > 99 ? "99+" : n}</span> : null);

  const Botao = ({ icon: Icon, label, badge, onClick, perigo }) => (
    <button onClick={onClick} className="mobnav-card" style={perigo ? { color: "#F87171" } : undefined}>
      <Selo n={badge} />
      <span className="mobnav-card-ico" style={perigo ? { background: "#7f1d1d" } : undefined}><Icon size={17} /></span>
      <span>{label}</span>
    </button>
  );

  return (
    <>
      {maisAberto && (
        <div className="mobnav-fundo md:hidden" onClick={() => setMaisAberto(false)}>
          <div className="mobnav-folha" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-1">
              <span className="text-[15px] font-semibold">Menu</span>
              <button onClick={() => setMaisAberto(false)} aria-label="Fechar"><X size={20} /></button>
            </div>

            {isAdm && (
              <>
                <div className="mobnav-sec">Gestão</div>
                <div className="mobnav-grid">
                  <Botao icon={LayoutGrid} label="Dashboard Rotinas" onClick={() => ir("/gestao")} />
                  <Botao icon={CalendarCheck} label="Minha Rotina" badge={pendingRoutines} onClick={() => ir("/gestao/minha-rotina")} />
                  <Botao icon={ClipboardList} label="Tarefas" badge={pendingTasks} onClick={() => ir("/gestao/tarefas")} />
                  <Botao icon={ListChecks} label="Demandas" onClick={() => ir("/gestao/demandas")} />
                  <Botao icon={LifeBuoy} label="Chamados" badge={chamadosVencendo} onClick={() => ir("/gestao/chamados")} />
                  <Botao icon={Users2} label="Dashboard Tarefas" onClick={() => ir("/gestao/tarefas-equipe")} />
                  <Botao icon={Repeat} label="Rotinas" onClick={() => ir("/gestao/rotinas")} />
                  <Botao icon={MessageSquareText} label="Alinhamento" badge={pendingFeedback} onClick={() => ir("/gestao/feedbacks")} />
                  <Botao icon={GraduationCap} label="Treinamentos" onClick={() => ir("/gestao/trilha")} />
                  <Botao icon={Video} label="Reuniões" badge={reunioesHoje} onClick={() => ir("/gestao/reuniao")} />
                </div>
                <div className="mobnav-sec">Painel</div>
                <div className="mobnav-grid">
                  <Botao icon={UserCog} label="Usuários" onClick={() => ir("/?view=users")} />
                  <Botao icon={Eye} label="Monitoria" onClick={() => ir("/?view=monitoring")} />
                </div>
              </>
            )}

            <div className="mobnav-sec">Conta</div>
            <div className="mobnav-grid">
              <Botao icon={Settings} label="Configurações" onClick={() => { setMaisAberto(false); onOpenAccount?.(); }} />
              <Botao icon={theme === "dark" ? Sun : Moon} label={theme === "dark" ? "Tema claro" : "Tema escuro"} onClick={toggleTheme} />
              <Botao icon={LogOut} label="Sair" perigo onClick={onLogout} />
            </div>
          </div>
        </div>
      )}

      {!escondido && (
        <nav className="mobnav md:hidden">
          {abas.map(({ id, label, icon: Icon, badge, ativo, acao }) => (
            <button key={id} onClick={acao} className={`mobnav-item ${ativo && !maisAberto ? "on" : ""}`}>
              <Selo n={badge} />
              <span className="mobnav-ico"><Icon size={18} /></span>
              <span>{label}</span>
            </button>
          ))}
          <button onClick={() => setMaisAberto((v) => !v)} className={`mobnav-item ${maisAtivo ? "on" : ""}`}>
            <span className="mobnav-ico"><MoreHorizontal size={18} /></span>
            <span>Mais</span>
          </button>
        </nav>
      )}
    </>
  );
}
