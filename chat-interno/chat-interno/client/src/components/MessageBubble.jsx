import React, { useRef, useState } from "react";
import { File as FileIcon, Download, Pin, PinOff, Play, Pause, Reply, Pencil, Trash2, SmilePlus } from "lucide-react";
import { fileUrl } from "../api";
import { useTheme } from "../context/ThemeContext";

const REACOES = ["👍", "❤️", "😂", "😮", "😢", "🙏"];

const fmtHora = (ts) => new Date(ts).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });

const fmtSize = (bytes) => {
  if (!bytes) return "";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
};

const replyPreviewText = (type, content, deleted) => {
  if (deleted) return "Mensagem apagada";
  if (type === "text") return content;
  if (type === "image") return content ? `📷 ${content}` : "📷 Foto";
  if (type === "audio") return "🎤 Áudio";
  return "📎 Arquivo";
};

// Destaca menções tipo @Nome dentro do texto
function comMencoes(texto) {
  if (!texto) return texto;
  const partes = String(texto).split(/(@[\wÀ-ÿ]+(?:\s[\wÀ-ÿ]+)?)/g);
  return partes.map((parte, i) =>
    parte.startsWith("@") ? (
      <span key={i} className="font-semibold text-[#2E6FD9]">{parte}</span>
    ) : (
      parte
    )
  );
}

/**
 * Um "bloco" de mensagens: uma ou mais mensagens da MESMA pessoa, mandadas dentro
 * do mesmo minuto, seguidas. O avatar e o nome aparecem uma vez só, no topo; cada
 * mensagem dentro do bloco fica coladinha na próxima, com suas próprias reações
 * e ações (responder/editar/apagar/fixar) reveladas ao passar o mouse por cima dela.
 */
