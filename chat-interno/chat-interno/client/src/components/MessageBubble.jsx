import React from "react";
import { File as FileIcon, Download, Pin, PinOff, Play, Pause, CheckCheck } from "lucide-react";
import { fileUrl } from "../api";

const fmtTime = (ts) => new Date(ts).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
const fmtSize = (bytes) => {
  if (!bytes) return "";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
};

export default function MessageBubble({ message, mine, isGroup, isAdm, onTogglePin, playingId, setPlayingId, audioRefs }) {
  const m = message;

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
              background: mine ? "#2F6FED" : "#FFFFFF",
              color: mine ? "#FFFFFF" : "#1E293B",
              borderTopRightRadius: mine ? 4 : undefined,
              borderTopLeftRadius: !mine ? 4 : undefined,
            }}
          >
            {m.type === "text" && <div className="whitespace-pre-wrap break-words">{m.content}</div>}

            {m.type === "image" && (
              <a href={fileUrl(m.file_url)} target="_blank" rel="noreferrer">
                <img src={fileUrl(m.file_url)} alt={m.file_name} className="rounded-lg max-w-[220px] max-h-[220px] object-cover" />
              </a>
            )}

            {m.type === "file" && (
              <a href={fileUrl(m.file_url)} download={m.file_name} className="flex items-center gap-2.5 min-w-[180px]">
                <div className="w-9 h-9 rounded-lg flex items-center justify-center shrink-0" style={{ background: mine ? "rgba(255,255,255,0.15)" : "#EFF5FF" }}>
                  <FileIcon size={16} color={mine ? "#fff" : "#2F6FED"} />
                </div>
                <div className="min-w-0">
                  <div className="text-[13px] font-medium truncate">{m.file_name}</div>
                  <div className={`text-[11px] ${mine ? "text-blue-100" : "text-slate-500"}`}>{fmtSize(m.file_size)}</div>
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
                  style={{ background: mine ? "rgba(255,255,255,0.2)" : "#EFF5FF" }}
                >
                  {playingId === m.id ? <Pause size={14} color={mine ? "#fff" : "#2F6FED"} /> : <Play size={14} color={mine ? "#fff" : "#2F6FED"} />}
                </button>
                <div className="flex items-center gap-[2px] flex-1 h-5">
                  {Array.from({ length: 22 }).map((_, i) => (
                    <span key={i} className="w-[2px] rounded-full" style={{ height: `${6 + ((i * 37) % 14)}px`, background: mine ? "rgba(255,255,255,0.6)" : "#93B4F0" }} />
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
          <div className={`flex items-center gap-1 mt-0.5 ${mine ? "justify-end" : "justify-start"} px-1`}>
            <span className="text-[10px] text-slate-400 font-mono">{fmtTime(m.created_at)}</span>
            {mine && <CheckCheck size={12} className="text-[#2F6FED]" />}
          </div>
        </div>

        {isAdm && (
          <button
            onClick={() => onTogglePin(m)}
            title={m.pinned ? "Desafixar" : "Fixar mensagem"}
            className="opacity-0 group-hover:opacity-100 transition-opacity text-slate-400 hover:text-[#2F6FED] shrink-0 mb-1"
          >
            {m.pinned ? <PinOff size={14} /> : <Pin size={14} />}
          </button>
        )}
      </div>
    </div>
  );
}
