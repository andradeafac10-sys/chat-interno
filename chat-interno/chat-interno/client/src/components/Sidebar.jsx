import React, { useState } from "react";
import { Search, Plus, Users, Lock, ShieldCheck, LogOut, Settings, UserCog } from "lucide-react";
import { useAuth } from "../context/AuthContext";
import { fileUrl } from "../api";

const fmtTime = (ts) => new Date(ts).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });

function preview(last) {
  if (!last) return "";
  if (last.type === "text") return last.content;
  if (last.type === "image") return "📎 Foto";
  if (last.type === "audio") return "🎤 Áudio";
  return "📎 Arquivo";
}

export default function Sidebar({ conversations, activeConvId, setActiveConvId, onNewGroup, onOpenAccount, onOpenUsers, onlineUsers, flashIds }) {
  const { user, logout } = useAuth();
  const [filter, setFilter] = useState("");
  const isAdm = user.role === "admin";

  const filtered = conversations
    .filter((c) => c.title.toLowerCase().includes(filter.toLowerCase()))
    .sort((a, b) => {
      const at = a.lastMessage?.created_at ? new Date(a.lastMessage.created_at).getTime() : 0;
      const bt = b.lastMessage?.created_at ? new Date(b.lastMessage.created_at).getTime() : 0;
      return bt - at;
    });

  return (
    <div className="w-[320px] flex flex-col border-r border-slate-800" style={{ background: "#111B21" }}>
      <div className="flex items-center gap-2.5 px-3 py-3.5">
        <div className="w-9 h-9 rounded-full flex items-center justify-center text-white text-xs font-semibold shrink-0" style={{ background: user.color }}>
          {user.name.split(" ").map((p) => p[0]).slice(0, 2).join("").toUpperCase()}
        </div>
        <div className="min-w-0 flex-1">
          <div className="text-slate-100 text-sm font-medium truncate">{user.name}</div>
          <div className="flex items-center gap-1 text-[11px] font-mono" style={{ color: isAdm ? "#25D366" : "#94A3B8" }}>
            {isAdm && <ShieldCheck size={11} />}
            {isAdm ? "ADMINISTRADOR" : "OPERADOR"}
          </div>
        </div>
        <button onClick={onOpenAccount} title="Minha conta" className="text-slate-500 hover:text-slate-300 shrink-0">
          <Settings size={16} />
        </button>
        <button onClick={logout} title="Sair" className="text-slate-500 hover:text-slate-300 shrink-0">
          <LogOut size={16} />
        </button>
      </div>

      {isAdm && (
        <div className="px-3 pb-2">
          <button
            onClick={onOpenUsers}
            className="w-full flex items-center justify-center gap-1.5 text-sm font-medium rounded-lg py-2 text-slate-200 border border-slate-700 hover:bg-[#202C33]"
          >
            <UserCog size={15} /> Usuários da equipe
          </button>
        </div>
      )}

      <div className="px-3 pb-2">
        <div className="relative">
          <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-500" />
          <input
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
            placeholder="Buscar conversa"
            className="w-full bg-[#202C33] text-slate-200 text-sm rounded-lg pl-8 pr-3 py-2 border border-transparent focus:outline-none focus:border-[#25D366] placeholder:text-slate-500"
          />
        </div>
      </div>

      {!isAdm && (
        <div className="mx-3 mb-2 flex items-start gap-2 rounded-lg bg-[#202C33] border border-slate-700/70 px-2.5 py-2">
          <Lock size={13} className="text-slate-500 mt-0.5 shrink-0" />
          <p className="text-[11px] leading-tight text-slate-400">Você só conversa com o ADM e com os grupos em que foi adicionado.</p>
        </div>
      )}

      {isAdm && (
        <div className="px-3 pb-2">
          <button
            onClick={onNewGroup}
            className="w-full flex items-center justify-center gap-1.5 text-sm font-medium rounded-lg py-2 text-white"
            style={{ background: "#25D366" }}
          >
            <Plus size={15} /> Novo grupo
          </button>
        </div>
      )}

      <div className="flex-1 overflow-y-auto px-1.5 pb-2">
        {filtered.map((c) => {
          const active = c.id === activeConvId;
          return (
            <button
              key={c.id}
              onClick={() => setActiveConvId(c.id)}
              className={`w-full flex items-center gap-2.5 px-2.5 py-2.5 rounded-lg text-left ${flashIds?.has(c.id) ? "flash-new-message" : ""}`}
              style={{ background: active ? "#2A3942" : "transparent" }}
            >
              <div className="w-10 h-10 rounded-full flex items-center justify-center text-white text-xs font-semibold shrink-0 overflow-hidden relative" style={{ background: c.type === "group" ? "#334155" : c.color || "#25D366" }}>
                {c.type === "group" ? (
                  c.avatarUrl ? <img src={fileUrl(c.avatarUrl)} alt={c.title} className="w-full h-full object-cover" /> : <Users size={16} />
                ) : (
                  c.title.split(" ").map((p) => p[0]).slice(0, 2).join("").toUpperCase()
                )}
                {c.type === "dm" && onlineUsers?.has(c.otherUserId) && (
                  <span className="absolute bottom-0 right-0 w-3 h-3 rounded-full bg-[#25D366] border-2 border-[#111B21]" />
                )}
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-center justify-between">
                  <span className="text-slate-100 text-sm font-medium truncate">{c.title}</span>
                  {c.lastMessage && <span className="text-[10px] text-slate-500 font-mono shrink-0 ml-1">{fmtTime(c.lastMessage.created_at)}</span>}
                </div>
                <div className="text-[12px] text-slate-500 truncate">{preview(c.lastMessage) || (c.type === "group" ? `${c.memberCount} membro(s)` : "")}</div>
              </div>
            </button>
          );
        })}
        {filtered.length === 0 && <div className="text-center text-slate-600 text-sm mt-8">Nenhuma conversa encontrada</div>}
      </div>
    </div>
  );
}
