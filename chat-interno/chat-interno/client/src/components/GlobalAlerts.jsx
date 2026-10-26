import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { api } from "../api";
import { getSocket } from "../socket";
import AnnouncementOverlay from "./AnnouncementOverlay";
import ReuniaoAlertOverlay from "./ReuniaoAlertOverlay";
import AvisosPendentesBanner from "./AvisosPendentesBanner";
import PerfilObrigatorio from "./PerfilObrigatorio";
import AlinhamentoBloqueio from "./AlinhamentoBloqueio";

const DISMISSED_KEY = "chatinterno_dismissed_announcement";

// Barra de avisos (reunião hoje, treinamento, alinhamento, rotina, tarefa).
// Fica no topo de TODAS as telas do painel (Chat e Gestão).
export function AvisosBarra() {
  const navigate = useNavigate();
  return (
    <AvisosPendentesBanner
      onVerTreinamentos={() => navigate("/?view=trilha")}
      onVerFeedbacks={() => navigate("/?view=feedbacks")}
      onVerRotinas={() => navigate("/gestao/minha-rotina")}
      onVerTarefas={() => navigate("/gestao/tarefas")}
      onVerReunioes={() => navigate("/gestao/reuniao")}
      onVerChamados={() => navigate("/?view=chamados")}
    />
  );
}

// Alertas de tela cheia: comunicado (vermelho) e reunião 1h/5min antes (roxo).
// Montado em todas as telas do painel — não depende de estar no Chat.
export function AlertasTelaCheia() {
  const [announcement, setAnnouncement] = useState(null);
  const [reuniaoAlerta, setReuniaoAlerta] = useState(null);

  useEffect(() => {
    let cancelado = false;
    const checar = () => {
      api.get("/announcements/latest").then(({ data }) => {
        if (cancelado) return;
        const a = data.announcement;
        if (!a) return;
        if (String(a.id) === localStorage.getItem(DISMISSED_KEY)) return;
        setAnnouncement((prev) => (prev?.id === a.id ? prev : a));
      }).catch(() => {});
    };
    checar();
    const intervalo = setInterval(checar, 20000);
    return () => { cancelado = true; clearInterval(intervalo); };
  }, []);

  useEffect(() => {
    const socket = getSocket();
    if (!socket) return;
    const onNew = (a) => setAnnouncement(a);
    const onDeleted = ({ id }) => setAnnouncement((prev) => (prev && prev.id === id ? null : prev));
    const onCleared = () => setAnnouncement(null);
    const onReuniao = (alerta) => setReuniaoAlerta(alerta);
    socket.on("announcement:new", onNew);
    socket.on("announcement:deleted", onDeleted);
    socket.on("maintenance:announcements-cleared", onCleared);
    socket.on("reuniao:alerta-tela", onReuniao);
    return () => {
      socket.off("announcement:new", onNew);
      socket.off("announcement:deleted", onDeleted);
      socket.off("maintenance:announcements-cleared", onCleared);
      socket.off("reuniao:alerta-tela", onReuniao);
    };
  }, []);

  return (
    <>
      <AlinhamentoBloqueio />
      <PerfilObrigatorio />
      <AnnouncementOverlay
        key={announcement?.id || "nenhum"}
        announcement={announcement}
        onClose={() => {
          if (announcement) localStorage.setItem(DISMISSED_KEY, String(announcement.id));
          setAnnouncement(null);
        }}
      />
      {!announcement && (
        <ReuniaoAlertOverlay
          key={reuniaoAlerta ? `${reuniaoAlerta.reuniaoId}-${reuniaoAlerta.faltam}` : "nenhum"}
          alerta={reuniaoAlerta}
          onClose={() => setReuniaoAlerta(null)}
        />
      )}
    </>
  );
}
