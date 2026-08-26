import React, { useEffect, useRef, useState } from "react";
import { Send, Paperclip, Image as ImageIcon, Mic, Square, Pin, X, Users, Settings, Reply, Pencil, Search } from "lucide-react";
import { api, fileUrl } from "../api";
import { useAuth } from "../context/AuthContext";
import { useTheme } from "../context/ThemeContext";
import MessageBubble from "./MessageBubble";
import GroupSettingsModal from "./GroupSettingsModal";
import ImageViewer from "./ImageViewer";

// Deixa em destaque o trecho que bate com o que foi buscado
function realcar(texto, termo) {
  if (!texto || !termo || termo.trim().length < 2) return texto;
  const t = termo.trim();
  const escapado = t.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const partes = String(texto).split(new RegExp(`(${escapado})`, "gi"));
  return partes.map((parte, i) =>
    parte.toLowerCase() === t.toLowerCase()
      ? <mark key={i} style={{ background: "#2E6FD9", color: "#0B1410", borderRadius: 3, padding: "0 2px" }}>{parte}</mark>
      : parte
  );
}

const replyPreviewText = (type, content, deleted) => {
  if (deleted) return "Mensagem apagada";
  if (type === "text") return content;
  if (type === "image") return content ? `📷 ${content}` : "📷 Foto";
  if (type === "audio") return "🎤 Áudio";
  return "📎 Arquivo";
};

// Junta em "blocos" as mensagens seguidas da mesma pessoa, dentro do mesmo minuto —
// igual o Discord faz. Uma resposta (reply) sempre começa um bloco novo, pra não
// confundir quem está lendo sobre a qual mensagem ela se refere.
function agruparEmBlocos(messages) {
  const blocos = [];
  for (const m of messages || []) {
    const ultimoBloco = blocos[blocos.length - 1];
    const ultimaMsg = ultimoBloco?.[ultimoBloco.length - 1];
    const mesmaPessoa = ultimaMsg && !ultimaMsg.deleted && !m.deleted && ultimaMsg.sender_id === m.sender_id;
    const mesmoMinuto = ultimaMsg && Math.abs(new Date(m.created_at) - new Date(ultimaMsg.created_at)) < 60000;
    if (ultimoBloco && mesmaPessoa && mesmoMinuto && !m.reply_id) {
      ultimoBloco.push(m);
    } else {
      blocos.push([m]);
    }
  }
  return blocos;
}

// Marca quais mensagens (dos outros) ainda estão "sem resposta": chegaram depois
// da última vez que EU mandei algo nessa conversa. Assim que eu responder, todas
// elas voltam ao normal — não é sobre ter "visto", é sobre ter respondido.
function calcularNaoRespondidas(messages, meuId) {
  let ultimoIndiceMeu = -1;
  (messages || []).forEach((m, i) => {
    if (m.sender_id === meuId && !m.deleted) ultimoIndiceMeu = i;
  });
  const set = new Set();
  (messages || []).forEach((m, i) => {
    if (i > ultimoIndiceMeu && m.sender_id !== meuId && !m.deleted) set.add(m.id);
  });
  return set;
}

