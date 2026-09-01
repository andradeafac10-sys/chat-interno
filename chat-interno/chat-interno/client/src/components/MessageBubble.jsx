import React, { useRef, useState, useEffect } from "react";
import { File as FileIcon, Download, Pin, PinOff, Play, Pause, Reply, Pencil, Trash2, Forward, Info } from "lucide-react";
import { fileUrl } from "../api";
import { useTheme } from "../context/ThemeContext";

const REACOES = ["👍", "❤️", "😂", "😮", "😢", "🙏", "❌"];

const fmtHora = (ts) => new Date(ts).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });

const fmtSize = (bytes) => {
  if (!bytes) return "";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
};

// mm:ss a partir de segundos (usado no player de áudio, tanto pra duração
// total quanto pro tempo decorrido enquanto toca)
const fmtDur = (totalSeconds) => {
  const s = Math.max(0, Math.floor(totalSeconds || 0));
  const min = Math.floor(s / 60);
  const sec = s % 60;
  return `${min}:${String(sec).padStart(2, "0")}`;
};

const replyPreviewText = (type, content, deleted) => {
  if (deleted) return "Mensagem apagada";
  if (type === "text") return content;
  if (type === "image") return content ? `📷 ${content}` : "📷 Foto";
  if (type === "audio") return "🎤 Áudio";
  return "📎 Arquivo";
};

// Destaca @menções, aplica formatação estilo WhatsApp (*negrito*, _itálico_,
// ~riscado~) e transforma links em clicáveis.
function formatarTexto(texto) {
  if (!texto) return texto;
  const regex = /(@[\wÀ-ÿ]+(?:\s[\wÀ-ÿ]+)?)|\*([^*\n]+)\*|_([^_\n]+)_|~([^~\n]+)~|(https?:\/\/[^\s]+|www\.[^\s]+)/g;
  const partes = [];
  let ultimo = 0;
  let key = 0;
  let m;
  while ((m = regex.exec(texto)) !== null) {
    if (m.index > ultimo) partes.push(texto.slice(ultimo, m.index));
    if (m[1]) {
      partes.push(<span key={key++} className="font-semibold text-[#2563EB]">{m[1]}</span>);
    } else if (m[2] !== undefined) {
      partes.push(<strong key={key++}>{m[2]}</strong>);
    } else if (m[3] !== undefined) {
      partes.push(<em key={key++}>{m[3]}</em>);
    } else if (m[4] !== undefined) {
      partes.push(<s key={key++}>{m[4]}</s>);
    } else if (m[5] !== undefined) {
      let url = m[5];
      let sufixo = "";
      const pontuacaoFinal = url.match(/^(.*?)([.,;:!?)\]]+)$/);
      if (pontuacaoFinal) { url = pontuacaoFinal[1]; sufixo = pontuacaoFinal[2]; }
      const href = url.startsWith("http") ? url : `https://${url}`;
      partes.push(
        <a
          key={key++}
          href={href}
          target="_blank"
          rel="noreferrer"
          onClick={(e) => e.stopPropagation()}
          className="underline text-[#2563EB] break-all"
        >
          {url}
        </a>
      );
      if (sufixo) partes.push(sufixo);
    }
    ultimo = regex.lastIndex;
  }
  if (ultimo < texto.length) partes.push(texto.slice(ultimo));
  return partes;
}

// Baixa o arquivo de verdade (fetch + blob) em vez de deixar o navegador abrir na
// própria aba — o atributo "download" do HTML não funciona entre domínios diferentes
// (o site e os arquivos ficam em endereços diferentes), então PDF abria em vez de baixar.
async function baixarArquivo(url, nomeArquivo) {
  try {
    const resposta = await fetch(url);
    const blob = await resposta.blob();
    const blobUrl = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = blobUrl;
    a.download = nomeArquivo || "arquivo";
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(blobUrl);
  } catch {
    window.open(url, "_blank"); // se der algum erro, ao menos abre numa aba nova
  }
}

