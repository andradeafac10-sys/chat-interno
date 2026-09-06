import React, { useRef, useState } from "react";
import { ArrowLeft, UserCog, Eye, LayoutDashboard, Camera, ShieldCheck, AlertTriangle, Trash2 } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { useTheme } from "../context/ThemeContext";
import { api, fileUrl } from "../api";
import UsersPage from "./Users";
import MonitoringPage from "./Monitoring";

const ABAS = [
  { id: "conta", label: "Minha conta", icon: UserCog },
  { id: "usuarios", label: "Usuários", icon: UserCog },
  { id: "monitoria", label: "Monitoria", icon: Eye },
];

/**
 * Painel único do administrador: junta Minha Conta, Usuários e Monitoria numa
 * tela só, com abas — em vez de três botões que levavam a lugares separados.
 * A Gestão continua abrindo à parte (é grande demais pra caber aqui dentro),
 * mas ganha um atalho na barra lateral desse painel.
 */
export default function AdminPanel({ onBack }) {
  const [aba, setAba] = useState("usuarios");
  const { colors } = useTheme();
  const navigate = useNavigate();

  return (
    <div className="flex-1 flex flex-col" style={{ background: colors.chatBg }}>
      <div className="h-14 flex items-center gap-3 px-4 border-b shrink-0" style={{ background: "#0f2a4a" }}>
        <button onClick={onBack} className="text-white">
          <ArrowLeft size={19} />
        </button>
        <span className="text-white text-[14px] font-semibold">Painel do administrador</span>
      </div>

      <div className="flex-1 flex overflow-hidden">
        <nav className="w-[170px] shrink-0 border-r py-3 px-2 flex flex-col gap-1" style={{ borderColor: colors.border, background: colors.sidebarBg }}>
          {ABAS.map(({ id, label, icon: Icon }) => (
            <button
              key={id}
              onClick={() => setAba(id)}
              className="flex items-center gap-2.5 px-3 py-2.5 rounded-lg text-[13px] font-medium text-left"
              style={{
                background: aba === id ? "#0f2a4a" : "transparent",
                color: aba === id ? "#fff" : colors.textSecondary,
              }}
            >
              <Icon size={16} className="shrink-0" />
              {label}
            </button>
          ))}

          <button
            onClick={() => navigate("/gestao")}
            className="mt-auto flex items-center gap-2 px-3 py-2.5 rounded-lg text-[12px] font-medium border"
            style={{ borderColor: "#2563EB", color: "#2563EB" }}
          >
            <LayoutDashboard size={14} className="shrink-0" />
            Abrir gestão completa
          </button>
        </nav>

        <div className="flex-1 overflow-y-auto flex flex-col">
          {aba === "conta" && <MinhaContaTab />}
          {aba === "usuarios" && <UsersPage onBack={() => {}} />}
          {aba === "monitoria" && <MonitoringPage onBack={() => {}} />}
        </div>
      </div>
    </div>
  );
}