export default function ChatWindow({ conversation, messages, setMessagesForConv, onTogglePin, onGroupUpdated, isOnline }) {
  const { user } = useAuth();
  const { colors } = useTheme();
  const isAdm = user.role === "admin";
  const naoRespondidas = calcularNaoRespondidas(messages, user.id);
  const [draft, setDraft] = useState("");
  const [recording, setRecording] = useState(false);
  const [seconds, setSeconds] = useState(0);
  const [playingId, setPlayingId] = useState(null);
  const [loadingHistory, setLoadingHistory] = useState(true);
  const [loadingOlder, setLoadingOlder] = useState(false);
  const [hasMoreOlder, setHasMoreOlder] = useState(true);
  const [showGroupSettings, setShowGroupSettings] = useState(false);
  const [viewingImage, setViewingImage] = useState(null);
  const [pendingImage, setPendingImage] = useState(null); // { file, previewUrl } — foto escolhida, aguardando legenda antes de enviar
  const [replyingTo, setReplyingTo] = useState(null);
  const [editingMessage, setEditingMessage] = useState(null);
  const [showSearch, setShowSearch] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [showPinnedPanel, setShowPinnedPanel] = useState(false);
  const [pinnedList, setPinnedList] = useState([]);
  const [groupMembers, setGroupMembers] = useState([]);
  const [showMentions, setShowMentions] = useState(false);
  const [mentionQuery, setMentionQuery] = useState("");
  const [mentionIndex, setMentionIndex] = useState(0);
  const [searchResults, setSearchResults] = useState([]);
  const [searching, setSearching] = useState(false);
  const [highlightedId, setHighlightedId] = useState(null);

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
    setHasMoreOlder(true);
    setReplyingTo(null);
    setEditingMessage(null);
    setDraft("");
    api.get(`/conversations/${conversation.id}/messages`).then(({ data }) => {
      setMessagesForConv(conversation.id, data.messages);
      setHasMoreOlder(data.messages.length >= 50);
      setLoadingHistory(false);
    });
    // Já deixa o campo de digitar pronto pra escrever, sem precisar clicar nele
    setTimeout(() => inputRef.current?.focus(), 0);
  }, [conversation.id]);

  // Busca a lista de membros do grupo, pra poder sugerir @menções
  useEffect(() => {
    if (conversation.type !== "group" || !conversation.groupId) {
      setGroupMembers([]);
      return;
    }
    api.get(`/groups/${conversation.groupId}/members`)
      .then(({ data }) => setGroupMembers(data.members))
      .catch(() => setGroupMembers([]));
  }, [conversation.type, conversation.groupId]);

  // Só rola a tela pra baixo quando chega mensagem NOVA de verdade (mais mensagens
  // na lista, ou a última mudou de id) — reagir, editar, fixar etc. não deve mexer
  // na posição da tela, senão a pessoa perde o lugar que estava lendo.
  const ultimaMensagemRef = useRef(null);
  useEffect(() => {
    const ultima = messages?.[messages.length - 1];
    const ultimaAntes = ultimaMensagemRef.current;
    const chegouMensagemNova = ultima && (!ultimaAntes || ultima.id !== ultimaAntes.id);
    ultimaMensagemRef.current = ultima || null;
    if (chegouMensagemNova) {
      scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
    }
  }, [messages]);

  const mentionCandidates = groupMembers
    .filter((m) => m.name.toLowerCase().includes(mentionQuery.toLowerCase()))
    .slice(0, 6);

  // Detecta se a pessoa está digitando um @nome, pra abrir a sugestão
  const handleDraftChange = (e) => {
    const value = e.target.value;
    setDraft(value);

    const cursor = e.target.selectionStart;
    const antesDoCursor = value.slice(0, cursor);
    const match = antesDoCursor.match(/@([\wÀ-ÿ]*)$/);

    if (match && conversation.type === "group") {
      setMentionQuery(match[1]);
      setMentionIndex(0);
      setShowMentions(true);
    } else {
      setShowMentions(false);
    }
  };

  const pickMention = (membro) => {
    const cursor = inputRef.current?.selectionStart ?? draft.length;
    const antes = draft.slice(0, cursor).replace(/@([\wÀ-ÿ]*)$/, `@${membro.name} `);
    const depois = draft.slice(cursor);
    setDraft(antes + depois);
    setShowMentions(false);
    setTimeout(() => inputRef.current?.focus(), 0);
  };

  const handleInputKeyDown = (e) => {
    if (showMentions && mentionCandidates.length > 0) {
      if (e.key === "ArrowDown") { e.preventDefault(); setMentionIndex((i) => (i + 1) % mentionCandidates.length); return; }
      if (e.key === "ArrowUp") { e.preventDefault(); setMentionIndex((i) => (i - 1 + mentionCandidates.length) % mentionCandidates.length); return; }
      if (e.key === "Enter" || e.key === "Tab") { e.preventDefault(); pickMention(mentionCandidates[mentionIndex]); return; }
      if (e.key === "Escape") { setShowMentions(false); return; }
    }
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendText();
    }
  };

  const resetInputHeight = () => {
    if (inputRef.current) inputRef.current.style.height = "auto";
  };

  const sendText = async () => {
    if (pendingImage) {
      const legenda = draft.trim();
      const { file, previewUrl } = pendingImage;
      setPendingImage(null);
      setDraft("");
      resetInputHeight();
      URL.revokeObjectURL(previewUrl);
      await uploadFile(file, "image", undefined, legenda || undefined);
      return;
    }

    if (!draft.trim()) return;
    const text = draft.trim();

    if (editingMessage) {
      setDraft("");
      resetInputHeight();
      setEditingMessage(null);
      await api.patch(`/conversations/${conversation.id}/messages/${editingMessage.id}`, { text });
      return;
    }

    setDraft("");
    resetInputHeight();
    const replyToId = replyingTo?.id || null;
    setReplyingTo(null);
    await api.post(`/conversations/${conversation.id}/messages`, { text, replyToId });
  };

  const uploadFile = async (file, kind, secondsArg, caption) => {
    const form = new FormData();
    form.append("file", file);
    form.append("kind", kind);
    if (secondsArg) form.append("seconds", String(secondsArg));
    if (caption) form.append("caption", caption);
    if (replyingTo?.id) form.append("replyToId", String(replyingTo.id));
    setReplyingTo(null);
    await api.post(`/conversations/${conversation.id}/upload`, form, {
      headers: { "Content-Type": "multipart/form-data" },
    });
  };

  const cancelarImagemPendente = () => {
    if (pendingImage?.previewUrl) URL.revokeObjectURL(pendingImage.previewUrl);
    setPendingImage(null);
    setDraft("");
    resetInputHeight();
  };

  const handlePick = (e, kind) => {
    const file = e.target.files?.[0];
    if (!file) { e.target.value = ""; return; }

    if (kind === "image") {
      setPendingImage({ file, previewUrl: URL.createObjectURL(file) });
      setTimeout(() => inputRef.current?.focus(), 0);
    } else {
      uploadFile(file, kind);
    }
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

  const runSearch = async (q) => {
    setSearchQuery(q);
    if (q.trim().length < 2) {
      setSearchResults([]);
      return;
    }
    setSearching(true);
    try {
      const { data } = await api.get(`/conversations/${conversation.id}/search`, { params: { q: q.trim() } });
      setSearchResults(data.messages);
    } finally {
      setSearching(false);
    }
  };

  // Carrega mensagens mais antigas quando a pessoa rola até perto do topo da conversa
  const carregarMaisAntigas = async () => {
    if (loadingOlder || !hasMoreOlder || !messages?.length) return;
    setLoadingOlder(true);
    const container = scrollRef.current;
    const alturaAntes = container?.scrollHeight || 0;
    try {
      const maisAntiga = messages[0];
      const { data } = await api.get(`/conversations/${conversation.id}/messages`, {
        params: { before: maisAntiga.created_at },
      });
      if (data.messages.length === 0) {
        setHasMoreOlder(false);
      } else {
        setMessagesForConv(conversation.id, [...data.messages, ...messages]);
        setHasMoreOlder(data.messages.length >= 50);
        // Mantém a pessoa olhando pro mesmo lugar de antes, sem "pular" a tela
        requestAnimationFrame(() => {
          if (container) container.scrollTop = container.scrollHeight - alturaAntes;
        });
      }
    } finally {
      setLoadingOlder(false);
    }
  };

  const handleScroll = () => {
    if (scrollRef.current && scrollRef.current.scrollTop < 150) {
      carregarMaisAntigas();
    }
  };

  const destacar = (msgId) => {
    const el = document.getElementById(`msg-${msgId}`);
    if (!el) return false;
    el.scrollIntoView({ behavior: "smooth", block: "center" });
    setHighlightedId(msgId);
    setTimeout(() => setHighlightedId(null), 4000);
    return true;
  };

  const openPinnedPanel = async () => {
    setShowSearch(false);
    setShowPinnedPanel((v) => !v);
    try {
      const { data } = await api.get(`/conversations/${conversation.id}/pinned`);
      setPinnedList(data.pinned);
    } catch (err) {
      setPinnedList([]);
    }
  };

  const unpinFromPanel = async (msgId) => {
    await api.patch(`/conversations/${conversation.id}/messages/${msgId}/pin`, { pinned: false });
    setPinnedList((prev) => prev.filter((p) => p.id !== msgId));
  };

  const jumpToMessage = async (msgId) => {
    setShowSearch(false);
    setSearchQuery("");
    setSearchResults([]);

    // Se a mensagem já está na tela, só rola até ela
    if (destacar(msgId)) return;

    // Senão, carrega a conversa a partir daquela mensagem e depois rola
    try {
      const { data } = await api.get(`/conversations/${conversation.id}/messages`, {
        params: { aroundId: msgId },
      });
      setMessagesForConv(conversation.id, data.messages);
      // espera o React desenhar as mensagens antes de tentar rolar
      setTimeout(() => destacar(msgId), 350);
    } catch (err) {
      alert("Não foi possível abrir essa mensagem.");
    }
  };

  return (
    <div className="flex-1 flex flex-col relative" style={{ background: colors.chatBg }}>
      <button
        onClick={() => conversation.type === "group" && setShowGroupSettings(true)}
        className="h-16 flex items-center gap-3 px-4 border-b shrink-0 text-left"
        style={{ cursor: conversation.type === "group" ? "pointer" : "default", background: colors.headerBg, borderColor: colors.headerBorder }}
      >
        <div className="w-9 h-9 rounded-full flex items-center justify-center text-white text-xs font-semibold overflow-hidden relative" style={{ background: conversation.type === "group" ? "#334155" : conversation.color || "#2E6FD9" }}>
          {conversation.avatarUrl ? (
            <img src={fileUrl(conversation.avatarUrl)} alt={conversation.title} className="w-full h-full object-cover" />
          ) : conversation.type === "group" ? (
            <Users size={15} />
          ) : (
            conversation.title.split(" ").map((p) => p[0]).slice(0, 2).join("").toUpperCase()
          )}
          {conversation.type === "dm" && isOnline && (
            <span className="absolute bottom-0 right-0 w-2.5 h-2.5 rounded-full bg-[#2E6FD9]" style={{ border: `2px solid ${colors.headerBg}` }} />
          )}
        </div>
        <div className="min-w-0 flex-1">
          <div className="text-sm font-semibold truncate" style={{ color: colors.textPrimary }}>{conversation.title}</div>
          {conversation.type === "group" ? (
            <div className="text-[11px]" style={{ color: colors.textSecondary }}>{conversation.memberCount} membro(s)</div>
          ) : (
            <div className="text-[11px]" style={{ color: colors.textSecondary }}>{isOnline ? "online" : ""}</div>
          )}
        </div>
        <span
          onClick={(e) => { e.stopPropagation(); setShowSearch((v) => !v); setShowPinnedPanel(false); }}
          className="p-1.5 hover:text-[#2E6FD9] cursor-pointer"
          style={{ color: showSearch ? "#2E6FD9" : colors.textSecondary }}
          title="Buscar nesta conversa"
        >
          <Search size={18} />
        </span>
        <span
          onClick={(e) => { e.stopPropagation(); openPinnedPanel(); }}
          className="p-1.5 hover:text-[#2E6FD9] cursor-pointer relative"
          style={{ color: showPinnedPanel ? "#2E6FD9" : colors.textSecondary }}
          title="Mensagens fixadas"
        >
          <Pin size={18} />
        </span>
        {conversation.type === "group" && (
          <span className="p-1.5" style={{ color: colors.textSecondary }} title="Ver informações do grupo">
            <Settings size={18} />
          </span>
        )}
      </button>

      {showSearch && (
        <div className="border-b px-4 py-3" style={{ background: colors.headerBg, borderColor: colors.headerBorder }}>
          <div className="relative">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2" style={{ color: colors.textSecondary }} />
            <input
              autoFocus
              value={searchQuery}
              onChange={(e) => runSearch(e.target.value)}
              placeholder="Buscar mensagens nesta conversa..."
              className="w-full rounded-lg pl-9 pr-9 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#2E6FD9]"
              style={{ background: colors.inputFieldBg, color: colors.textPrimary }}
            />
            <button
              onClick={() => { setShowSearch(false); setSearchQuery(""); setSearchResults([]); }}
              className="absolute right-3 top-1/2 -translate-y-1/2"
              style={{ color: colors.textSecondary }}
            >
              <X size={15} />
            </button>
          </div>

          {searchQuery.trim().length >= 2 && (
            <div className="mt-2 max-h-56 overflow-y-auto flex flex-col gap-1">
              {searching && <div className="text-xs py-2" style={{ color: colors.textSecondary }}>Buscando...</div>}
              {!searching && searchResults.length === 0 && (
                <div className="text-xs py-2" style={{ color: colors.textSecondary }}>Nenhuma mensagem encontrada.</div>
              )}
              {searchResults.map((r) => (
                <button
                  key={r.id}
                  onClick={() => jumpToMessage(r.id)}
                  className="text-left rounded-lg px-3 py-2"
                  style={{ background: colors.inputFieldBg }}
                >
                  <div className="flex items-baseline gap-2">
                    <span className="text-[12px] font-semibold" style={{ color: r.sender_color }}>{r.sender_name}</span>
                    <span className="text-[10px] font-mono" style={{ color: colors.textSecondary }}>
                      {new Date(r.created_at).toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" })}
                    </span>
                  </div>
                  <div className="text-[13px] truncate" style={{ color: colors.textPrimary }}>
                    {r.type === "text" ? realcar(r.content, searchQuery) : <>📎 {realcar(r.file_name, searchQuery)}</>}
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>
      )}

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

      {showPinnedPanel && (
        <>
          <div className="fixed inset-0 z-30" onClick={() => setShowPinnedPanel(false)} />
          <div
            className="absolute top-16 right-4 w-[380px] max-h-[70vh] rounded-xl shadow-2xl border z-40 flex flex-col overflow-hidden"
            style={{ background: colors.panelBg, borderColor: colors.headerBorder }}
          >
            <div className="flex items-center justify-between px-4 py-3 border-b" style={{ borderColor: colors.headerBorder }}>
              <span className="text-[14px] font-semibold flex items-center gap-1.5" style={{ color: colors.textPrimary }}>
                <Pin size={15} className="text-[#2E6FD9]" /> Mensagens fixadas
              </span>
              <button onClick={() => setShowPinnedPanel(false)} style={{ color: colors.textSecondary }}>
                <X size={16} />
              </button>
            </div>

            <div className="overflow-y-auto flex-1 px-3 py-3 flex flex-col gap-2.5">
              {pinnedList.length === 0 && (
                <div className="text-sm py-6 text-center" style={{ color: colors.textSecondary }}>
                  Nenhuma mensagem fixada ainda.
                </div>
              )}
              {pinnedList.map((p) => (
                <div
                  key={p.id}
                  className="rounded-lg border overflow-hidden"
                  style={{ background: colors.inputFieldBg, borderColor: colors.border }}
                >
                  <div className="flex items-start gap-2.5 p-3">
                    <div
                      className="w-8 h-8 rounded-full flex items-center justify-center text-white text-[10px] font-semibold shrink-0 overflow-hidden mt-0.5"
                      style={{ background: p.sender_color || "#2E6FD9" }}
                    >
                      {p.sender_avatar_url ? (
                        <img src={fileUrl(p.sender_avatar_url)} alt={p.sender_name} className="w-full h-full object-cover" />
                      ) : (
                        p.sender_name?.split(" ").map((x) => x[0]).slice(0, 2).join("").toUpperCase()
                      )}
                    </div>

                    <button onClick={() => jumpToMessage(p.id)} className="text-left flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-[13px] font-semibold" style={{ color: "#2E6FD9" }}>{p.sender_name}</span>
                        <span className="text-[11px]" style={{ color: colors.textSecondary }}>
                          {new Date(p.created_at).toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" })}
                        </span>
                      </div>
                      <div className="text-[13px] mt-0.5 whitespace-pre-wrap break-words" style={{ color: colors.textPrimary }}>
                        {p.type === "text" ? p.content
                          : p.type === "image" ? "📷 Foto"
                          : p.type === "audio" ? "🎤 Áudio"
                          : `📎 ${p.file_name}`}
                      </div>
                      {p.type === "image" && p.file_url && (
                        <img src={fileUrl(p.file_url)} alt="" className="mt-2 rounded-lg max-h-40 object-cover" />
                      )}
                    </button>

                    {isAdm && (
                      <button
                        onClick={() => unpinFromPanel(p.id)}
                        title="Remover dos fixados"
                        className="shrink-0 hover:text-red-500 mt-0.5"
                        style={{ color: colors.textSecondary }}
                      >
                        <X size={16} />
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>

            <div className="px-4 py-2 text-[11px] border-t text-center" style={{ borderColor: colors.headerBorder, color: colors.textSecondary }}>
              {pinnedList.length}/10 fixadas
            </div>
          </div>
        </>
      )}

      <div ref={scrollRef} onScroll={handleScroll} className="flex-1 overflow-y-auto px-4 py-4 flex flex-col">
        {loadingOlder && (
          <div className="text-center text-xs py-2" style={{ color: colors.textSecondary }}>Carregando mensagens antigas...</div>
        )}
        {!loadingHistory && (messages || []).length === 0 && (
          <div className="m-auto text-sm" style={{ color: colors.textSecondary }}>Nenhuma mensagem ainda. Diga oi 👋</div>
        )}
        {agruparEmBlocos(messages).map((bloco) => (
          <MessageBubble
            key={bloco[0].id}
            messages={bloco}
            mine={bloco[0].sender_id === user.id}
            isGroup={conversation.type === "group"}
            isAdm={isAdm}
            currentUserId={user.id}
            onTogglePin={(msg) => onTogglePin(msg, !msg.pinned)}
            onReply={startReply}
            onEdit={startEdit}
            onDelete={deleteMessage}
            onReact={reactToMessage}
            onOpenImage={setViewingImage}
            onJumpToMessage={jumpToMessage}
            highlightedId={highlightedId}
            naoRespondidas={naoRespondidas}
            playingId={playingId}
            setPlayingId={setPlayingId}
            audioRefs={audioRefs}
          />
        ))}
      </div>

      <div className="border-t px-3 py-3 shrink-0" style={{ background: colors.inputBarBg, borderColor: colors.headerBorder }}>
        {(replyingTo || editingMessage) && (
          <div className="flex items-center gap-2 mb-2 rounded-lg px-3 py-2" style={{ background: colors.inputFieldBg }}>
            {editingMessage ? <Pencil size={14} className="text-[#2E6FD9] shrink-0" /> : <Reply size={14} className="text-[#2E6FD9] shrink-0" />}
            <div className="min-w-0 flex-1">
              <div className="text-[11px] font-medium text-[#2E6FD9]">{editingMessage ? "Editando mensagem" : `Respondendo ${replyingTo.sender_name?.split(" ")[0]}`}</div>
              <div className="text-[12px] truncate" style={{ color: colors.textSecondary }}>
                {editingMessage ? editingMessage.content : replyPreviewText(replyingTo.type, replyingTo.content, replyingTo.deleted)}
              </div>
            </div>
            <button onClick={cancelComposeExtra} className="shrink-0" style={{ color: colors.textSecondary }}>
              <X size={16} />
            </button>
          </div>
        )}

        {pendingImage && (
          <div className="flex items-center gap-3 mb-2 rounded-lg px-3 py-2" style={{ background: colors.inputFieldBg }}>
            <img src={pendingImage.previewUrl} alt="Prévia" className="w-14 h-14 rounded-lg object-cover shrink-0" />
            <div className="min-w-0 flex-1">
              <div className="text-[11px] font-medium text-[#2E6FD9]">Enviar foto</div>
              <div className="text-[12px] truncate" style={{ color: colors.textSecondary }}>{pendingImage.file.name}</div>
            </div>
            <button onClick={cancelarImagemPendente} className="shrink-0" style={{ color: colors.textSecondary }}>
              <X size={16} />
            </button>
          </div>
        )}

        {recording ? (
          <div className="flex items-center gap-3 rounded-full px-4 py-2.5" style={{ background: colors.inputFieldBg }}>
            <span className="w-2 h-2 rounded-full bg-red-500 animate-pulse shrink-0" />
            <span className="text-sm font-mono flex-1" style={{ color: colors.textPrimary }}>Gravando áudio — 0:{String(seconds).padStart(2, "0")}</span>
            <button onClick={stopRecording} className="w-8 h-8 rounded-full flex items-center justify-center text-white shrink-0" style={{ background: "#2E6FD9" }}>
              <Square size={13} fill="white" />
            </button>
          </div>
        ) : (
          <div className="flex items-center gap-1.5">
            <button onClick={() => imageInputRef.current?.click()} className="w-9 h-9 rounded-full flex items-center justify-center hover:text-[#2E6FD9] shrink-0" style={{ color: colors.textSecondary }}>
              <ImageIcon size={19} />
            </button>
            <button onClick={() => fileInputRef.current?.click()} className="w-9 h-9 rounded-full flex items-center justify-center hover:text-[#2E6FD9] shrink-0" style={{ color: colors.textSecondary }}>
              <Paperclip size={19} />
            </button>
            <input ref={imageInputRef} type="file" accept="image/*" className="hidden" onChange={(e) => handlePick(e, "image")} />
            <input ref={fileInputRef} type="file" className="hidden" onChange={(e) => handlePick(e, "file")} />

            <div className="flex-1 relative">
              <textarea
                ref={inputRef}
                value={draft}
                onChange={handleDraftChange}
                onKeyDown={handleInputKeyDown}
                onPaste={(e) => {
                  const item = Array.from(e.clipboardData?.items || []).find((it) => it.type.startsWith("image/"));
                  if (item) {
                    e.preventDefault();
                    const file = item.getAsFile();
                    if (file) setPendingImage({ file, previewUrl: URL.createObjectURL(file) });
                  }
                }}
                placeholder={pendingImage ? "Escreva uma legenda (opcional)" : "Escreva uma mensagem (Shift+Enter pula linha)"}
                rows={1}
                className="w-full rounded-2xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#2E6FD9] resize-none max-h-40 overflow-y-auto"
                style={{ background: colors.inputFieldBg, color: colors.textPrimary }}
                onInput={(e) => {
                  e.target.style.height = "auto";
                  e.target.style.height = `${Math.min(e.target.scrollHeight, 160)}px`;
                }}
              />

              {showMentions && mentionCandidates.length > 0 && (
                <div
                  className="absolute bottom-full left-0 mb-1 w-64 max-h-48 overflow-y-auto rounded-lg border shadow-lg z-20"
                  style={{ background: colors.panelBg, borderColor: colors.border }}
                >
                  {mentionCandidates.map((mMember, i) => (
                    <button
                      key={mMember.id}
                      onClick={() => pickMention(mMember)}
                      className="w-full flex items-center gap-2 px-3 py-2 text-left"
                      style={{ background: i === mentionIndex ? colors.inputFieldBg : "transparent" }}
                    >
                      <div className="w-6 h-6 rounded-full flex items-center justify-center text-white text-[9px] font-semibold overflow-hidden shrink-0" style={{ background: mMember.color }}>
                        {mMember.avatar_url ? <img src={fileUrl(mMember.avatar_url)} alt={mMember.name} className="w-full h-full object-cover" /> : mMember.name.split(" ").map((p) => p[0]).slice(0, 2).join("").toUpperCase()}
                      </div>
                      <span className="text-[13px]" style={{ color: colors.textPrimary }}>{mMember.name}</span>
                    </button>
                  ))}
                </div>
              )}
            </div>

            {draft.trim() || pendingImage ? (
              <button onClick={sendText} className="w-9 h-9 rounded-full flex items-center justify-center text-white shrink-0" style={{ background: "#2E6FD9" }}>
                <Send size={16} />
              </button>
            ) : (
              <button onClick={startRecording} className="w-9 h-9 rounded-full flex items-center justify-center hover:text-[#2E6FD9] shrink-0" style={{ color: colors.textSecondary }}>
                <Mic size={19} />
              </button>
            )}
          </div>
        )}
      </div>

      <ImageViewer image={viewingImage} onClose={() => setViewingImage(null)} />
    </div>
  );
}