/**
 * Um "bloco" de mensagens: uma ou mais mensagens da MESMA pessoa, mandadas dentro
 * do mesmo minuto, seguidas. Estilo WhatsApp: minhas mensagens vão pro lado
 * direito (bolha azul clara), as dos outros ficam à esquerda (bolha branca),
 * com o avatar só aparecendo do lado de quem NÃO sou eu.
 */
export default function MessageBubble({
  messages, mine, isGroup, isAdm, currentUserId,
  onTogglePin, onReply, onEdit, onDelete, onReact, onOpenImage, onJumpToMessage, onForward, onShowInfo,
  playingId, setPlayingId, audioRefs, highlightedId, naoRespondidas,
}) {
  const { colors } = useTheme();
  const primeira = messages[0];

  const initials = primeira.sender_name?.split(" ").map((p) => p[0]).slice(0, 2).join("").toUpperCase();

  return (
    <div className={`group/cluster flex gap-2 px-3 pt-1.5 pb-0 ${mine ? "justify-end" : "justify-start"}`}>
      {!mine && (
        <div
          className="w-7 h-7 rounded-full flex items-center justify-center text-white text-[10px] font-semibold shrink-0 overflow-hidden mt-0.5"
          style={{ background: primeira.sender_color || "#2563EB" }}
        >
          {primeira.sender_avatar_url ? (
            <img src={fileUrl(primeira.sender_avatar_url)} alt={primeira.sender_name} className="w-full h-full object-cover" />
          ) : (
            initials
          )}
        </div>
      )}

      <div className={`min-w-0 flex flex-col ${mine ? "items-end" : "items-start"}`} style={{ maxWidth: "68%" }}>
        {!mine && isGroup && (
          <span className="text-[12px] font-semibold ml-3 mb-0.5" style={{ color: primeira.sender_color || colors.accent }}>
            {primeira.sender_name}
          </span>
        )}

        {messages.map((m) => (
          <MessageLine
            key={m.id}
            m={m}
            mine={mine}
            isAdm={isAdm}
            currentUserId={currentUserId}
            colors={colors}
            highlighted={highlightedId === m.id}
            precisaResposta={naoRespondidas?.has(m.id)}
            onReply={onReply}
            onEdit={onEdit}
            onReact={onReact}
            onTogglePin={onTogglePin}
            onDelete={onDelete}
            onOpenImage={onOpenImage}
            onJumpToMessage={onJumpToMessage}
            onForward={onForward}
            onShowInfo={onShowInfo}
            playingId={playingId}
            setPlayingId={setPlayingId}
            audioRefs={audioRefs}
          />
        ))}
      </div>
    </div>
  );
}

