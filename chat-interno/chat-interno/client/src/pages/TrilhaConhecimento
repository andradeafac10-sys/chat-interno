import React, { useEffect, useRef, useState } from "react";
import { ArrowLeft, Lock, CheckCircle2, PlayCircle, Circle } from "lucide-react";
import { api, fileUrl } from "../api";

export default function TrilhaConhecimento({ onBack }) {
  const [modulos, setModulos] = useState(null);
  const [moduloAberto, setModuloAberto] = useState(null); // id

  const carregar = () => {
    api.get("/trilha/modulos").then(({ data }) => setModulos(data.modulos));
  };

  useEffect(() => { carregar(); }, []);

  if (moduloAberto) {
    return (
      <ModuloView
        moduloId={moduloAberto}
        onVoltar={() => { setModuloAberto(null); carregar(); }}
        onConcluido={() => { setModuloAberto(null); carregar(); }}
      />
    );
  }

  return (
    <div className="flex-1 flex flex-col" style={{ background: "#F7F9FB" }}>
      <div className="h-16 flex items-center gap-3 px-4 border-b border-slate-200 bg-white shrink-0">
        <button onClick={onBack} className="text-slate-500 hover:text-slate-700"><ArrowLeft size={20} /></button>
        <div className="text-slate-800 text-sm font-semibold">Trilha do Conhecimento</div>
      </div>

      <div className="flex-1 overflow-y-auto p-6">
        <div className="max-w-2xl mx-auto flex flex-col gap-3">
          {modulos === null && <p className="text-sm text-slate-400">Carregando...</p>}
          {modulos?.length === 0 && (
            <p className="text-sm text-slate-400 text-center py-16">Nenhum módulo publicado ainda.</p>
          )}
          {modulos?.map((m, i) => {
            const status = m.progresso.passou ? "concluido" : m.bloqueado ? "bloqueado" : "disponivel";
            return (
              <button
                key={m.id}
                disabled={status === "bloqueado"}
                onClick={() => setModuloAberto(m.id)}
                className="bg-white rounded-xl border p-4 text-left flex items-center gap-3 disabled:opacity-60 disabled:cursor-not-allowed hover:border-[#2563EB] transition-colors"
                style={{ borderColor: status === "concluido" ? "#86EFAC" : "#E4E8EE" }}
              >
                <div className="shrink-0">
                  {status === "concluido" && <CheckCircle2 size={26} color="#16A34A" />}
                  {status === "disponivel" && <PlayCircle size={26} color="#2563EB" />}
                  {status === "bloqueado" && <Lock size={22} color="#94A3B8" />}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="text-[13px] font-semibold text-slate-500">Módulo {i + 1}</div>
                  <div className="text-[14.5px] font-semibold text-slate-800">{m.title}</div>
                  {m.description && <div className="text-[12.5px] text-slate-500 mt-0.5">{m.description}</div>}
                  {status === "bloqueado" && <div className="text-[11.5px] text-slate-400 mt-1">Termine o módulo anterior pra liberar</div>}
                  {status === "concluido" && <div className="text-[11.5px] text-emerald-600 font-medium mt-1">Concluído</div>}
                  {m.progresso.tentativas > 0 && !m.progresso.passou && status !== "bloqueado" && (
                    <div className="text-[11.5px] text-amber-600 font-medium mt-1">
                      {m.progresso.tentativas} tentativa{m.progresso.tentativas > 1 ? "s" : ""} — precisa assistir de novo
                    </div>
                  )}
                </div>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}

// Tela de um módulo: vídeo (sem poder adiantar) e, quando termina, a prova.
function ModuloView({ moduloId, onVoltar, onConcluido }) {
  const [dados, setDados] = useState(null);
  const [erro, setErro] = useState("");
  const [videoTerminou, setVideoTerminou] = useState(false);
  const videoRef = useRef(null);
  const maxTimeRef = useRef(0);

  useEffect(() => {
    api.get(`/trilha/modulos/${moduloId}`)
      .then(({ data }) => {
        setDados(data);
        setVideoTerminou(!!data.progresso.video_assistido);
        maxTimeRef.current = 0;
      })
      .catch((err) => setErro(err.response?.data?.error || "Não deu pra abrir esse módulo."));
  }, [moduloId]);

  const onTimeUpdate = () => {
    const v = videoRef.current;
    if (!v) return;
    if (v.currentTime > maxTimeRef.current) maxTimeRef.current = v.currentTime;
  };

  // O pulo do gato do "não pode adiantar": se a pessoa arrastar a barra pra
  // frente do que já assistiu de verdade, volta pro ponto máximo já visto.
  const onSeeking = () => {
    const v = videoRef.current;
    if (!v) return;
    if (v.currentTime > maxTimeRef.current + 0.5) {
      v.currentTime = maxTimeRef.current;
    }
  };

  const onEnded = () => {
    setVideoTerminou(true);
    api.post(`/trilha/modulos/${moduloId}/video-assistido`).catch(() => {});
  };

  if (erro) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center gap-3" style={{ background: "#F7F9FB" }}>
        <p className="text-sm text-red-500">{erro}</p>
        <button onClick={onVoltar} className="text-sm text-[#2563EB] font-medium">Voltar</button>
      </div>
    );
  }
  if (!dados) return <div className="flex-1 flex items-center justify-center" style={{ background: "#F7F9FB" }}><p className="text-sm text-slate-400">Carregando...</p></div>;

  return (
    <div className="flex-1 flex flex-col" style={{ background: "#F7F9FB" }}>
      <div className="h-16 flex items-center gap-3 px-4 border-b border-slate-200 bg-white shrink-0">
        <button onClick={onVoltar} className="text-slate-500 hover:text-slate-700"><ArrowLeft size={20} /></button>
        <div className="text-slate-800 text-sm font-semibold truncate">{dados.modulo.title}</div>
      </div>

      <div className="flex-1 overflow-y-auto p-6">
        <div className="max-w-2xl mx-auto">
          {dados.modulo.description && <p className="text-[13px] text-slate-600 mb-3">{dados.modulo.description}</p>}

          <div className="bg-black rounded-xl overflow-hidden mb-2">
            <video
              ref={videoRef}
              src={fileUrl(dados.modulo.video_url)}
              controls
              controlsList="nodownload noplaybackrate"
              onContextMenu={(e) => e.preventDefault()}
              onTimeUpdate={onTimeUpdate}
              onSeeking={onSeeking}
              onEnded={onEnded}
              className="w-full max-h-[60vh]"
              // Se já assistiu antes (voltou aqui de novo), libera arrastar à
              // vontade — a trava é só pra impedir pular no primeiro watch.
              key={videoTerminou ? "livre" : "travado"}
              onLoadedMetadata={() => { if (videoTerminou) maxTimeRef.current = 999999; }}
            />
          </div>
          {!videoTerminou && (
            <p className="text-[11.5px] text-slate-400 mb-6">Não dá pra adiantar o vídeo — assista até o fim pra liberar a prova.</p>
          )}

          {videoTerminou && dados.perguntas.length > 0 && (
            <Prova moduloId={moduloId} perguntas={dados.perguntas} onConcluido={onConcluido} onReprovou={() => setVideoTerminou(false)} />
          )}
          {videoTerminou && dados.perguntas.length === 0 && (
            <p className="text-[13px] text-slate-500 mt-6">Esse módulo ainda não tem prova cadastrada.</p>
          )}
        </div>
      </div>
    </div>
  );
}

function Prova({ moduloId, perguntas, onConcluido, onReprovou }) {
  const [respostas, setRespostas] = useState({});
  const [enviando, setEnviando] = useState(false);
  const [resultado, setResultado] = useState(null); // { passou, acertos, total }

  const todasRespondidas = perguntas.every((p) => respostas[p.id] != null);

  const enviar = async () => {
    setEnviando(true);
    try {
      const { data } = await api.post(`/trilha/modulos/${moduloId}/responder`, { respostas });
      setResultado(data);
      if (!data.passou) onReprovou();
    } catch (err) {
      alert(err.response?.data?.error || "Não deu pra enviar a prova.");
    } finally {
      setEnviando(false);
    }
  };

  if (resultado) {
    return (
      <div className="bg-white rounded-xl border p-5 text-center" style={{ borderColor: resultado.passou ? "#86EFAC" : "#FCA5A5" }}>
        {resultado.passou ? (
          <>
            <CheckCircle2 size={32} className="mx-auto text-emerald-500 mb-2" />
            <div className="text-[15px] font-semibold text-slate-800">Parabéns, você passou!</div>
            <div className="text-[12.5px] text-slate-500 mt-1">Acertou {resultado.acertos} de {resultado.total}</div>
            <button onClick={onConcluido} className="mt-4 rounded-lg py-2 px-5 text-sm font-semibold text-white" style={{ background: "#2563EB" }}>
              Continuar
            </button>
          </>
        ) : (
          <>
            <div className="text-[15px] font-semibold text-red-600">Não foi dessa vez</div>
            <div className="text-[12.5px] text-slate-500 mt-1">Acertou {resultado.acertos} de {resultado.total} — precisa acertar todas</div>
            <p className="text-[12px] text-slate-500 mt-2">Assista o vídeo de novo pra tentar outra vez.</p>
          </>
        )}
      </div>
    );
  }

  return (
    <div className="bg-white rounded-xl border p-5" style={{ borderColor: "#E4E8EE" }}>
      <div className="text-[14px] font-semibold text-slate-800 mb-4">Prova do módulo</div>
      <div className="flex flex-col gap-5">
        {perguntas.map((p, i) => (
          <div key={p.id}>
            <div className="text-[13.5px] font-medium text-slate-800 mb-2">{i + 1}. {p.question}</div>
            <div className="flex flex-col gap-1.5">
              {p.opcoes.map((o) => (
                <label key={o.id} className="flex items-center gap-2 text-[13px] text-slate-700 cursor-pointer">
                  <input
                    type="radio"
                    name={`pergunta-${p.id}`}
                    checked={respostas[p.id] === o.id}
                    onChange={() => setRespostas((prev) => ({ ...prev, [p.id]: o.id }))}
                    className="accent-[#2563EB]"
                  />
                  {o.text}
                </label>
              ))}
            </div>
          </div>
        ))}
      </div>
      <button
        onClick={enviar}
        disabled={!todasRespondidas || enviando}
        className="w-full mt-5 rounded-lg py-2.5 text-sm font-semibold text-white disabled:opacity-40"
        style={{ background: "#2563EB" }}
      >
        {enviando ? "Enviando..." : "Enviar prova"}
      </button>
    </div>
  );
}
