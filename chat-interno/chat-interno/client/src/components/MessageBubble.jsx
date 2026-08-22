import React from "react";
import { File as FileIcon, Download, Pin, PinOff, Play, Pause, CheckCheck, Reply, Pencil, Trash2, ThumbsUp, X as XIcon } from "lucide-react";
import { fileUrl } from "../api";
import { useTheme } from "../context/ThemeContext";

const fmtTime = (ts) => new Date(ts).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
const fmtSize = (bytes) => {
  if (!bytes) return "";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
};

const replyPreviewText = (type, content, deleted) => {
  if (deleted) return "Mensagem apagada";
  if (type === "text") return content;
  if (type === "image") return "📷 Foto";
  if (type === "audio") return "🎤 Áudio";
  return "📎 Arquivo";
};

export default function MessageBubble({
  message, mine, isGroup, isAdm, currentUserId,
  onTogglePin, onReply, onEdit, onDelete, onReact,
  playingId, setPlayingId, audioRefs,
}) {
  const { colors } = useTheme();
  const m = message;

  if (m.deleted) {
    return (
      <div className={`flex ${mine ? "justify-end" : "justify-start"}`}>
        <div className="max-w-[70%] rounded-2xl px-3.5 py-2 text-sm italic border" style={{ color: colors.textSecondary, background: colors.incomingBubbleBg, borderColor: colors.border }}>
          Mensagem apagada
        </div>
      </div>
    );
  }

  const reactionCounts = (m.reactions || []).reduce((acc, r) => {
    acc[r.emoji] = (acc[r.emoji] || 0) + 1;
    return acc;
  }, {});
  const myReaction = (m.reactions || []).find((r) => r.userId === currentUserId)?.emoji;

  return (
    <div className={`group flex ${mine ? "justify-end" : "justify-start"}`}>
      <div className={`flex items-end gap-2 max-w-[70%] ${mine ? "flex-row-reverse" : ""}`}>
        {!mine && isGroup && (
          <div className="w-6 h-6 rounded-full flex items-center justify-center text-white text-[9px] font-semibold shrink-0 mb-1" style={{ background: m.sender_color }}>
            {m.sender_name?.split(" ").map((p) => p[0]).slice(0, 2).join("").toUpperCase()}
          </div>
        )}
        <div className="relative">
          {!mine && isGroup && (
            <div className="text-[11px] font-medium mb-0.5 ml-1" style={{ color: m.sender_color }}>{m.sender_name?.split(" ")[0]}</div>
          )}
          <div
            className="rounded-2xl px-3.5 py-2 text-sm leading-snug shadow-sm"
            style={{
              background: mine ? colors.ownBubbleBg : colors.incomingBubbleBg,
              color: mine ? colors.ownBubbleText : colors.incomingBubbleText,
              borderTopRightRadius: mine ? 4 : undefined,
              borderTopLeftRadius: !mine ? 4 : undefined,
            }}
          >
            {m.reply_id && (
              <div className="mb-1.5 pl-2 border-l-2 border-[#25D366] bg-black/5 rounded px-2 py-1">
                <div className="text-[11px] font-medium text-[#25D366]">{m.reply_sender_name}</div>
                <div className="text-[12px] text-slate-600 truncate max-w-[220px]">
                  {replyPreviewText(m.reply_type, m.reply_content, m.reply_deleted)}
                </div>
              </div>
            )}

            {m.type === "text" && <div className="whitespace-pre-wrap break-words">{m.content}</div>}

            {m.type === "image" && (
              <a href={fileUrl(m.file_url)} target="_blank" rel="noreferrer">
                <img src={fileUrl(m.file_url)} alt={m.file_name} className="rounded-lg max-w-[220px] max-h-[220px] object-cover" />
              </a>
            )}

            {m.type === "file" && (
              <a href={fileUrl(m.file_url)} download={m.file_name} className="flex items-center gap-2.5 min-w-[180px]">
                <div className="w-9 h-9 rounded-lg flex items-center justify-center shrink-0" style={{ background: mine ? "rgba(0,0,0,0.15)" : colors.inputFieldBg }}>
                  <FileIcon size={16} color="#25D366" />
                </div>
                <div className="min-w-0">
                  <div className="text-[13px] font-medium truncate">{m.file_name}</div>
                  <div className="text-[11px] text-slate-500">{fmtSize(m.file_size)}</div>
                </div>
                <Download size={13} className="ml-1 shrink-0 opacity-70" />
              </a>
            )}

            {m.type === "audio" && (
              <div className="flex items-center gap-2.5 min-w-[170px]">
                <button
                  onClick={() => {
                    const el = audioRefs.current[m.id];
                    if (!el) return;
                    if (playingId === m.id) { el.pause(); setPlayingId(null); }
                    else { Object.values(audioRefs.current).forEach((a) => a?.pause()); el.currentTime = 0; el.play(); setPlayingId(m.id); }
                  }}
                  className="w-8 h-8 rounded-full flex items-center justify-center shrink-0"
                  style={{ background: mine ? "rgba(0,0,0,0.18)" : colors.inputFieldBg }}
                >
                  {playingId === m.id ? <Pause size={14} color="#25D366" /> : <Play size={14} color="#25D366" />}
                </button>
                <div className="flex items-center gap-[2px] flex-1 h-5">
                  {Array.from({ length: 22 }).map((_, i) => (
                    <span key={i} className="w-[2px] rounded-full" style={{ height: `${6 + ((i * 37) % 14)}px`, background: mine ? "#4A9B7F" : "#8696A0" }} />
                  ))}
                </div>
                <span className="text-[11px] font-mono opacity-80">0:{String(m.audio_seconds || 0).padStart(2, "0")}</span>
                <audio
                  ref={(el) => (audioRefs.current[m.id] = el)}
                  src={fileUrl(m.file_url)}
                  onEnded={() => setPlayingId(null)}
                  className="hidden"
                />
              </div>
            )}
          </div>

          {Object.keys(reactionCounts).length > 0 && (
            <div className={`flex gap-1 mt-1 ${mine ? "justify-end" : "justify-start"} px-1`}>
              {Object.entries(reactionCounts).map(([emoji, count]) => (
                <button
                  key={emoji}
                  onClick={() => onReact(m, emoji)}
                  className="text-[11px] rounded-full px-1.5 py-0.5 shadow-sm border"
                  style={{ background: colors.incomingBubbleBg, borderColor: myReaction === emoji ? "#25D366" : colors.border }}
                >
                  {emoji} {count}
                </button>
              ))}
            </div>
          )}

          <div className={`flex items-center gap-1 mt-0.5 ${mine ? "justify-end" : "justify-start"} px-1`}>
            {m.edited && <span className="text-[10px] text-slate-400 italic">editado</span>}
            <span className="text-[10px] text-slate-400 font-mono">{fmtTime(m.created_at)}</span>
            {mine && <CheckCheck size={12} className="text-[#25D366]" />}
          </div>
        </div>

        <div className="opacity-0 group-hover:opacity-100 transition-opacity flex items-center gap-1 shrink-0 mb-1">
          <button onClick={() => onReact(m, "👍")} title="Reagir 👍" className="text-slate-400 hover:text-[#25D366] p-0.5">
            <ThumbsUp size={13} />
          </button>
          <button onClick={() => onReact(m, "❌")} title="Reagir ❌" className="text-slate-400 hover:text-red-500 p-0.5">
            <XIcon size={13} />
          </button>
          <button onClick={() => onReply(m)} title="Responder" className="text-slate-400 hover:text-[#25D366] p-0.5">
            <Reply size={14} />
          </button>
          {mine && m.type === "text" && (
            <button onClick={() => onEdit(m)} title="Editar" className="text-slate-400 hover:text-[#25D366] p-0.5">
              <Pencil size={13} />
            </button>
          )}
          {(mine || isAdm) && (
            <button onClick={() => onDelete(m)} title="Apagar" className="text-slate-400 hover:text-red-500 p-0.5">
              <Trash2 size={13} />
            </button>
          )}
          {isAdm && (
            <button onClick={() => onTogglePin(m)} title={m.pinned ? "Desafixar" : "Fixar mensagem"} className="text-slate-400 hover:text-[#25D366] p-0.5">
              {m.pinned ? <PinOff size={14} /> : <Pin size={14} />}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