function MessageLine({
  m, mine, isAdm, currentUserId, colors, highlighted, precisaResposta,
  onReply, onEdit, onReact, onTogglePin, onDelete, onOpenImage, onJumpToMessage, onForward, onShowInfo,
  playingId, setPlayingId, audioRefs,
}) {
  const [menuPos, setMenuPos] = useState(null); // { x, y } — onde o menu de botão direito abriu
  // Tempo mostrado no player do áudio: enquanto toca, conta o tempo decorrido
  // (igual WhatsApp); parado, mostra a duração total. Antes esse número nunca
  // se mexia e sempre aparecia 0:00, porque não tinha nada ouvindo o "tocando".
  const [audioElapsed, setAudioElapsed] = useState(0);
  const [audioDuration, setAudioDuration] = useState(m.audio_seconds || 0);
  const tocandoEsseAudio = playingId === m.id;

  useEffect(() => {
    if (!menuPos) return;
    const fechar = () => setMenuPos(null);
    window.addEventListener("click", fechar);
    window.addEventListener("scroll", fechar, true);
    window.addEventListener("contextmenu", fechar);
    return () => {
      window.removeEventListener("click", fechar);
      window.removeEventListener("scroll", fechar, true);
      window.removeEventListener("contextmenu", fechar);
    };
  }, [menuPos]);

  const abrirMenu = (e) => {
    e.preventDefault();
    // Calcula um espaço reservado pro menu (reações + até 4 ações) e ajusta a
    // posição pra nunca deixar ele cortado nas bordas da tela, principalmente
    // embaixo, que era o caso mais comum (mensagens perto do rodapé do chat).
    const LARGURA_MENU = 190;
    const ALTURA_MENU_ESTIMADA = 300;
    const MARGEM = 8;
    let x = e.clientX;
    let y = e.clientY;
    if (x + LARGURA_MENU > window.innerWidth) x = window.innerWidth - LARGURA_MENU - MARGEM;
    if (y + ALTURA_MENU_ESTIMADA > window.innerHeight) y = window.innerHeight - ALTURA_MENU_ESTIMADA - MARGEM;
    if (x < MARGEM) x = MARGEM;
    if (y < MARGEM) y = MARGEM;
    // Fecha o menu de outra linha, se algum estava aberto, e abre o dessa
    setTimeout(() => setMenuPos({ x, y }), 0);
  };

  const reactionCounts = (m.reactions || []).reduce((acc, r) => {
    acc[r.emoji] = (acc[r.emoji] || 0) + 1;
    return acc;
  }, {});
  const myReaction = (m.reactions || []).find((r) => r.userId === currentUserId)?.emoji;

  if (m.deleted) {
    return (
      <div className={`flex ${mine ? "justify-end" : "justify-start"} w-full`}>
        <div className="text-[13px] italic py-1.5 px-3" style={{ color: colors.textSecondary }}>
          Mensagem apagada
        </div>
      </div>
    );
  }

  const bubbleBg = mine ? colors.ownBubbleBg : colors.incomingBubbleBg;
  const bubbleText = mine ? colors.ownBubbleText : colors.incomingBubbleText;

  return (
    <div
      id={`msg-${m.id}`}
      className={`group/line relative w-full flex flex-col mb-1 ${mine ? "items-end" : "items-start"}`}
    >
      {/* A bolha em si: cor diferente se é minha (direita, azul clarinho) ou
          de outra pessoa (esquerda, branca) — igual WhatsApp. Responder é só
          pelo menu (botão direito ou o "⋯"), pra não atrapalhar quando a
          pessoa dá duplo clique numa palavra só pra selecionar e copiar. */}
      <div
        onContextMenu={abrirMenu}
        className="rounded-2xl px-3 py-2 max-w-full cursor-default"
        style={{
          background: bubbleBg,
          boxShadow: highlighted ? `0 0 0 2px ${colors.accent}` : "none",
          borderLeft: precisaResposta ? "3px solid #EF4444" : "3px solid transparent",
        }}
      >
        {m.forwarded && (
          <div className="flex items-center gap-1 text-[11px] italic mb-0.5" style={{ color: colors.textSecondary }}>
            <Forward size={11} /> Encaminhada
          </div>
        )}
        {m.reply_id && (
          <button
            onClick={() => onJumpToMessage?.(m.reply_id)}
            className="block w-full text-left mb-1 pl-2 border-l-2 border-[#2563EB] rounded px-2 py-1 hover:brightness-95"
            style={{ background: colors.inputFieldBg }}
          >
            <div className="text-[11px] font-medium text-[#2563EB]">{m.reply_sender_name}</div>
            <div className="text-[12px] truncate max-w-[380px]" style={{ color: colors.textSecondary }}>
              {replyPreviewText(m.reply_type, m.reply_content, m.reply_deleted)}
            </div>
          </button>
        )}

        {m.type === "text" && (
          <div className="text-[13.5px] leading-relaxed whitespace-pre-wrap break-words" style={{ color: bubbleText }}>
            {formatarTexto(m.content)}
            {m.edited && <span className="text-[10px] italic ml-1.5 align-middle" style={{ color: colors.textSecondary }}>(editado)</span>}
            {m.pinned && <Pin size={11} className="inline align-middle ml-1.5 text-[#2563EB]" />}
          </div>
        )}

        {m.type === "image" && (
          <div>
            <button onClick={() => onOpenImage?.({ url: m.file_url, name: m.file_name })} className="block">
              <img src={fileUrl(m.file_url)} alt={m.file_name} className="rounded-lg max-w-[300px] max-h-[280px] object-cover cursor-zoom-in" />
            </button>
            {m.content && (
              <div className="text-[13.5px] leading-relaxed whitespace-pre-wrap break-words mt-1.5 max-w-[300px]" style={{ color: bubbleText }}>
                {formatarTexto(m.content)}
              </div>
            )}
          </div>
        )}

        {m.type === "file" && (
          <div>
            <button
              onClick={() => baixarArquivo(fileUrl(m.file_url), m.file_name)}
              className="flex items-center gap-2.5 rounded-lg px-3 py-2 max-w-[320px] border text-left"
              style={{ background: colors.inputFieldBg, borderColor: colors.border }}
            >
              <div className="w-9 h-9 rounded-lg flex items-center justify-center shrink-0" style={{ background: colors.panelBg }}>
                <FileIcon size={16} color="#2563EB" />
              </div>
              <div className="min-w-0 flex-1">
                <div className="text-[13px] font-medium truncate" style={{ color: colors.textPrimary }}>{m.file_name}</div>
                <div className="text-[11px]" style={{ color: colors.textSecondary }}>{fmtSize(m.file_size)} · baixar</div>
              </div>
              <Download size={14} className="shrink-0" style={{ color: colors.textSecondary }} />
            </button>
            {/* A legenda escrita antes de mandar o PDF era salva certinho no banco,
                mas nunca aparecia aqui — por isso parecia que não dava pra escrever
                junto. Agora mostra, igual já acontecia com foto. */}
            {m.content && (
              <div className="text-[13.5px] leading-relaxed whitespace-pre-wrap break-words mt-1.5 max-w-[320px]" style={{ color: bubbleText }}>
                {formatarTexto(m.content)}
              </div>
            )}
          </div>
        )}

        {m.type === "audio" && (
          <div className="flex items-center gap-2.5 rounded-full px-3 py-2 max-w-[260px]" style={{ background: colors.inputFieldBg }}>
            <button
              onClick={() => {
                const el = audioRefs.current[m.id];
                if (!el) return;
                if (playingId === m.id) { el.pause(); setPlayingId(null); }
                else { Object.values(audioRefs.current).forEach((a) => a?.pause()); el.currentTime = 0; el.play(); setPlayingId(m.id); }
              }}
              className="w-8 h-8 rounded-full flex items-center justify-center shrink-0"
              style={{ background: colors.panelBg }}
            >
              {playingId === m.id ? <Pause size={14} color="#2563EB" /> : <Play size={14} color="#2563EB" />}
            </button>
            <div className="flex items-center gap-[2px] flex-1 h-5">
              {Array.from({ length: 20 }).map((_, i) => (
                <span key={i} className="w-[2px] rounded-full" style={{ height: `${6 + ((i * 37) % 14)}px`, background: "#8696A0" }} />
              ))}
            </div>
            <span className="text-[11px] font-mono" style={{ color: colors.textSecondary }}>
              {fmtDur(tocandoEsseAudio ? audioElapsed : audioDuration)}
            </span>
            <audio
              ref={(el) => (audioRefs.current[m.id] = el)}
              src={fileUrl(m.file_url)}
              onEnded={() => { setPlayingId(null); setAudioElapsed(0); }}
              onTimeUpdate={(e) => setAudioElapsed(e.target.currentTime)}
              onLoadedMetadata={(e) => {
                // Alguns navegadores retornam Infinity de cara pra .webm gravado
                // ao vivo — nesse caso mantém a duração que veio do servidor
                // (audio_seconds) até o áudio carregar de verdade.
                if (Number.isFinite(e.target.duration)) setAudioDuration(e.target.duration);
              }}
              className="hidden"
            />
          </div>
        )}

        <div className="text-[10px] text-right mt-0.5 flex items-center justify-end gap-1" style={{ color: colors.textSecondary, opacity: 0.8 }}>
          {fmtHora(m.created_at)}
          {/* Só faz sentido mostrar "Enviado"/"Lido" nas MINHAS mensagens — igual
              o tique do WhatsApp, ninguém vê esse status na mensagem dos outros. */}
          {mine && <span>· {m.read ? "Lido" : "Enviado"}</span>}
        </div>
      </div>

      {Object.keys(reactionCounts).length > 0 && (
        <div className="flex gap-1 mt-0.5 flex-wrap">
          {Object.entries(reactionCounts).map(([emoji, count]) => (
            <span
              key={emoji}
              className="text-[12px] rounded-full px-2 py-0.5 border flex items-center gap-1"
              style={{ background: colors.panelBg, borderColor: myReaction === emoji ? "#2563EB" : colors.border, color: colors.textPrimary }}
            >
              <span>{emoji}</span> <span className="text-[10px]">{count}</span>
            </span>
          ))}
        </div>
      )}

      {/* Botão de "mais opções" que só aparece ao passar o mouse — abre o mesmo
          menu completo do botão direito, sem precisar clicar com o direito. */}
      {!m.deleted && (
        <button
          onClick={abrirMenu}
          title="Mais opções"
          className={`absolute top-1 opacity-0 group-hover/line:opacity-100 transition-opacity w-6 h-6 rounded-full flex items-center justify-center ${mine ? "-left-7" : "-right-7"}`}
          style={{ color: colors.textSecondary, background: colors.panelBg, border: `1px solid ${colors.border}` }}
        >
          <Reply size={12} />
        </button>
      )}

      {/* Menu de botão direito (ou do botão "mais opções") — aparece bem em cima
          de onde clicou, com as ações agindo sobre ESSA mensagem específica. */}
      {menuPos && !m.deleted && (
        <div
          className="fixed rounded-lg shadow-2xl border py-1.5 z-50 min-w-[170px]"
          style={{ left: menuPos.x, top: menuPos.y, background: colors.panelBg, borderColor: colors.border }}
          onClick={(e) => e.stopPropagation()}
        >
          <div className="flex items-center gap-1.5 px-3 py-1.5 border-b" style={{ borderColor: colors.border }}>
            {REACOES.map((emoji) => (
              <button
                key={emoji}
                onClick={() => { onReact(m, emoji); setMenuPos(null); }}
                className="text-[17px] hover:scale-125 transition-transform"
              >
                {emoji}
              </button>
            ))}
          </div>
          <button
            onClick={() => { onReply(m); setMenuPos(null); }}
            className="w-full flex items-center gap-2.5 px-3 py-2 text-[13px] hover:bg-black/5 text-left"
            style={{ color: colors.textPrimary }}
          >
            <Reply size={14} /> Responder
          </button>
          <button
            onClick={() => { onForward(m); setMenuPos(null); }}
            className="w-full flex items-center gap-2.5 px-3 py-2 text-[13px] hover:bg-black/5 text-left"
            style={{ color: colors.textPrimary }}
          >
            <Forward size={14} /> Reencaminhar
          </button>
          {mine && (
            <button
              onClick={() => { onShowInfo(m); setMenuPos(null); }}
              className="w-full flex items-center gap-2.5 px-3 py-2 text-[13px] hover:bg-black/5 text-left"
              style={{ color: colors.textPrimary }}
            >
              <Info size={14} /> Dados
            </button>
          )}
          {mine && ["text", "image", "file"].includes(m.type) && (
            <button
              onClick={() => { onEdit(m); setMenuPos(null); }}
              className="w-full flex items-center gap-2.5 px-3 py-2 text-[13px] hover:bg-black/5 text-left"
              style={{ color: colors.textPrimary }}
            >
              <Pencil size={14} /> Editar
            </button>
          )}
          {isAdm && (
            <>
              <button
                onClick={() => { onTogglePin(m); setMenuPos(null); }}
                className="w-full flex items-center gap-2.5 px-3 py-2 text-[13px] hover:bg-black/5 text-left"
                style={{ color: colors.textPrimary }}
              >
                {m.pinned ? <PinOff size={14} /> : <Pin size={14} />} {m.pinned ? "Desafixar" : "Fixar"}
              </button>
              <button
                onClick={() => { onDelete(m); setMenuPos(null); }}
                className="w-full flex items-center gap-2.5 px-3 py-2 text-[13px] hover:bg-black/5 text-left text-red-500"
              >
                <Trash2 size={14} /> Apagar
              </button>
            </>
          )}
        </div>
      )}
    </div>
  );
}
