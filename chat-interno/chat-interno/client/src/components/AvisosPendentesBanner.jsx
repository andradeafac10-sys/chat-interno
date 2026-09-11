import React, { useEffect, useState } from "react";
import { Bell } from "lucide-react";
import { api } from "../api";
import { useAuth } from "../context/AuthContext";

// Avisos vermelhos no topo da tela do chat, todos no mesmo modelo:
// treinamento pendente, feedback/alinhamento pendente, rotina atrasada e
// tarefa atrasada. Cada um some sozinho quando zera, e volta a aparecer
// quando surge algo novo. Rotina e tarefa só existem pra ADM.
export default function AvisosPendentesBanner({ onVerTreinamentos, onVerFeedbacks, onVerRotinas, onVerTarefas, onVerReunioes }) {
  const { user } = useAuth();
  const isAdm = user?.role === "admin";
  const [contagens, setContagens] = useState({ treinamentos: 0, feedbacks: 0, rotinas: 0, tarefas: 0 });
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
    window.addEventListener("feedback:atualizado", carregar);
    return () => {
      clearInterval(intervalo);
      window.removeEventListener("rotina:atualizada", carregar);
      window.removeEventListener("feedback:atualizado", carregar);
    };
  }, [isAdm]); // eslint-disable-line react-hooks/exhaustive-deps

  const plural = (n, singular, pluralPalavra) => `${n} ${n > 1 ? pluralPalavra : singular}`;

  // Texto do tipo "começa em 15 minutos" / "acontecendo agora" pra reunião de hoje
  const quandoComeca = (inicio) => {
    const minutos = Math.round((new Date(inicio) - new Date()) / 60000);
    if (minutos <= 0) return "acontecendo agora";
    if (minutos < 60) return `começa em ${minutos} minuto${minutos > 1 ? "s" : ""}`;
    const hora = new Date(inicio).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
    return `hoje às ${hora}`;
  };

  const avisos = [
    reunioesHoje.length > 0 && {
      chave: "reunioes",
      titulo: reunioesHoje.length > 1 ? "REUNIÕES HOJE" : "REUNIÃO HOJE",
      texto: reunioesHoje.length === 1
        ? `${reunioesHoje[0].titulo} — ${quandoComeca(reunioesHoje[0].inicio)}.`
        : `Você tem ${reunioesHoje.length} reuniões hoje. A próxima: ${reunioesHoje[0].titulo} — ${quandoComeca(reunioesHoje[0].inicio)}.`,
      botao: "VER REUNIÕES",
      acao: onVerReunioes,
    },
    contagens.treinamentos > 0 && {
      chave: "treinamentos",
      titulo: "TREINAMENTO PENDENTE",
      texto: `Você possui ${plural(contagens.treinamentos, "treinamento pendente", "treinamentos pendentes")}.`,
      botao: "VER TREINAMENTOS",
      acao: onVerTreinamentos,
    },
    contagens.feedbacks > 0 && {
      chave: "feedbacks",
      titulo: "FEEDBACK/ALINHAMENTO PENDENTE",
      texto: `Você possui ${plural(contagens.feedbacks, "feedback/alinhamento aguardando", "feedbacks/alinhamentos aguardando")} sua ciência.`,
      botao: "VER FEEDBACKS",
      acao: onVerFeedbacks,
    },
    contagens.rotinas > 0 && {
      chave: "rotinas",
      titulo: "ROTINA ATRASADA",
      texto: `Você possui ${plural(contagens.rotinas, "rotina atrasada", "rotinas atrasadas")}.`,
      botao: "VER ROTINAS",
      acao: onVerRotinas,
    },
    contagens.tarefas > 0 && {
      chave: "tarefas",
      titulo: "TAREFA ATRASADA",
      texto: `Você possui ${plural(contagens.tarefas, "tarefa atrasada", "tarefas atrasadas")}.`,
      botao: "VER TAREFAS",
      acao: onVerTarefas,
    },
  ].filter(Boolean);

  if (avisos.length === 0) return null;

  return (
    <div className="flex flex-col gap-2 mx-3 mt-3">
      {avisos.map((aviso) => (
        <div
          key={aviso.chave}
          className="rounded-xl px-4 py-3 flex items-center gap-3"
          style={{ background: "#FEF2F2", border: "1px solid #FCA5A5" }}
        >
          <Bell size={18} className="text-red-500 shrink-0" />
          <div className="flex-1 min-w-0">
            <div className="text-[12.5px] font-bold text-red-600">{aviso.titulo}</div>
            <div className="text-[12px] text-red-500">{aviso.texto}</div>
          </div>
          <button
            onClick={aviso.acao}
            className="text-white text-[12px] font-semibold rounded-lg px-3 py-1.5 shrink-0"
            style={{ background: "#DC2626" }}
          >
            {aviso.botao}
          </button>
        </div>
      ))}
    </div>
  );
}
