import { playChamadoSound } from "../sound";
import React, { useEffect, useState } from "react";
import { Bell, Video, MessageSquareText, GraduationCap, Clock, AlertTriangle, LifeBuoy } from "lucide-react";
import { mostrarNotificacaoDesktop } from "../notifications";
import { getSocket } from "../socket";
import { api } from "../api";
import { useAuth } from "../context/AuthContext";

// Faixa fina e única no topo do chat, com um "pill" clicável pra cada aviso
// pendente (reunião hoje, treinamento, alinhamento, rotina e tarefa
// atrasada). Cada um some sozinho quando zera. Rotina e tarefa só pra ADM.
export default function AvisosPendentesBanner({ onVerTreinamentos, onVerFeedbacks, onVerRotinas, onVerTarefas, onVerReunioes, onVerChamados }) {
  const { user } = useAuth();
  const isAdm = user?.role === "admin";
  const [contagens, setContagens] = useState({ treinamentos: 0, feedbacks: 0, rotinas: 0, tarefas: 0, chamados: 0 });
  const [reunioesHoje, setReunioesHoje] = useState([]);

  const carregar = () => {
    api.get("/trilha/pendentes-count")
      .then(({ data }) => setContagens((c) => ({ ...c, treinamentos: data.count }))).catch(() => {});
    api.get("/feedbacks/mine/pending-count")
      .then(({ data }) => setContagens((c) => ({ ...c, feedbacks: data.count }))).catch(() => {});
    if (isAdm) {
      api.get("/gestao/recurrences/minhas/atrasadas-count")
        .then(({ data }) => setContagens((c) => ({ ...c, rotinas: data.count }))).catch(() => {});
      api.get("/gestao/tasks/minhas/atrasadas-count")
        .then(({ data }) => setContagens((c) => ({ ...c, tarefas: data.count }))).catch(() => {});
      api.get("/chamados/vencendo-count")
        .then(({ data }) => setContagens((c) => ({ ...c, chamados: data.count }))).catch(() => {});
      api.get("/reunioes/hoje")
        .then(({ data }) => setReunioesHoje(data.reunioes)).catch(() => {});
    }
  };

  useEffect(() => {
    carregar();
    // Reconfere de tempos em tempos: rotina/tarefa viram "atrasada" só pelo
    // relógio passar, sem ninguém fazer nada.
    const intervalo = setInterval(carregar, 30000);
    window.addEventListener("rotina:atualizada", carregar);
    window.addEventListener("chamado:atualizado", carregar);
    let sock; const onNovo = (d) => { carregar(); playChamadoSound(); mostrarNotificacaoDesktop({ titulo: d.titulo, corpo: d.corpo }); };
    try { sock = getSocket(); sock?.on("chamado:novo", onNovo); } catch {}
    window.addEventListener("feedback:atualizado", carregar);
    return () => {
      clearInterval(intervalo);
      window.removeEventListener("rotina:atualizada", carregar);
      window.removeEventListener("chamado:atualizado", carregar);
      try { sock?.off("chamado:novo", onNovo); } catch {}
      window.removeEventListener("feedback:atualizado", carregar);
    };
  }, [isAdm]); // eslint-disable-line react-hooks/exhaustive-deps

  // Texto curto tipo "agora" / "em 15 min" / "às 14:00" pra caber no pill
  const quandoComeca = (inicio) => {
    const minutos = Math.round((new Date(inicio) - new Date()) / 60000);
    if (minutos <= 0) return "agora";
    if (minutos < 60) return `em ${minutos} min`;
    return `às ${new Date(inicio).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}`;
  };

  const avisos = [
    reunioesHoje.length > 0 && {
      chave: "reunioes",
      icone: Video,
      texto: reunioesHoje.length === 1
        ? `Reunião ${quandoComeca(reunioesHoje[0].inicio)}`
        : `${reunioesHoje.length} reuniões hoje`,
      acao: onVerReunioes,
    },
    contagens.treinamentos > 0 && {
      chave: "treinamentos",
      icone: GraduationCap,
      texto: `${contagens.treinamentos} treinamento${contagens.treinamentos > 1 ? "s" : ""} pendente${contagens.treinamentos > 1 ? "s" : ""}`,
      acao: onVerTreinamentos,
    },
    contagens.feedbacks > 0 && {
      chave: "feedbacks",
      icone: MessageSquareText,
      texto: `${contagens.feedbacks} alinhamento${contagens.feedbacks > 1 ? "s" : ""}`,
      acao: onVerFeedbacks,
    },
    contagens.rotinas > 0 && {
      chave: "rotinas",
      icone: Clock,
      texto: `${contagens.rotinas} rotina${contagens.rotinas > 1 ? "s" : ""} atrasada${contagens.rotinas > 1 ? "s" : ""}`,
      acao: onVerRotinas,
    },
    contagens.tarefas > 0 && {
      chave: "tarefas",
      icone: AlertTriangle,
      texto: `${contagens.tarefas} tarefa${contagens.tarefas > 1 ? "s" : ""} atrasada${contagens.tarefas > 1 ? "s" : ""}`,
      acao: onVerTarefas,
    },
    contagens.chamados > 0 && {
      chave: "chamados",
      icone: LifeBuoy,
      texto: `${contagens.chamados} chamado${contagens.chamados > 1 ? "s" : ""} vencendo`,
      acao: onVerChamados,
    },
  ].filter(Boolean);

  if (avisos.length === 0) return null;

  return (
    <div
      className="avisos-barra flex items-center gap-2 flex-wrap px-4 py-2.5 w-full rounded-2xl"
      style={{ background: "#5B21B6" }}
    >
      <Bell size={16} className="shrink-0" style={{ color: "#FFFFFF" }} />
      {avisos.map((aviso) => {
        const Icone = aviso.icone;
        return (
          <button
            key={aviso.chave}
            onClick={aviso.acao}
            className="flex items-center gap-1.5 text-[12px] font-semibold rounded-full pl-2.5 pr-3 py-1.5 shrink-0 transition-all hover:brightness-125"
            style={{ background: "rgba(255,255,255,0.18)", color: "#FFFFFF" }}
          >
            <Icone size={13} />
            {aviso.texto}
          </button>
        );
      })}
    </div>
  );
}
