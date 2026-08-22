import React, { useState } from "react";
import { X, ShieldCheck } from "lucide-react";
import { api } from "../api";
import { useAuth } from "../context/AuthContext";

export default function AccountModal({ onClose }) {
  const { user } = useAuth();
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);
  const [saving, setSaving] = useState(false);

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

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50" onClick={onClose}>
      <div className="bg-white rounded-xl w-[360px] p-5" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-slate-800 font-semibold text-base">Minha conta</h3>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600"><X size={18} /></button>
        </div>

        <div className="flex items-center gap-2.5 mb-5 bg-slate-50 rounded-lg px-3 py-2.5">
          <div className="w-8 h-8 rounded-full flex items-center justify-center text-white text-xs font-semibold" style={{ background: user.color }}>
            {user.name.split(" ").map((p) => p[0]).slice(0, 2).join("").toUpperCase()}
          </div>
          <div>
            <div className="text-sm font-medium text-slate-800">{user.name}</div>
            <div className="flex items-center gap-1 text-[11px] text-slate-500">
              {user.role === "admin" && <ShieldCheck size={11} />}
              {user.username} · {user.role === "admin" ? "Administrador" : "Operador"}
            </div>
          </div>
        </div>

        <form onSubmit={submit}>
          <label className="text-xs font-medium text-slate-500 mb-1 block">Senha atual</label>
          <input
            type="password"
            value={currentPassword}
            onChange={(e) => setCurrentPassword(e.target.value)}
            className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm mb-3 focus:outline-none focus:ring-2 focus:ring-[#2F6FED]"
            required
          />
          <label className="text-xs font-medium text-slate-500 mb-1 block">Nova senha</label>
          <input
            type="password"
            value={newPassword}
            onChange={(e) => setNewPassword(e.target.value)}
            className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm mb-3 focus:outline-none focus:ring-2 focus:ring-[#2F6FED]"
            required
            minLength={6}
          />
          <label className="text-xs font-medium text-slate-500 mb-1 block">Confirmar nova senha</label>
          <input
            type="password"
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm mb-4 focus:outline-none focus:ring-2 focus:ring-[#2F6FED]"
            required
            minLength={6}
          />

          {error && <div className="text-red-500 text-xs mb-3">{error}</div>}
          {success && <div className="text-emerald-600 text-xs mb-3">Senha alterada com sucesso.</div>}

          <button
            type="submit"
            disabled={saving}
            className="w-full rounded-lg py-2.5 text-sm font-medium text-white disabled:opacity-50"
            style={{ background: "#2F6FED" }}
          >
            {saving ? "Salvando..." : "Trocar senha"}
          </button>
        </form>
      </div>
    </div>
  );
}
