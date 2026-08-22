import React, { useState } from "react";
import { useAuth } from "../context/AuthContext";
import { ShieldCheck } from "lucide-react";

export default function Login() {
  const { login } = useAuth();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      await login(username.trim(), password);
    } catch (err) {
      setError(err.response?.data?.error || "Não foi possível entrar.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center" style={{ background: "#111B21" }}>
      <form onSubmit={handleSubmit} className="w-[340px] bg-[#202C33] rounded-2xl p-7 border border-slate-800">
        <div className="flex items-center gap-2 mb-1">
          <div className="w-9 h-9 rounded-lg flex items-center justify-center" style={{ background: "#25D366" }}>
            <ShieldCheck size={18} color="white" />
          </div>
          <h1 className="text-slate-100 text-lg font-semibold">Chat Interno</h1>
        </div>
        <p className="text-slate-500 text-xs mb-6">Acesso restrito à equipe</p>

        <label className="text-xs text-slate-400 mb-1 block">Usuário</label>
        <input
          value={username}
          onChange={(e) => setUsername(e.target.value)}
          className="w-full bg-[#111B21] border border-slate-700 rounded-lg px-3 py-2.5 text-sm text-slate-100 mb-4 focus:outline-none focus:ring-2 focus:ring-[#25D366]"
          autoFocus
        />

        <label className="text-xs text-slate-400 mb-1 block">Senha</label>
        <input
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className="w-full bg-[#111B21] border border-slate-700 rounded-lg px-3 py-2.5 text-sm text-slate-100 mb-5 focus:outline-none focus:ring-2 focus:ring-[#25D366]"
        />

        {error && <div className="text-red-400 text-xs mb-4">{error}</div>}

        <button
          type="submit"
          disabled={loading}
          className="w-full rounded-lg py-2.5 text-sm font-medium text-white disabled:opacity-50"
          style={{ background: "#25D366" }}
        >
          {loading ? "Entrando..." : "Entrar"}
        </button>
      </form>
    </div>
  );
}
