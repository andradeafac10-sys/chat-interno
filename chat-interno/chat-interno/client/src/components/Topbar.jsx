import React, { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Search, ChevronDown, Megaphone, Sun, Moon, Settings, LogOut, ShieldCheck, Eye, LayoutDashboard, X, Users, MessageSquare, UserCog } from "lucide-react";
import { useAuth } from "../context/AuthContext";
import { useTheme } from "../context/ThemeContext";
import { api, fileUrl } from "../api";

// Mesmo formato que o servidor usa pra identificar uma conversa privada
const pairDmId = (a, b) => {
  const [x, y] = [Number(a), Number(b)].sort((n, m) => n - m);
  return `dm-${x}-${y}`;
};

function previaMensagem(m) {
  if (!m.content) return "";
  return m.content.length > 60 ? m.content.slice(0, 60) + "…" : m.content;
}

/**
 * Barra global fixa no topo — logo, busca (pessoas/conversas/mensagens),
 * comunicados e o menu da conta (configurações, tema, monitoria, gestão, sair).
 */
export default function Topbar({ onOpenAccount, onOpenAnnouncement, onOpenMonitoring, onOpenUsers, isOnline, conversations, onOpenConversation, onSelectConversationId }) {
  const { user, logout } = useAuth();
  const { theme, toggleTheme, colors } = useTheme();
  const navigate = useNavigate();
  const isAdm = user.role === "admin";
  const isDark = theme === "dark";

  const [menuAberto, setMenuAberto] = useState(false);
  const menuRef = useRef(null);

  const [busca, setBusca] = useState("");
  const [buscaAberta, setBuscaAberta] = useState(false);
  const [pessoas, setPessoas] = useState([]);
  const [mensagens, setMensagens] = useState([]);
  const buscaRef = useRef(null);
  const debounceRef = useRef(null);

  useEffect(() => {
    if (!menuAberto) return;
    const fechar = (e) => { if (menuRef.current && !menuRef.current.contains(e.target)) setMenuAberto(false); };
    window.addEventListener("mousedown", fechar);
    return () => window.removeEventListener("mousedown", fechar);
  }, [menuAberto]);

  useEffect(() => {
    if (!buscaAberta) return;
    const fechar = (e) => { if (buscaRef.current && !buscaRef.current.contains(e.target)) setBuscaAberta(false); };
    window.addEventListener("mousedown", fechar);
    return () => window.removeEventListener("mousedown", fechar);
  }, [buscaAberta]);

  useEffect(() => {
    clearTimeout(debounceRef.current);
    if (busca.trim().length < 2) {
      setPessoas([]);
      setMensagens([]);
      return;
    }
    debounceRef.current = setTimeout(async () => {
      try {
        const [{ data: diretorio }, { data: buscaMsgs }] = await Promise.all([
          api.get("/users/directory"),
          api.get("/conversations/search-global", { params: { q: busca.trim() } }),
        ]);
        setPessoas(
          diretorio.users.filter((u) => u.id !== user.id && u.name.toLowerCase().includes(busca.trim().toLowerCase())).slice(0, 6)
        );
        setMensagens(buscaMsgs.messages || []);
      } catch {
        // busca é um "nice to have" — se falhar, só não mostra nada, sem travar a tela
      }
    }, 300);
  }, [busca, user.id]);

  const conversasFiltradas = busca.trim().length >= 2
    ? (conversations || []).filter((c) => c.title.toLowerCase().includes(busca.trim().toLowerCase())).slice(0, 6)
    : [];

  function abrirPessoa(p) {
    onOpenConversation?.({
      id: pairDmId(user.id, p.id),
      type: "dm",
      title: p.name,
      color: p.color,
      avatarUrl: p.avatar_url,
      otherUserId: p.id,
      isAdmin: p.role === "admin",
    });
    setBusca("");
    setBuscaAberta(false);
  }

  function abrirConversa(id) {
    onSelectConversationId?.(id);
    setBusca("");
    setBuscaAberta(false);
  }

  const temResultados = pessoas.length > 0 || conversasFiltradas.length > 0 || mensagens.length > 0;

  return (
    <div
      className="h-14 shrink-0 flex items-center gap-4 px-4"
      style={{ background: colors.topbarBg }}
    >
      <div className="flex items-center gap-2 shrink-0">
        <img src="/logo.svg" alt="" className="w-6 h-6" />
        <span className="text-white text-[14px] font-semibold hidden sm:inline">Chat Nacional</span>
      </div>

      <div className="flex-1 max-w-[420px] hidden md:block relative" ref={buscaRef}>
        <div className="relative">
          <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-white/50" />
          <input
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
            onFocus={() => setBuscaAberta(true)}
            placeholder="Buscar mensagens, pessoas ou conversas..."
            aria-label="Buscar mensagens, pessoas ou conversas"
            className="w-full h-9 pl-9 pr-8 rounded-lg text-[13px] text-white placeholder-white/50 bg-white/10 focus:bg-white/15 outline-none transition-colors"
          />
          {busca && (
            <button
              onClick={() => { setBusca(""); setBuscaAberta(false); }}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-white/50 hover:text-white"
              aria-label="Limpar busca"
            >
              <X size={14} />
            </button>
          )}
        </div>

        {buscaAberta && busca.trim().length >= 2 && (
          <div
            className="absolute top-full left-0 mt-2 w-full max-h-[420px] overflow-y-auto rounded-xl shadow-lg border z-50 py-1.5"
            style={{ background: colors.panelBg, borderColor: colors.border }}
          >
            {!temResultados && (
              <div className="px-3.5 py-4 text-[13px] text-center" style={{ color: colors.textSecondary }}>
                Nada encontrado.
              </div>
            )}

            {pessoas.length > 0 && (
              <div className="pb-1">
                <div className="px-3.5 pt-1.5 pb-1 text-[10.5px] font-bold uppercase tracking-wide" style={{ color: colors.textMuted || colors.textSecondary }}>Pessoas</div>
                {pessoas.map((p) => (
                  <button
                    key={p.id}
                    onClick={() => abrirPessoa(p)}
                    className="w-full flex items-center gap-2.5 px-3.5 py-2 text-left hover:brightness-95"
                  >
                    <div className="w-7 h-7 rounded-full flex items-center justify-center text-white text-[10px] font-semibold overflow-hidden shrink-0" style={{ background: p.color }}>
                      {p.avatar_url ? <img src={fileUrl(p.avatar_url)} alt={p.name} className="w-full h-full object-cover" /> : p.name.split(" ").map((x) => x[0]).slice(0, 2).join("").toUpperCase()}
                    </div>
                    <span className="text-[13px]" style={{ color: colors.textPrimary }}>{p.name}</span>
                  </button>
                ))}
              </div>
            )}

            {conversasFiltradas.length > 0 && (
              <div className="pb-1 border-t" style={{ borderColor: colors.borderLight || colors.border }}>
                <div className="px-3.5 pt-1.5 pb-1 text-[10.5px] font-bold uppercase tracking-wide" style={{ color: colors.textMuted || colors.textSecondary }}>Conversas</div>
                {conversasFiltradas.map((c) => (
                  <button
                    key={c.id}
                    onClick={() => abrirConversa(c.id)}
                    className="w-full flex items-center gap-2.5 px-3.5 py-2 text-left hover:brightness-95"
                  >
                    <Users size={14} style={{ color: colors.textSecondary }} />
                    <span className="text-[13px]" style={{ color: colors.textPrimary }}>{c.title}</span>
                  </button>
                ))}
              </div>
            )}

            {mensagens.length > 0 && (
              <div className="border-t" style={{ borderColor: colors.borderLight || colors.border }}>
                <div className="px-3.5 pt-1.5 pb-1 text-[10.5px] font-bold uppercase tracking-wide" style={{ color: colors.textMuted || colors.textSecondary }}>Mensagens</div>
                {mensagens.map((m) => (
                  <button
                    key={m.id}
                    onClick={() => abrirConversa(m.conversation_id)}
                    className="w-full flex items-start gap-2.5 px-3.5 py-2 text-left hover:brightness-95"
                  >
                    <MessageSquare size={14} className="mt-0.5 shrink-0" style={{ color: colors.textSecondary }} />
                    <div className="min-w-0">
                      <div className="text-[12px] font-medium" style={{ color: colors.textPrimary }}>{m.sender_name}</div>
                      <div className="text-[12px] truncate" style={{ color: colors.textSecondary }}>{previaMensagem(m)}</div>
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      <div className="flex-1" />

      <button
        onClick={onOpenAnnouncement}
        title="Comunicados"
        aria-label="Comunicados"
        className="text-white/80 hover:text-white shrink-0"
      >
        <Megaphone size={18} />
      </button>

      <div className="w-px h-6 bg-white/15 shrink-0" />

      <div className="relative shrink-0" ref={menuRef}>
        <button
          onClick={() => setMenuAberto((v) => !v)}
          className="flex items-center gap-2"
          aria-label="Menu da conta"
        >
          <div className="relative">
            <div
              className="w-8 h-8 rounded-full flex items-center justify-center text-white text-[11px] font-semibold overflow-hidden"
              style={{ background: user.color }}
            >
              {user.avatar_url ? (
                <img src={fileUrl(user.avatar_url)} alt={user.name} className="w-full h-full object-cover" />
              ) : (
                user.name.split(" ").map((p) => p[0]).slice(0, 2).join("").toUpperCase()
              )}
            </div>
            {isOnline && (
              <span className="absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 rounded-full bg-[#22C55E]" style={{ border: `2px solid ${colors.topbarBg}` }} />
            )}
          </div>
          <ChevronDown size={14} className="text-white/70 hidden sm:block" />
        </button>

        {menuAberto && (
          <div
            className="absolute top-full right-0 mt-2 w-56 rounded-xl shadow-lg border py-1.5 z-50"
            style={{ background: colors.panelBg, borderColor: colors.border }}
          >
            <div className="px-3.5 py-2.5 border-b" style={{ borderColor: colors.borderLight || colors.border }}>
              <div className="text-[13px] font-semibold truncate" style={{ color: colors.textPrimary }}>{user.name}</div>
              <div className="flex items-center gap-1 text-[11px] mt-0.5" style={{ color: colors.accent }}>
                {isAdm && <ShieldCheck size={11} />}
                {isAdm ? "Administrador" : "Operador"}
              </div>
            </div>

            <button
              onClick={() => { setMenuAberto(false); onOpenAccount?.(); }}
              className="w-full flex items-center gap-2.5 px-3.5 py-2.5 text-[13px] hover:brightness-95 text-left"
              style={{ color: colors.textPrimary }}
            >
              <Settings size={15} /> Configurações
            </button>
            <button
              onClick={() => { setMenuAberto(false); toggleTheme(); }}
              className="w-full flex items-center gap-2.5 px-3.5 py-2.5 text-[13px] hover:brightness-95 text-left"
              style={{ color: colors.textPrimary }}
            >
              {isDark ? <Sun size={15} /> : <Moon size={15} />} {isDark ? "Tema claro" : "Tema escuro"}
            </button>
            {isAdm && (
              <>
                <button
                  onClick={() => { setMenuAberto(false); onOpenMonitoring?.(); }}
                  className="w-full flex items-center gap-2.5 px-3.5 py-2.5 text-[13px] hover:brightness-95 text-left"
                  style={{ color: colors.textPrimary }}
                >
                  <Eye size={15} /> Monitoria
                </button>
                <button
                  onClick={() => { setMenuAberto(false); navigate("/gestao"); }}
                  className="w-full flex items-center gap-2.5 px-3.5 py-2.5 text-[13px] hover:brightness-95 text-left"
                  style={{ color: colors.textPrimary }}
                >
                  <LayoutDashboard size={15} /> Gestão
                </button>
                <button
                  onClick={() => { setMenuAberto(false); onOpenUsers?.(); }}
                  className="w-full flex items-center gap-2.5 px-3.5 py-2.5 text-[13px] hover:brightness-95 text-left"
                  style={{ color: colors.textPrimary }}
                >
                  <UserCog size={15} /> Usuários
                </button>
              </>
            )}
            <button
              onClick={() => { setMenuAberto(false); logout(); }}
              className="w-full flex items-center gap-2.5 px-3.5 py-2.5 text-[13px] hover:brightness-95 text-left"
              style={{ color: colors.danger || "#EF4444" }}
            >
              <LogOut size={15} /> Sair
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
