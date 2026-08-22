import React, { useEffect, useRef, useState } from "react";
import { Send, Paperclip, Image as ImageIcon, Mic, Square, Pin, X, Users, Settings, Reply, Pencil } from "lucide-react";
import { api, fileUrl } from "../api";
import { useAuth } from "../context/AuthContext";
import MessageBubble from "./MessageBubble";
import GroupSettingsModal from "./GroupSettingsModal";

const replyPreviewText = (type, content, deleted) => {
  if (deleted) return "Mensagem apagada";
  if (type === "text") return content;
  if (type === "image") return "📷 Foto";
  if (type === "audio") return "🎤 Áudio";
  return "📎 Arquivo";
};

export default function ChatWindow({ conversation, messages, setMessagesForConv, onTogglePin, onGroupUpdated, isOnline }) {
  const { user } = useAuth();
  const isAdm = user.role === "admin";
  const [draft, setDraft] = useState("");
  const [recording, setRecording] = useState(false);
  const [seconds, setSeconds] = useState(0);
  const [playingId, setPlayingId] = useState(null);
  const [loadingHistory, setLoadingHistory] = useState(true);
  const [showGroupSettings, setShowGroupSettings] = useState(false);
  const [replyingTo, setReplyingTo] = useState(null);
  const [editingMessage, setEditingMessage] = useState(null);

  const scrollRef = useRef(null);
  const fileInputRef = useRef(null);
  const imageInputRef = useRef(null);
  const audioRefs = useRef({});
  const mediaRecorderRef = useRef(null);
  const chunksRef = useRef([]);
  const timerRef = useRef(null);
  const inputRef = useRef(null);

  useEffect(() => {
    setLoadingHistory(true);
    setReplyingTo(null);
    setEditingMessage(null);
    setDraft("");
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

    if (editingMessage) {
      setDraft("");
      setEditingMessage(null);
      await api.patch(`/conversations/${conversation.id}/messages/${editingMessage.id}`, { text });
      return;
    }

    setDraft("");
    const replyToId = replyingTo?.id || null;
    setReplyingTo(null);
    await api.post(`/conversations/${conversation.id}/messages`, { text, replyToId });
  };

  const uploadFile = async (file, kind, secondsArg) => {
    const form = new FormData();
    form.append("file", file);
    form.append("kind", kind);
    if (secondsArg) form.append("seconds", String(secondsArg));
    if (replyingTo?.id) form.append("replyToId", String(replyingTo.id));
    setReplyingTo(null);
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

  const startReply = (msg) => {
    setEditingMessage(null);
    setReplyingTo(msg);
    inputRef.current?.focus();
  };

  const startEdit = (msg) => {
    setReplyingTo(null);
    setEditingMessage(msg);
    setDraft(msg.content || "");
    inputRef.current?.focus();
  };

  const cancelComposeExtra = () => {
    setReplyingTo(null);
    setEditingMessage(null);
    setDraft("");
  };

  const deleteMessage = async (msg) => {
    if (!window.confirm("Apagar essa mensagem?")) return;
    await api.delete(`/conversations/${conversation.id}/messages/${msg.id}`);
  };

  const reactToMessage = async (msg, emoji) => {
    await api.post(`/conversations/${conversation.id}/messages/${msg.id}/reactions`, { emoji });
  };

  return (
    <div className="flex-1 flex flex-col" style={{ background: "#EFEAE2" }}>
      <button
        onClick={() => conversation.type === "group" && setShowGroupSettings(true)}
        className="h-16 flex items-center gap-3 px-4 border-b border-[#D1D7DB] bg-white shrink-0 text-left"
        style={{ cursor: conversation.type === "group" ? "pointer" : "default" }}
      >
        <div className="w-9 h-9 rounded-full flex items-center justify-center text-white text-xs font-semibold overflow-hidden relative" style={{ background: conversation.type === "group" ? "#334155" : conversation.color || "#25D366" }}>
          {conversation.type === "group" ? (
            conversation.avatarUrl ? <img src={fileUrl(conversation.avatarUrl)} alt={conversation.title} className="w-full h-full object-cover" /> : <Users size={15} />
          ) : (
            conversation.title.split(" ").map((p) => p[0]).slice(0, 2).join("").toUpperCase()
          )}
          {conversation.type === "dm" && isOnline && (
            <span className="absolute bottom-0 right-0 w-2.5 h-2.5 rounded-full bg-[#25D366] border-2 border-white" />
          )}
        </div>
        <div className="min-w-0 flex-1">
          <div className="text-slate-800 text-sm font-semibold truncate">{conversation.title}</div>
          {conversation.type === "group" ? (
            <div className="text-[11px] text-slate-500">{conversation.memberCount} membro(s)</div>
          ) : (
            <div className="text-[11px] text-slate-500">{isOnline ? "online" : ""}</div>
          )}
        </div>
        {conversation.type === "group" && (
          <span className="text-slate-400 p-1.5" title="Ver informações do grupo">
            <Settings size={18} />
          </span>
        )}
      </button>

      {showGroupSettings && (
        <GroupSettingsModal
          groupId={conversation.groupId}
          isAdm={isAdm}
          onClose={() => setShowGroupSettings(false)}
          onUpdated={() => {
            setShowGroupSettings(false);
            onGroupUpdated?.();
          }}
        />
      )}

      {pinned && (
        <div className="flex items-center gap-2 px-4 py-2 bg-[#F0F2F5] border-b border-[#D1D7DB] text-xs">
          <Pin size={13} className="text-[#25D366] shrink-0" />
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
            currentUserId={user.id}
            onTogglePin={(msg) => onTogglePin(msg, !msg.pinned)}
            onReply={startReply}
            onEdit={startEdit}
            onDelete={deleteMessage}
            onReact={reactToMessage}
            playingId={playingId}
            setPlayingId={setPlayingId}
            audioRefs={audioRefs}
          />
        ))}
      </div>

      <div className="border-t border-[#D1D7DB] bg-white px-3 py-3 shrink-0">
        {(replyingTo || editingMessage) && (
          <div className="flex items-center gap-2 mb-2 bg-[#F0F2F5] rounded-lg px-3 py-2">
            {editingMessage ? <Pencil size={14} className="text-[#25D366] shrink-0" /> : <Reply size={14} className="text-[#25D366] shrink-0" />}
            <div className="min-w-0 flex-1">
              <div className="text-[11px] font-medium text-[#25D366]">{editingMessage ? "Editando mensagem" : `Respondendo ${replyingTo.sender_name?.split(" ")[0]}`}</div>
              <div className="text-[12px] text-slate-500 truncate">
                {editingMessage ? editingMessage.content : replyPreviewText(replyingTo.type, replyingTo.content, replyingTo.deleted)}
              </div>
            </div>
            <button onClick={cancelComposeExtra} className="text-slate-400 hover:text-slate-600 shrink-0">
              <X size={16} />
            </button>
          </div>
        )}

        {recording ? (
          <div className="flex items-center gap-3 bg-[#EFEAE2] rounded-full px-4 py-2.5">
            <span className="w-2 h-2 rounded-full bg-red-500 animate-pulse shrink-0" />
            <span className="text-sm text-slate-600 font-mono flex-1">Gravando áudio — 0:{String(seconds).padStart(2, "0")}</span>
            <button onClick={stopRecording} className="w-8 h-8 rounded-full flex items-center justify-center text-white shrink-0" style={{ background: "#25D366" }}>
              <Square size={13} fill="white" />
            </button>
          </div>
        ) : (
          <div className="flex items-center gap-1.5">
            <button onClick={() => imageInputRef.current?.click()} className="w-9 h-9 rounded-full flex items-center justify-center text-slate-500 hover:bg-[#EFEAE2] hover:text-[#25D366] shrink-0">
              <ImageIcon size={19} />
            </button>
            <button onClick={() => fileInputRef.current?.click()} className="w-9 h-9 rounded-full flex items-center justify-center text-slate-500 hover:bg-[#EFEAE2] hover:text-[#25D366] shrink-0">
              <Paperclip size={19} />
            </button>
            <input ref={imageInputRef} type="file" accept="image/*" className="hidden" onChange={(e) => handlePick(e, "image")} />
            <input ref={fileInputRef} type="file" className="hidden" onChange={(e) => handlePick(e, "file")} />

            <input
              ref={inputRef}
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && sendText()}
              onPaste={(e) => {
                const item = Array.from(e.clipboardData?.items || []).find((it) => it.type.startsWith("image/"));
                if (item) {
                  e.preventDefault();
                  const file = item.getAsFile();
                  if (file) uploadFile(file, "image");
                }
              }}
              placeholder="Escreva uma mensagem"
              className="flex-1 bg-[#F0F2F5] rounded-full px-4 py-2.5 text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-[#25D366] placeholder:text-slate-400"
            />

            {draft.trim() ? (
              <button onClick={sendText} className="w-9 h-9 rounded-full flex items-center justify-center text-white shrink-0" style={{ background: "#25D366" }}>
                <Send size={16} />
              </button>
            ) : (
              <button onClick={startRecording} className="w-9 h-9 rounded-full flex items-center justify-center text-slate-500 hover:bg-[#EFEAE2] hover:text-[#25D366] shrink-0">
                <Mic size={19} />
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