export default function MessageBubble({
  messages, mine, isGroup, isAdm, currentUserId,
  onTogglePin, onReply, onEdit, onDelete, onReact, onOpenImage,
  playingId, setPlayingId, audioRefs, highlightedId,
}) {
  const { colors } = useTheme();
  const primeira = messages[0];

  const initials = primeira.sender_name?.split(" ").map((p) => p[0]).slice(0, 2).join("").toUpperCase();

  return (
    <div className="flex gap-2.5 px-3 pt-2 pb-0.5 rounded-lg">
      <div
        className="w-7 h-7 rounded-full flex items-center justify-center text-white text-[10px] font-semibold shrink-0 overflow-hidden mt-0.5"
        style={{ background: primeira.sender_color || "#2E6FD9" }}
      >
        {primeira.sender_avatar_url ? (
          <img src={fileUrl(primeira.sender_avatar_url)} alt={primeira.sender_name} className="w-full h-full object-cover" />
        ) : (
          initials
        )}
      </div>

      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2 flex-wrap mb-0.5">
          <span className="text-[13.5px] font-semibold" style={{ color: colors.textPrimary }}>
            {primeira.sender_name}
          </span>
          <span className="text-[11px]" style={{ color: colors.textSecondary }}>{fmtHora(primeira.created_at)}</span>
        </div>

        {messages.map((m) => (
          <MessageLine
            key={m.id}
            m={m}
            mine={mine}
            isAdm={isAdm}
            currentUserId={currentUserId}
            colors={colors}
            highlighted={highlightedId === m.id}
            onTogglePin={onTogglePin}
            onReply={onReply}
            onEdit={onEdit}
            onDelete={onDelete}
            onReact={onReact}
            onOpenImage={onOpenImage}
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
  m, mine, isAdm, currentUserId, colors, highlighted,
  onTogglePin, onReply, onEdit, onDelete, onReact, onOpenImage,
  playingId, setPlayingId, audioRefs,
}) {
  const [showReactionPicker, setShowReactionPicker] = useState(false);
  const pickerTimeout = useRef(null);

  const reactionCounts = (m.reactions || []).reduce((acc, r) => {
    acc[r.emoji] = (acc[r.emoji] || 0) + 1;
    return acc;
  }, {});
  const myReaction = (m.reactions || []).find((r) => r.userId === currentUserId)?.emoji;

  const openPicker = () => {
    clearTimeout(pickerTimeout.current);
    setShowReactionPicker(true);
  };
  const closePickerDelayed = () => {
    pickerTimeout.current = setTimeout(() => setShowReactionPicker(false), 350);
  };

  if (m.deleted) {
    return (
      <div id={`msg-${m.id}`} className="text-[13.5px] italic py-0.5 rounded" style={{ color: colors.textSecondary }}>
        Mensagem apagada
      </div>
    );
  }

  return (
    <div
      id={`msg-${m.id}`}
      className="group/line relative flex items-start justify-between gap-3 py-0.5 px-1 -mx-1 rounded transition-colors"
      style={{ background: highlighted ? "rgba(46,111,217,0.2)" : "transparent" }}
    >
      <div className="min-w-0 flex-1">
        {m.reply_id && (
          <div className="mb-1 pl-2 border-l-2 border-[#2E6FD9] rounded px-2 py-1" style={{ background: colors.inputFieldBg }}>
            <div className="text-[11px] font-medium text-[#2E6FD9]">{m.reply_sender_name}</div>
            <div className="text-[12px] truncate max-w-[420px]" style={{ color: colors.textSecondary }}>
              {replyPreviewText(m.reply_type, m.reply_content, m.reply_deleted)}
            </div>
          </div>
        )}

        {m.type === "text" && (
          <div className="text-[13.5px] leading-relaxed whitespace-pre-wrap break-words flex items-center gap-1.5 flex-wrap" style={{ color: colors.textPrimary }}>
            {comMencoes(m.content)}
            {m.edited && <span className="text-[10px] italic shrink-0" style={{ color: colors.textSecondary }}>(editado)</span>}
            {m.pinned && <Pin size={11} className="text-[#2E6FD9] shrink-0" />}
          </div>
        )}

        {m.type === "image" && (
          <div>
            <button onClick={() => onOpenImage?.({ url: m.file_url, name: m.file_name })} className="block">
              <img src={fileUrl(m.file_url)} alt={m.file_name} className="rounded-lg max-w-[320px] max-h-[280px] object-cover cursor-zoom-in" />
            </button>
            {m.content && (
              <div className="text-[13.5px] leading-relaxed whitespace-pre-wrap break-words mt-1.5 max-w-[320px]" style={{ color: colors.textPrimary }}>
                {m.content}
              </div>
            )}
          </div>
        )}

        {m.type === "file" && (
          <a
            href={fileUrl(m.file_url)}
            download={m.file_name}
            className="flex items-center gap-2.5 rounded-lg px-3 py-2 max-w-[340px] border"
            style={{ background: colors.inputFieldBg, borderColor: colors.border }}
          >
            <div className="w-9 h-9 rounded-lg flex items-center justify-center shrink-0" style={{ background: colors.panelBg }}>
              <FileIcon size={16} color="#2E6FD9" />
            </div>
            <div className="min-w-0 flex-1">
              <div className="text-[13px] font-medium truncate" style={{ color: colors.textPrimary }}>{m.file_name}</div>
              <div className="text-[11px]" style={{ color: colors.textSecondary }}>{fmtSize(m.file_size)}</div>
            </div>
            <Download size={14} className="shrink-0" style={{ color: colors.textSecondary }} />
          </a>
        )}

        {m.type === "audio" && (
          <div className="flex items-center gap-2.5 rounded-full px-3 py-2 max-w-[280px]" style={{ background: colors.inputFieldBg }}>
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
              {playingId === m.id ? <Pause size={14} color="#2E6FD9" /> : <Play size={14} color="#2E6FD9" />}
            </button>
            <div className="flex items-center gap-[2px] flex-1 h-5">
              {Array.from({ length: 22 }).map((_, i) => (
                <span key={i} className="w-[2px] rounded-full" style={{ height: `${6 + ((i * 37) % 14)}px`, background: "#8696A0" }} />
              ))}
            </div>
            <span className="text-[11px] font-mono" style={{ color: colors.textSecondary }}>
              0:{String(m.audio_seconds || 0).padStart(2, "0")}
            </span>
            <audio ref={(el) => (audioRefs.current[m.id] = el)} src={fileUrl(m.file_url)} onEnded={() => setPlayingId(null)} className="hidden" />
          </div>
        )}

        {Object.keys(reactionCounts).length > 0 && (
          <div className="flex gap-1 mt-1 flex-wrap">
            {Object.entries(reactionCounts).map(([emoji, count]) => (
              <button
                key={emoji}
                onClick={() => onReact(m, emoji)}
                className="text-[12px] rounded-full px-2 py-0.5 border flex items-center gap-1"
                style={{ background: colors.inputFieldBg, borderColor: myReaction === emoji ? "#2E6FD9" : colors.border, color: colors.textPrimary }}
              >
                <span>{emoji}</span> <span className="text-[10px]">{count}</span>
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Ações — só aparecem ao passar o mouse NESSA mensagem específica, sem mexer no resto do bloco */}
      <div className="opacity-0 group-hover/line:opacity-100 transition-opacity flex items-center gap-2 shrink-0 mt-0.5">
        <div className="relative" onMouseEnter={openPicker} onMouseLeave={closePickerDelayed}>
          <button title="Reagir" className="hover:text-[#2E6FD9]" style={{ color: colors.textSecondary }}>
            <SmilePlus size={14} />
          </button>
          {showReactionPicker && (
            <div
              className="absolute bottom-full right-0 mb-1 flex items-center gap-0.5 rounded-full px-2 py-1.5 shadow-lg border z-20"
              style={{ background: colors.panelBg, borderColor: colors.border }}
            >
              {REACOES.map((emoji) => (
                <button
                  key={emoji}
                  onClick={() => { onReact(m, emoji); setShowReactionPicker(false); }}
                  className="text-[18px] hover:scale-125 transition-transform px-0.5"
                >
                  {emoji}
                </button>
              ))}
            </div>
          )}
        </div>

        <button onClick={() => onReply(m)} title="Responder" className="hover:text-[#2E6FD9]" style={{ color: colors.textSecondary }}>
          <Reply size={13} />
        </button>

        {mine && m.type === "text" && (
          <button onClick={() => onEdit(m)} title="Editar" className="hover:text-[#2E6FD9]" style={{ color: colors.textSecondary }}>
            <Pencil size={13} />
          </button>
        )}
        {isAdm && (
          <>
            <button onClick={() => onDelete(m)} title="Apagar" className="hover:text-red-500" style={{ color: colors.textSecondary }}>
              <Trash2 size={13} />
            </button>
            <button onClick={() => onTogglePin(m)} title={m.pinned ? "Desafixar" : "Fixar"} className="hover:text-[#2E6FD9]" style={{ color: colors.textSecondary }}>
              {m.pinned ? <PinOff size={14} /> : <Pin size={14} />}
            </button>
          </>
        )}
      </div>
    </div>
  );
}