function MinhaContaTab() {
  const { user, updateUser } = useAuth();
  const { colors } = useTheme();
  const fileInputRef = useRef(null);
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);
  const [saving, setSaving] = useState(false);
  const [uploadingAvatar, setUploadingAvatar] = useState(false);
  const [cleaning, setCleaning] = useState("");
  const [cleanMsg, setCleanMsg] = useState("");

  const isSuperAdmin = user.role === "admin" && user.username === "admin";

  const submit = async (e) => {
    e.preventDefault();
    setError("");
    if (newPassword !== confirmPassword) {
      setError("A confirmação não bate com a nova senha.");
      return;
    }
    setSaving(true);
    try {
      await api.patch("/auth/password", { currentPassword, newPassword });
      setSuccess(true);
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
    } catch (err) {
      setError(err.response?.data?.error || "Não foi possível trocar a senha.");
    } finally {
      setSaving(false);
    }
  };

  const handleAvatarPick = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploadingAvatar(true);
    const form = new FormData();
    form.append("file", file);
    try {
      const { data } = await api.post("/auth/avatar", form, {
        headers: { "Content-Type": "multipart/form-data" },
      });
      updateUser({ avatar_url: data.avatar_url });
    } finally {
      setUploadingAvatar(false);
      e.target.value = "";
    }
  };

  const limpar = async (tipo) => {
    const label = tipo === "messages" ? "TODAS as mensagens de TODAS as conversas" : "TODAS as notificações";
    if (!window.confirm(`Tem certeza que quer apagar ${label}? Isso NÃO pode ser desfeito.`)) return;
    if (!window.confirm("Confirmando de novo: essa ação é definitiva. Deseja continuar?")) return;
    setCleaning(tipo);
    setCleanMsg("");
    try {
      await api.delete(`/maintenance/${tipo}`);
      setCleanMsg(tipo === "messages" ? "Mensagens apagadas." : "Notificações apagadas.");
    } catch (err) {
      setCleanMsg(err.response?.data?.error || "Não foi possível concluir a limpeza.");
    } finally {
      setCleaning("");
    }
  };

  return (
    <div className="max-w-md mx-auto w-full p-6">
      <div className="flex flex-col items-center mb-5">
        <button
          onClick={() => fileInputRef.current?.click()}
          className="relative w-16 h-16 rounded-full flex items-center justify-center text-white text-lg font-semibold overflow-hidden"
          style={{ background: user.color }}
        >
          {user.avatar_url ? (
            <img src={fileUrl(user.avatar_url)} alt={user.name} className="w-full h-full object-cover" />
          ) : (
            user.name.split(" ").map((p) => p[0]).slice(0, 2).join("").toUpperCase()
          )}
          <div className="absolute inset-0 bg-black/30 flex items-center justify-center opacity-0 hover:opacity-100 transition-opacity">
            <Camera size={18} color="white" />
          </div>
        </button>
        <span className="text-[11px] mt-1.5" style={{ color: colors.textSecondary }}>{uploadingAvatar ? "Enviando..." : "Trocar foto"}</span>
        <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={handleAvatarPick} />

        <div className="text-sm font-medium mt-3" style={{ color: colors.textPrimary }}>{user.name}</div>
        <div className="flex items-center gap-1 text-[11px]" style={{ color: colors.textSecondary }}>
          {user.role === "admin" && <ShieldCheck size={11} />}
          {user.username} · {user.role === "admin" ? "Administrador" : "Operador"}
        </div>
      </div>

      <form onSubmit={submit} className="pb-5 border-b" style={{ borderColor: colors.border }}>
        <label className="text-xs font-medium mb-1 block" style={{ color: colors.textSecondary }}>Senha atual</label>
        <input
          type="password" value={currentPassword} onChange={(e) => setCurrentPassword(e.target.value)}
          className="w-full border rounded-lg px-3 py-2 text-sm mb-3 focus:outline-none focus:ring-2 focus:ring-[#2563EB]"
          style={{ borderColor: colors.border, background: colors.inputFieldBg, color: colors.textPrimary }}
          required
        />
        <label className="text-xs font-medium mb-1 block" style={{ color: colors.textSecondary }}>Nova senha</label>
        <input
          type="password" value={newPassword} onChange={(e) => setNewPassword(e.target.value)}
          className="w-full border rounded-lg px-3 py-2 text-sm mb-3 focus:outline-none focus:ring-2 focus:ring-[#2563EB]"
          style={{ borderColor: colors.border, background: colors.inputFieldBg, color: colors.textPrimary }}
          required minLength={6}
        />
        <label className="text-xs font-medium mb-1 block" style={{ color: colors.textSecondary }}>Confirmar nova senha</label>
        <input
          type="password" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)}
          className="w-full border rounded-lg px-3 py-2 text-sm mb-4 focus:outline-none focus:ring-2 focus:ring-[#2563EB]"
          style={{ borderColor: colors.border, background: colors.inputFieldBg, color: colors.textPrimary }}
          required minLength={6}
        />
        {error && <div className="text-red-500 text-xs mb-3">{error}</div>}
        {success && <div className="text-emerald-600 text-xs mb-3">Senha alterada com sucesso.</div>}
        <button
          type="submit" disabled={saving}
          className="w-full rounded-lg py-2.5 text-sm font-medium text-white disabled:opacity-50"
          style={{ background: "#2563EB" }}
        >
          {saving ? "Salvando..." : "Trocar senha"}
        </button>
      </form>

      {isSuperAdmin && (
        <div className="mt-6">
          <div className="flex items-center gap-1.5 text-[12px] font-semibold text-red-600 mb-1">
            <AlertTriangle size={14} /> Zona de risco
          </div>
          <p className="text-[11px] mb-3" style={{ color: colors.textSecondary }}>
            Ações definitivas, disponíveis só para o administrador principal.
          </p>
          <button
            onClick={() => limpar("messages")} disabled={!!cleaning}
            className="w-full flex items-center justify-center gap-1.5 rounded-lg py-2 text-[13px] font-medium border border-red-200 text-red-600 hover:bg-red-50 disabled:opacity-50 mb-2"
          >
            <Trash2 size={14} /> {cleaning === "messages" ? "Apagando..." : "Limpar todas as mensagens"}
          </button>
          <button
            onClick={() => limpar("announcements")} disabled={!!cleaning}
            className="w-full flex items-center justify-center gap-1.5 rounded-lg py-2 text-[13px] font-medium border border-red-200 text-red-600 hover:bg-red-50 disabled:opacity-50"
          >
            <Trash2 size={14} /> {cleaning === "announcements" ? "Apagando..." : "Apagar todas as notificações"}
          </button>
          {cleanMsg && <div className="text-[12px] mt-2" style={{ color: colors.textSecondary }}>{cleanMsg}</div>}
        </div>
      )}
    </div>
  );
}
