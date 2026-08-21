import React, { useEffect, useRef, useState } from "react";
import { Send, Paperclip, Image as ImageIcon, Mic, Square, Pin, X, Users } from "lucide-react";
import { api } from "../api";
import { useAuth } from "../context/AuthContext";
import MessageBubble from "./MessageBubble";

export default function ChatWindow({ conversation, messages, setMessagesForConv, onTogglePin }) {
  const { user } = useAuth();
  const isAdm = user.role === "admin";
  const [draft, setDraft] = useState("");
  const [recording, setRecording] = useState(false);
  const [seconds, setSeconds] = useState(0);
  const [playingId, setPlayingId] = useState(null);
  const [loadingHistory, setLoadingHistory] = useState(true);

  const scrollRef = useRef(null);
  const fileInputRef = useRef(null);
  const imageInputRef = useRef(null);
  const audioRefs = useRef({});
  const mediaRecorderRef = useRef(null);
  const chunksRef = useRef([]);
  const timerRef = useRef(null);

  useEffect(() => {
    setLoadingHistory(true);
    api.get(`/conversations/${conversation.id}/messages`).then(({ data }) => {
      setMessagesForConv(conversation.id, data.messages);
      setLoadingHistory(false);
    });
  }, [conversation.id]);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages]);

  const pinned = (messages || []).find((m) => m.pinned);

  const sendText = async () => {
    if (!draft.trim()) return;
    const text = draft.trim();
    setDraft("");
    await api.post(`/conversations/${conversation.id}/messages`, { text });
  };

  const uploadFile = async (file, kind, seconds) => {
    const form = new FormData();
    form.append("file", file);
    form.append("kind", kind);
    if (seconds) form.append("seconds", String(seconds));
    await api.post(`/conversations/${conversation.id}/upload`, form, {
      headers: { "Content-Type": "multipart/form-data" },
    });
  };

  const handlePick = (e, kind) => {
    const file = e.target.files?.[0];
    if (file) uploadFile(file, kind);
    e.target.value = "";
  };

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const recorder = new MediaRecorder(stream);
      chunksRef.current = [];
      recorder.ondataavailable = (e) => chunksRef.current.push(e.data);
      recorder.onstop = () => {
        stream.getTracks().forEach((t) => t.stop());
        const blob = new Blob(chunksRef.current, { type: "audio/webm" });
        const file = new File([blob], `audio-${Date.now()}.webm`, { type: "audio/webm" });
        uploadFile(file, "audio", seconds);
      };
      recorder.start();
      mediaRecorderRef.current = recorder;
      setRecording(true);
      setSeconds(0);
      timerRef.current = setInterval(() => setSeconds((s) => s + 1), 1000);
    } catch (err) {
      alert("Não foi possível acessar o microfone. Verifique as permissões do navegador.");
    }
  };

  const stopRecording = () => {
    clearInterval(timerRef.current);
    mediaRecorderRef.current?.stop();
    setRecording(false);
  };

  return (
    <div className="flex-1 flex flex-col" style={{ background: "#EFF5FF" }}>
      <div className="h-16 flex items-center gap-3 px-4 border-b border-[#D9E6FB] bg-white shrink-0">
        <div className="w-9 h-9 rounded-full flex items-center justify-center text-white text-xs font-semibold" style={{ background: conversation.type === "group" ? "#334155" : conversation.color || "#2F6FED" }}>
          {conversation.type === "group" ? <Users size={15} /> : conversation.title.split(" ").map((p) => p[0]).slice(0, 2).join("").toUpperCase()}
        </div>
        <div className="min-w-0">
          <div className="text-slate-800 text-sm font-semibold truncate">{conversation.title}</div>
          {conversation.type === "group" && <div className="text-[11px] text-slate-500">{conversation.memberCount} membro(s)</div>}
        </div>
      </div>

      {pinned && (
        <div className="flex items-center gap-2 px-4 py-2 bg-[#E4EDFB] border-b border-[#D9E6FB] text-xs">
          <Pin size={13} className="text-[#2F6FED] shrink-0" />
          <span className="text-slate-500 shrink-0 font-medium">Fixado:</span>
          <span className="text-slate-700 truncate flex-1">
            {pinned.type === "text" ? pinned.content : pinned.type === "image" ? "Foto" : pinned.type === "audio" ? "Mensagem de áudio" : pinned.file_name}
          </span>
          {isAdm && (
            <button onClick={() => onTogglePin(pinned, false)} className="text-slate-400 hover:text-slate-600 shrink-0">
              <X size={14} />
            </button>
          )}
        </div>
      )}

      <div ref={scrollRef} className="flex-1 overflow-y-auto px-4 py-4 flex flex-col gap-1.5">
        {!loadingHistory && (messages || []).length === 0 && (
          <div className="m-auto text-slate-400 text-sm">Nenhuma mensagem ainda. Diga oi 👋</div>
        )}
        {(messages || []).map((m) => (
          <MessageBubble
            key={m.id}
            message={m}
            mine={m.sender_id === user.id}
            isGroup={conversation.type === "group"}
            isAdm={isAdm}
            onTogglePin={(msg) => onTogglePin(msg, !msg.pinned)}
            playingId={playingId}
            setPlayingId={setPlayingId}
            audioRefs={audioRefs}
          />
        ))}
      </div>

      <div className="border-t border-[#D9E6FB] bg-white px-3 py-3 shrink-0">
        {recording ? (
          <div className="flex items-center gap-3 bg-[#EFF5FF] rounded-full px-4 py-2.5">
            <span className="w-2 h-2 rounded-full bg-red-500 animate-pulse shrink-0" />
            <span className="text-sm text-slate-600 font-mono flex-1">Gravando áudio — 0:{String(seconds).padStart(2, "0")}</span>
            <button onClick={stopRecording} className="w-8 h-8 rounded-full flex items-center justify-center text-white shrink-0" style={{ background: "#2F6FED" }}>
              <Square size={13} fill="white" />
            </button>
          </div>
        ) : (
          <div className="flex items-center gap-1.5">
            <button onClick={() => imageInputRef.current?.click()} className="w-9 h-9 rounded-full flex items-center justify-center text-slate-500 hover:bg-[#EFF5FF] hover:text-[#2F6FED] shrink-0">
              <ImageIcon size={19} />
            </button>
            <button onClick={() => fileInputRef.current?.click()} className="w-9 h-9 rounded-full flex items-center justify-center text-slate-500 hover:bg-[#EFF5FF] hover:text-[#2F6FED] shrink-0">
              <Paperclip size={19} />
            </button>
            <input ref={imageInputRef} type="file" accept="image/*" className="hidden" onChange={(e) => handlePick(e, "image")} />
            <input ref={fileInputRef} type="file" className="hidden" onChange={(e) => handlePick(e, "file")} />

            <input
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && sendText()}
              placeholder="Escreva uma mensagem"
              className="flex-1 bg-[#F2F6FC] rounded-full px-4 py-2.5 text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-[#2F6FED] placeholder:text-slate-400"
            />

            {draft.trim() ? (
              <button onClick={sendText} className="w-9 h-9 rounded-full flex items-center justify-center text-white shrink-0" style={{ background: "#2F6FED" }}>
                <Send size={16} />
              </button>
            ) : (
              <button onClick={startRecording} className="w-9 h-9 rounded-full flex items-center justify-center text-slate-500 hover:bg-[#EFF5FF] hover:text-[#2F6FED] shrink-0">
                <Mic size={19} />
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
