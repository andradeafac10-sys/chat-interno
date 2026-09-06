import React, { useRef, useState } from "react";
import { X, ShieldCheck, Camera, Trash2, AlertTriangle } from "lucide-react";
import { api, fileUrl } from "../api";
import { useAuth } from "../context/AuthContext";

export default function AccountModal({ onClose }) {
  const { user, updateUser } = useAuth();
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);
  const [saving, setSaving] = useState(false);
  const [uploadingAvatar, setUploadingAvatar] = useState(false);
  const [cleaning, setCleaning] = useState("");
  const [cleanMsg, setCleanMsg] = useState("");

  // Só o usuário "admin" (dono do sistema) vê as ações de limpeza
  const isSuperAdmin = user.role === "admin" && user.username === "admin";

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
  const fileInputRef = useRef(null);

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

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50" onClick={onClose}>
      <div className="bg-white rounded-xl w-[380px] max-h-[85vh] overflow-y-auto p-5" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-slate-800 font-semibold text-base">Minha conta</h3>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600"><X size={18} /></button>
        </div>

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
          <span className="text-[11px] text-slate-400 mt-1.5">{uploadingAvatar ? "Enviando..." : "Trocar foto"}</span>
          <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={handleAvatarPick} />

          <div className="text-sm font-medium text-slate-800 mt-3">{user.name}</div>
          <div className="flex items-center gap-1 text-[11px] text-slate-500">
            {user.role === "admin" && <ShieldCheck size={11} />}
            {user.username} · {user.role === "admin" ? "Administrador" : "Operador"}
          </div>
        </div>

        <form onSubmit={submit}>
          <label className="text-xs font-medium text-slate-500 mb-1 block">Senha atual</label>
          <input
            type="password"
            value={currentPassword}
            onChange={(e) => setCurrentPassword(e.target.value)}
            className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm mb-3 focus:outline-none focus:ring-2 focus:ring-[#2563EB]"
            required
          />
          <label className="text-xs font-medium text-slate-500 mb-1 block">Nova senha</label>
          <input
            type="password"
            value={newPassword}
            onChange={(e) => setNewPassword(e.target.value)}
            className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm mb-3 focus:outline-none focus:ring-2 focus:ring-[#2563EB]"
            required
            minLength={6}
          />
          <label className="text-xs font-medium text-slate-500 mb-1 block">Confirmar nova senha</label>
          <input
            type="password"
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm mb-4 focus:outline-none focus:ring-2 focus:ring-[#2563EB]"
            required
            minLength={6}
          />

          {error && <div className="text-red-500 text-xs mb-3">{error}</div>}
          {success && <div className="text-emerald-600 text-xs mb-3">Senha alterada com sucesso.</div>}

          <button
            type="submit"
            disabled={saving}
            className="w-full rounded-lg py-2.5 text-sm font-medium text-white disabled:opacity-50"
            style={{ background: "#2563EB" }}
          >
            {saving ? "Salvando..." : "Trocar senha"}
          </button>
        </form>

        {isSuperAdmin && (
          <div className="mt-6 pt-5 border-t border-slate-200">
            <div className="flex items-center gap-1.5 text-[12px] font-semibold text-red-600 mb-1">
              <AlertTriangle size={14} /> Zona de risco
            </div>
            <p className="text-[11px] text-slate-500 mb-3">
              Ações definitivas, disponíveis só para o administrador principal.
            </p>

            <button
              onClick={() => limpar("messages")}
              disabled={!!cleaning}
              className="w-full flex items-center justify-center gap-1.5 rounded-lg py-2 text-[13px] font-medium border border-red-200 text-red-600 hover:bg-red-50 disabled:opacity-50 mb-2"
            >
              <Trash2 size={14} /> {cleaning === "messages" ? "Apagando..." : "Limpar todas as mensagens"}
            </button>

            <button
              onClick={() => limpar("announcements")}
              disabled={!!cleaning}
              className="w-full flex items-center justify-center gap-1.5 rounded-lg py-2 text-[13px] font-medium border border-red-200 text-red-600 hover:bg-red-50 disabled:opacity-50"
            >
              <Trash2 size={14} /> {cleaning === "announcements" ? "Apagando..." : "Apagar todas as notificações"}
            </button>

            {cleanMsg && <div className="text-[12px] text-slate-600 mt-2">{cleanMsg}</div>}
          </div>
        )}
      </div>
    </div>
  );
}
