import React, { useEffect, useRef, useState } from "react";
import { ArrowLeft, Lock, CheckCircle2, PlayCircle, FileQuestion, Play, Pause, Volume2, VolumeX, StickyNote, X } from "lucide-react";
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
        onVoltar={() => { setModuloAberto(null); carregar(); window.dispatchEvent(new Event("rotina:atualizada")); }}
        onConcluido={() => { setModuloAberto(null); carregar(); window.dispatchEvent(new Event("rotina:atualizada")); }}
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
          {modulos?.length > 0 && <ResumoTrilha modulos={modulos} />}
          {modulos === null && <p className="text-sm text-slate-400">Carregando...</p>}
          {modulos?.length === 0 && (
            <p className="text-sm text-slate-400 text-center py-16">Nenhum treinamento publicado ainda.</p>
          )}
          {modulos?.map((m, i) => {
            const status = m.progresso.concluido_em ? "concluido" : m.bloqueado ? "bloqueado" : "disponivel";
            const IconeTipo = m.tipo === "avaliacao" ? FileQuestion : PlayCircle;
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
                  {status === "disponivel" && <IconeTipo size={26} color="#2563EB" />}
                  {status === "bloqueado" && <Lock size={22} color="#94A3B8" />}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="text-[13px] font-semibold text-slate-500">
                    Treinamento {i + 1} · {m.tipo === "avaliacao" ? "Avaliação" : "Vídeo"}
                  </div>
                  <div className="text-[14.5px] font-semibold text-slate-800">{m.title}</div>
                  {m.description && <div className="text-[12.5px] text-slate-500 mt-0.5">{m.description}</div>}
                  {status === "bloqueado" && <div className="text-[11.5px] text-slate-400 mt-1">Termine o treinamento anterior pra liberar</div>}
                  {status === "concluido" && (
                    <div className="text-[11.5px] text-emerald-600 font-medium mt-1">
                      Concluído {m.progresso.ultima_nota != null ? `— nota ${m.progresso.ultima_nota}%` : ""}
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

// Barra de resumo no topo da lista: quantos treinamentos já foram concluídos
// e a nota média geral (só considerando os que já têm nota).
function ResumoTrilha({ modulos }) {
  const total = modulos.length;
  const concluidos = modulos.filter((m) => m.progresso.concluido_em).length;
  const notas = modulos.map((m) => m.progresso.ultima_nota).filter((n) => n != null);
  const mediaGeral = notas.length > 0 ? Math.round(notas.reduce((a, b) => a + b, 0) / notas.length) : null;
  const percentual = total > 0 ? Math.round((concluidos / total) * 100) : 0;

  return (
    <div className="bg-white rounded-xl border p-4 mb-1" style={{ borderColor: "#E4E8EE" }}>
      <div className="flex items-center justify-between mb-2">
        <span className="text-[12.5px] font-semibold text-slate-700">Seu progresso na trilha</span>
        <span className="text-[12px] text-slate-500">{concluidos} de {total} treinamentos concluídos</span>
      </div>
      <div className="h-2 rounded-full bg-slate-100 overflow-hidden mb-3">
        <div className="h-full" style={{ width: `${percentual}%`, background: "#2563EB" }} />
      </div>
      <div className="flex items-center gap-4">
        <div className="text-[12px] text-slate-500">
          <span className="font-semibold" style={{ color: "#2563EB" }}>{percentual}%</span> concluído
        </div>
        {mediaGeral != null && (
          <div className="text-[12px] text-slate-500">
            Nota média geral: <span className="font-semibold" style={{ color: mediaGeral === 100 ? "#16A34A" : mediaGeral >= 50 ? "#EA4E1B" : "#DC2626" }}>{mediaGeral}%</span>
          </div>
        )}
      </div>
    </div>
  );
}

// Tela de um treinamento: vídeo (se tiver, sem poder adiantar/voltar) e a
// prova, pergunta por pergunta (2 tentativas cada, alternativas embaralhadas).
function ModuloView({ moduloId, onVoltar, onConcluido }) {
  const [dados, setDados] = useState(null);
  const [erro, setErro] = useState("");
  const [videoTerminou, setVideoTerminou] = useState(false);
  const [mostrarAnotacao, setMostrarAnotacao] = useState(false);

  const carregar = () => {
    api.get(`/trilha/modulos/${moduloId}`)
      .then(({ data }) => {
        setDados(data);
        setVideoTerminou(data.modulo.tipo === "avaliacao" || !!data.progresso.video_assistido);
      })
      .catch((err) => setErro(err.response?.data?.error || "Não deu pra abrir esse treinamento."));
  };
  useEffect(() => { carregar(); }, [moduloId]); // eslint-disable-line react-hooks/exhaustive-deps

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
        <div className="text-slate-800 text-sm font-semibold truncate flex-1">{dados.modulo.title}</div>
        <button
          onClick={() => setMostrarAnotacao(true)}
          className="flex items-center gap-1.5 text-[12.5px] font-medium text-slate-600 hover:text-[#2563EB] shrink-0"
        >
          <StickyNote size={16} /> Anotação
        </button>
      </div>

      <div className="flex-1 overflow-y-auto p-6">
        <div className="max-w-2xl mx-auto">
          {dados.modulo.description && <p className="text-[13px] text-slate-600 mb-3">{dados.modulo.description}</p>}

          {dados.modulo.tipo === "video" && (
            <VideoPlayer
              videoUrl={dados.modulo.video_url}
              jaAssistiu={!!dados.progresso.video_assistido}
              onTerminou={() => {
                setVideoTerminou(true);
                api.post(`/trilha/modulos/${moduloId}/video-assistido`).catch(() => {});
              }}
            />
          )}
          {dados.modulo.tipo === "video" && !videoTerminou && (
            <p className="text-[11.5px] text-slate-400 mb-6">Não dá pra adiantar nem voltar o vídeo — assista até o fim pra liberar a prova.</p>
          )}

          {videoTerminou && dados.progresso.concluido_em && (
            <ResultadoFinal perguntas={dados.perguntas} nota={dados.progresso.ultima_nota} />
          )}
          {videoTerminou && !dados.progresso.concluido_em && dados.perguntas.length > 0 && (
            <Prova moduloId={moduloId} perguntasIniciais={dados.perguntas} onConcluido={onConcluido} />
          )}
          {videoTerminou && !dados.progresso.concluido_em && dados.perguntas.length === 0 && (
            <div className="bg-white rounded-xl border p-5 text-center" style={{ borderColor: "#E4E8EE" }}>
              <p className="text-[13px] text-slate-500 mb-3">Esse treinamento ainda não tem prova cadastrada.</p>
              <button
                onClick={async () => { await api.post(`/trilha/modulos/${moduloId}/concluir`); onConcluido(); }}
                className="rounded-lg py-2 px-5 text-sm font-semibold text-white"
                style={{ background: "#2563EB" }}
              >
                Marcar como concluído
              </button>
            </div>
          )}
        </div>
      </div>

      {mostrarAnotacao && <AnotacaoModal moduloId={moduloId} onClose={() => setMostrarAnotacao(false)} />}
    </div>
  );
}

function VideoPlayer({ videoUrl, jaAssistiu, onTerminou }) {
  const [tocando, setTocando] = useState(false);
  const [mudo, setMudo] = useState(false);
  const [tempoAtual, setTempoAtual] = useState(0);
  const [duracao, setDuracao] = useState(0);
  const videoRef = useRef(null);

  // Trava total: não dá pra arrastar a barra nem pra frente nem pra trás — a
  // única forma de garantir isso é não ter barra clicável nenhuma, só os
  // nossos botões (o navegador sempre desenha uma barra arrastável junto do
  // "controls" nativo, mesmo escondendo pedaços dela).
  const onSeeking = () => {
    const v = videoRef.current;
    if (!v || jaAssistiu) return; // já assistiu antes: libera arrastar à vontade
    if (Math.abs(v.currentTime - tempoAtual) > 0.5) v.currentTime = tempoAtual;
  };

  const alternarPlay = () => {
    const v = videoRef.current;
    if (!v) return;
    if (v.paused) { v.play(); setTocando(true); } else { v.pause(); setTocando(false); }
  };

  const fmt = (s) => {
    if (!Number.isFinite(s)) return "0:00";
    const m = Math.floor(s / 60);
    const sec = Math.floor(s % 60);
    return `${m}:${String(sec).padStart(2, "0")}`;
  };

  return (
    <div className="bg-black rounded-xl overflow-hidden mb-2">
      <video
        ref={videoRef}
        src={fileUrl(videoUrl)}
        controlsList="nodownload noplaybackrate"
        onContextMenu={(e) => e.preventDefault()}
        onClick={alternarPlay}
        onTimeUpdate={(e) => setTempoAtual(e.target.currentTime)}
        onSeeking={onSeeking}
        onEnded={() => { setTocando(false); onTerminou(); }}
        onLoadedMetadata={(e) => setDuracao(e.target.duration)}
        className="w-full max-h-[60vh] cursor-pointer"
      />
      <div className="flex items-center gap-3 px-3 py-2" style={{ background: "#111827" }}>
        <button onClick={alternarPlay} className="text-white shrink-0">
          {tocando ? <Pause size={18} /> : <Play size={18} />}
        </button>
        <div className="flex-1 h-1.5 rounded-full bg-white/20 overflow-hidden">
          <div className="h-full bg-white" style={{ width: duracao ? `${(tempoAtual / duracao) * 100}%` : "0%" }} />
        </div>
        <span className="text-[11px] text-white/70 shrink-0 font-mono">{fmt(tempoAtual)} / {fmt(duracao)}</span>
        <button onClick={() => { const v = videoRef.current; if (v) { v.muted = !v.muted; setMudo(v.muted); } }} className="text-white shrink-0">
          {mudo ? <VolumeX size={16} /> : <Volume2 size={16} />}
        </button>
      </div>
    </div>
  );
}

// Embaralha um array sem alterar o original (usado pra reembaralhar as 4
// alternativas antes da 2ª tentativa)
function embaralhar(lista) {
  return [...lista].sort(() => Math.random() - 0.5);
}

// Depois de concluído, a prova nunca mais pode ser refeita — só mostra o
// resultado final que já ficou registrado. A pessoa ainda pode reassistir o
// vídeo e mexer na anotação à vontade, só não responde as perguntas de novo.
function ResultadoFinal({ perguntas, nota }) {
  const acertos = perguntas.filter((p) => p.minhaTentativa?.acertou).length;
  const erros = perguntas.length - acertos;

  return (
    <div className="bg-white rounded-xl border p-5" style={{ borderColor: "#E4E8EE" }}>
      <div className="flex items-center gap-2 mb-3">
        <CheckCircle2 size={20} className="text-emerald-500" />
        <div className="text-[14px] font-semibold text-slate-800">Treinamento já concluído</div>
      </div>
      <div className="text-[13px] text-slate-600 mb-4">
        Nota final: <b>{nota}%</b> ({acertos} certas, {erros} erradas). Esse resultado é definitivo — a prova não pode ser refeita.
      </div>
      {perguntas.length > 0 && (
        <div className="flex flex-col gap-2">
          {perguntas.map((p, i) => (
            <div key={p.id} className="flex items-center gap-2 text-[12.5px] text-slate-600">
              {p.minhaTentativa?.acertou ? (
                <CheckCircle2 size={14} className="text-emerald-500 shrink-0" />
              ) : (
                <span className="w-3.5 h-3.5 rounded-full bg-red-400 shrink-0" />
              )}
              <span className="truncate">{i + 1}. {p.question}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function Prova({ moduloId, perguntasIniciais, onConcluido }) {
  const [indice, setIndice] = useState(0);
  const [perguntas, setPerguntas] = useState(perguntasIniciais);
  const [opcaoSelecionada, setOpcaoSelecionada] = useState(null);
  const [respondendo, setRespondendo] = useState(false);
  const [feedback, setFeedback] = useState(null); // { correto, finalizada }
  const [resultadoFinal, setResultadoFinal] = useState(null);
  const [concluindo, setConcluindo] = useState(false);

  const perguntaAtual = perguntas[indice];
  const jaFinalizada = perguntaAtual?.minhaTentativa?.finalizada;

  const responder = async () => {
    if (opcaoSelecionada == null) return;
    setRespondendo(true);
    try {
      const { data } = await api.post(`/trilha/perguntas/${perguntaAtual.id}/responder`, { opcaoId: opcaoSelecionada });
      setFeedback(data);
      setPerguntas((prev) => prev.map((p, i) => (i === indice ? { ...p, minhaTentativa: { tentativas: data.tentativas, acertou: data.correto, finalizada: data.finalizada } } : p)));
    } catch (err) {
      alert(err.response?.data?.error || "Não deu pra enviar a resposta.");
    } finally {
      setRespondendo(false);
    }
  };

  const proxima = () => {
    if (indice + 1 < perguntas.length) {
      setIndice((i) => i + 1);
      setOpcaoSelecionada(null);
      setFeedback(null);
    } else {
      concluirTreinamento();
    }
  };

  const tentarDeNovo = () => {
    // Reembaralha as alternativas antes da 2ª tentativa
    setPerguntas((prev) => prev.map((p, i) => (i === indice ? { ...p, opcoes: embaralhar(p.opcoes) } : p)));
    setOpcaoSelecionada(null);
    setFeedback(null);
  };

  const concluirTreinamento = async () => {
    setConcluindo(true);
    try {
      const { data } = await api.post(`/trilha/modulos/${moduloId}/concluir`);
      setResultadoFinal(data);
    } catch (err) {
      alert(err.response?.data?.error || "Não deu pra concluir o treinamento.");
    } finally {
      setConcluindo(false);
    }
  };

  if (resultadoFinal) {
    return (
      <div className="bg-white rounded-xl border p-5 text-center" style={{ borderColor: "#E4E8EE" }}>
        <CheckCircle2 size={32} className="mx-auto text-emerald-500 mb-2" />
        <div className="text-[15px] font-semibold text-slate-800">Treinamento concluído!</div>
        <div className="text-[13px] text-slate-600 mt-1">
          Nota final: <b>{resultadoFinal.nota}%</b> ({resultadoFinal.acertos} certas, {resultadoFinal.erros} erradas)
        </div>
        <button onClick={onConcluido} className="mt-4 rounded-lg py-2 px-5 text-sm font-semibold text-white" style={{ background: "#2563EB" }}>
          Continuar
        </button>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-xl border p-5" style={{ borderColor: "#E4E8EE" }}>
      <div className="flex items-center justify-between mb-4">
        <div className="text-[14px] font-semibold text-slate-800">Prova do treinamento</div>
        <div className="text-[12px] text-slate-400">Pergunta {indice + 1} de {perguntas.length} · vale 25%</div>
      </div>

      <div className="text-[13.5px] font-medium text-slate-800 mb-3">{perguntaAtual.question}</div>
      <div className="flex flex-col gap-2 mb-4">
        {perguntaAtual.opcoes.map((o) => (
          <label
            key={o.id}
            className="flex items-center gap-2 text-[13px] text-slate-700 border rounded-lg px-3 py-2 cursor-pointer"
            style={{
              borderColor: opcaoSelecionada === o.id ? "#2563EB" : "#E2E8F0",
              background: opcaoSelecionada === o.id ? "#EFF4FF" : "white",
              opacity: feedback ? 0.7 : 1,
              pointerEvents: feedback ? "none" : "auto",
            }}
          >
            <input
              type="radio"
              name={`pergunta-${perguntaAtual.id}`}
              checked={opcaoSelecionada === o.id}
              onChange={() => setOpcaoSelecionada(o.id)}
              className="accent-[#2563EB]"
            />
            {o.text}
          </label>
        ))}
      </div>

      {feedback && (
        <div
          className="rounded-lg p-3 mb-4 text-[13px] font-medium"
          style={feedback.correto ? { background: "#F0FDF4", color: "#16A34A" } : { background: "#FEF2F2", color: "#DC2626" }}
        >
          {feedback.correto
            ? "Certa resposta! ✓"
            : feedback.finalizada
              ? "Errou nas duas tentativas — essa pergunta já ficou definida."
              : "Resposta errada. Você ainda tem mais uma tentativa nessa pergunta."}
        </div>
      )}

      {!feedback && (
        <button
          onClick={responder}
          disabled={opcaoSelecionada == null || respondendo}
          className="w-full rounded-lg py-2.5 text-sm font-semibold text-white disabled:opacity-40"
          style={{ background: "#2563EB" }}
        >
          {respondendo ? "Enviando..." : "Responder"}
        </button>
      )}
      {feedback && !feedback.finalizada && (
        <button onClick={tentarDeNovo} className="w-full rounded-lg py-2.5 text-sm font-semibold text-white" style={{ background: "#EA4E1B" }}>
          Tentar de novo
        </button>
      )}
      {feedback && feedback.finalizada && (
        <button onClick={proxima} disabled={concluindo} className="w-full rounded-lg py-2.5 text-sm font-semibold text-white disabled:opacity-40" style={{ background: "#2563EB" }}>
          {concluindo ? "Enviando..." : indice + 1 < perguntas.length ? "Próxima pergunta" : "Concluir treinamento"}
        </button>
      )}
    </div>
  );
}

function AnotacaoModal({ moduloId, onClose }) {
  const [texto, setTexto] = useState("");
  const [carregando, setCarregando] = useState(true);
  const [salvando, setSalvando] = useState(false);

  useEffect(() => {
    api.get(`/trilha/modulos/${moduloId}/anotacao`).then(({ data }) => { setTexto(data.texto); setCarregando(false); });
  }, [moduloId]);

  const salvar = async () => {
    setSalvando(true);
    try {
      await api.put(`/trilha/modulos/${moduloId}/anotacao`, { texto });
      onClose();
    } catch {
      alert("Não deu pra salvar a anotação agora.");
    } finally {
      setSalvando(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50" onClick={onClose}>
      <div className="bg-white rounded-xl w-[420px] p-5" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-slate-800 font-semibold text-base flex items-center gap-2"><StickyNote size={17} /> Anotação</h3>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600"><X size={18} /></button>
        </div>
        <p className="text-[11.5px] text-slate-400 mb-2">Só você vê isso. Fica salvo mesmo depois de concluir o treinamento.</p>
        {carregando ? (
          <p className="text-[13px] text-slate-400">Carregando...</p>
        ) : (
          <textarea
            value={texto}
            onChange={(e) => setTexto(e.target.value)}
            rows={6}
            placeholder="Escreva livremente suas observações sobre esse treinamento..."
            className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-[#2563EB] mb-3"
          />
        )}
        <button onClick={salvar} disabled={salvando || carregando} className="w-full rounded-lg py-2.5 text-sm font-medium text-white disabled:opacity-40" style={{ background: "#2563EB" }}>
          {salvando ? "Salvando..." : "Salvar anotação"}
        </button>
      </div>
    </div>
  );
}
