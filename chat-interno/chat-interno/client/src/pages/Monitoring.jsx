import React, { useEffect, useState } from "react";
import { ArrowLeft, Eye, Users, ShieldCheck, ChevronRight, MessageSquare } from "lucide-react";
import { api, fileUrl } from "../api";
import { useTheme } from "../context/ThemeContext";

const fmtDateTime = (ts) =>
  new Date(ts).toLocaleString("pt-BR", {
    day: "2-digit", month: "2-digit", year: "numeric",
    hour: "2-digit", minute: "2-digit",
  });

export default function Monitoring({ onBack }) {
  const { colors } = useTheme();
  const [users, setUsers] = useState([]);
  const [selectedUser, setSelectedUser] = useState(null);
  const [conversations, setConversations] = useState([]);
  const [selectedConv, setSelectedConv] = useState(null);
  const [messages, setMessages] = useState([]);
  const [loading, setLoading] = useState(false);

  const [error, setError] = useState("");

  useEffect(() => {
    api.get("/users/manage")
      .then(({ data }) => setUsers(data.users))
      .catch(() => setError("Não foi possível carregar a lista de pessoas."));
  }, []);

  const pickUser = async (u) => {
    setSelectedUser(u);
    setSelectedConv(null);
    setMessages([]);
    setLoading(true);
    setError("");
    try {
      const { data } = await api.get(`/monitoring/conversations?userId=${u.id}`);
      setConversations(data.conversations);
    } catch (err) {
      setConversations([]);
      setError(err.response?.data?.error || "Não foi possível carregar as conversas dessa pessoa.");
    } finally {
      setLoading(false);
    }
  };

  const pickConv = async (conv) => {
    setSelectedConv(conv);
    setLoading(true);
    try {
      const { data } = await api.get(`/monitoring/messages?conversationId=${encodeURIComponent(conv.id)}`);
      setMessages(data.messages);
    } catch (err) {
      setMessages([]);
      alert(err.response?.data?.error || "Não foi possível carregar essa conversa.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex-1 flex flex-col" style={{ background: colors.chatBg }}>
      <div className="h-16 flex items-center gap-3 px-4 border-b shrink-0" style={{ background: colors.headerBg, borderColor: colors.headerBorder }}>
        <button onClick={onBack} style={{ color: colors.textSecondary }}>
          <ArrowLeft size={20} />
        </button>
        <div className="text-sm font-semibold flex items-center gap-2" style={{ color: colors.textPrimary }}>
          <Eye size={16} className="text-[#2E6FD9]" /> Monitoria
        </div>
      </div>

      <div className="flex-1 flex overflow-hidden">
        {/* Coluna 1: pessoas */}
        <div className="w-[240px] border-r overflow-y-auto shrink-0" style={{ borderColor: colors.border }}>
          <div className="px-3 py-2 text-[11px] font-semibold uppercase tracking-wide" style={{ color: colors.textSecondary }}>
            Pessoas
          </div>
          {users.map((u) => (
            <button
              key={u.id}
              onClick={() => pickUser(u)}
              className="w-full flex items-center gap-2.5 px-3 py-2.5 text-left"
              style={{ background: selectedUser?.id === u.id ? colors.sidebarActive : "transparent" }}
            >
              <div className="w-8 h-8 rounded-full flex items-center justify-center text-white text-[10px] font-semibold shrink-0 overflow-hidden" style={{ background: u.color }}>
                {u.avatar_url ? (
                  <img src={fileUrl(u.avatar_url)} alt={u.name} className="w-full h-full object-cover" />
                ) : (
                  u.name.split(" ").map((p) => p[0]).slice(0, 2).join("").toUpperCase()
                )}
              </div>
              <div className="min-w-0 flex-1">
                <div className="text-[13px] font-medium truncate flex items-center gap-1" style={{ color: colors.textPrimary }}>
                  {u.name}
                  {u.role === "admin" && <ShieldCheck size={11} className="text-[#2E6FD9]" />}
                </div>
                <div className="text-[11px]" style={{ color: colors.textSecondary }}>
                  {u.role === "admin" ? "Administrador" : "Operador"}
                </div>
              </div>
            </button>
          ))}
        </div>

        {/* Coluna 2: conversas da pessoa */}
        <div className="w-[280px] border-r overflow-y-auto shrink-0" style={{ borderColor: colors.border }}>
          <div className="px-3 py-2 text-[11px] font-semibold uppercase tracking-wide" style={{ color: colors.textSecondary }}>
            Conversas
          </div>
          {!selectedUser ? (
            <div className="px-3 py-4 text-xs" style={{ color: colors.textSecondary }}>
              Escolha uma pessoa à esquerda.
            </div>
          ) : loading ? (
            <div className="px-3 py-4 text-xs" style={{ color: colors.textSecondary }}>Carregando...</div>
          ) : error ? (
            <div className="px-3 py-4 text-xs text-red-500">{error}</div>
          ) : conversations.length === 0 ? (
            <div className="px-3 py-4 text-xs" style={{ color: colors.textSecondary }}>
              Nenhuma conversa com mensagens.
            </div>
          ) : (
            conversations.map((c) => (
              <button
                key={c.id}
                onClick={() => pickConv(c)}
                className="w-full flex items-center gap-2 px-3 py-2.5 text-left"
                style={{ background: selectedConv?.id === c.id ? colors.sidebarActive : "transparent" }}
              >
                {c.type === "group" ? <Users size={14} className="shrink-0" style={{ color: colors.textSecondary }} /> : <MessageSquare size={14} className="shrink-0" style={{ color: colors.textSecondary }} />}
                <div className="min-w-0 flex-1">
                  <div className="text-[13px] truncate" style={{ color: colors.textPrimary }}>{c.title}</div>
                  <div className="text-[11px]" style={{ color: colors.textSecondary }}>
                    {c.messageCount} mensagem(ns) · {fmtDateTime(c.lastAt)}
                  </div>
                </div>
                <ChevronRight size={14} className="shrink-0" style={{ color: colors.textSecondary }} />
              </button>
            ))
          )}
        </div>

        {/* Coluna 3: mensagens */}
        <div className="flex-1 overflow-y-auto p-4">
          {!selectedConv ? (
            <div className="text-sm h-full flex items-center justify-center" style={{ color: colors.textSecondary }}>
              Escolha uma conversa para ver o histórico completo.
            </div>
          ) : loading ? (
            <div className="text-sm" style={{ color: colors.textSecondary }}>Carregando...</div>
          ) : messages.length === 0 ? (
            <div className="text-sm" style={{ color: colors.textSecondary }}>Nenhuma mensagem.</div>
          ) : (
            <div className="flex flex-col gap-3">
              <div className="text-[11px] mb-1" style={{ color: colors.textSecondary }}>
                Somente leitura · {messages.length} mensagem(ns)
              </div>
              {messages.map((m) => (
                <div key={m.id} className="flex gap-3">
                  <div className="w-8 h-8 rounded-full flex items-center justify-center text-white text-[10px] font-semibold shrink-0 overflow-hidden mt-0.5" style={{ background: m.sender_color }}>
                    {m.sender_avatar_url ? (
                      <img src={fileUrl(m.sender_avatar_url)} alt={m.sender_name} className="w-full h-full object-cover" />
                    ) : (
                      m.sender_name?.split(" ").map((p) => p[0]).slice(0, 2).join("").toUpperCase()
                    )}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-[13px] font-semibold" style={{ color: colors.textPrimary }}>{m.sender_name}</span>
                      <span className="text-[11px]" style={{ color: colors.textSecondary }}>{fmtDateTime(m.created_at)}</span>
                      {m.edited && <span className="text-[10px] italic" style={{ color: colors.textSecondary }}>editado</span>}
                      {m.deleted && <span className="text-[10px] italic text-red-500">apagada</span>}
                    </div>
                    {m.deleted ? (
                      <div className="text-[13px] italic" style={{ color: colors.textSecondary }}>Conteúdo apagado</div>
                    ) : m.type === "text" ? (
                      <div className="text-[13px] whitespace-pre-wrap break-words" style={{ color: colors.textPrimary }}>{m.content}</div>
                    ) : m.type === "image" ? (
                      <a href={fileUrl(m.file_url)} target="_blank" rel="noreferrer">
                        <img src={fileUrl(m.file_url)} alt={m.file_name} className="rounded-lg max-w-[240px] max-h-[200px] object-cover mt-1" />
                      </a>
                    ) : (
                      <a href={fileUrl(m.file_url)} download={m.file_name} className="text-[13px] text-[#2E6FD9] underline">
                        {m.type === "audio" ? "🎤 Áudio" : `📎 ${m.file_name}`}
                      </a>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
