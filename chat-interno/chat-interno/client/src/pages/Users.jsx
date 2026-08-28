import React, { useEffect, useState } from "react";
import { ArrowLeft, ShieldCheck, Plus, X, KeyRound, UserX, UserCheck, Pencil, Search } from "lucide-react";
import { api } from "../api";

const COLORS = ["#2E6FD9", "#0EA5A5", "#D97706", "#7C3AED", "#DB2777", "#059669"];

export default function Users({ onBack }) {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [busca, setBusca] = useState("");
  const [showNew, setShowNew] = useState(false);
  const [resetTarget, setResetTarget] = useState(null);
  const [editTarget, setEditTarget] = useState(null);

  const load = () => {
    setLoading(true);
    api.get("/users/manage").then(({ data }) => {
      setUsers(data.users);
      setLoading(false);
    });
  };

  useEffect(() => { load(); }, []);

  const usersFiltrados = users.filter((u) => u.name.toLowerCase().includes(busca.trim().toLowerCase()));

  const toggleActive = async (u) => {
    await api.patch(`/users/${u.id}/active`, { active: !u.active });
    load();
  };

  return (
    <div className="flex-1 flex flex-col" style={{ background: "#EFEAE2" }}>
      <div className="h-16 flex items-center gap-3 px-4 border-b border-[#D1D7DB] bg-white shrink-0">
        <button onClick={onBack} className="text-slate-500 hover:text-slate-700">
          <ArrowLeft size={20} />
        </button>
        <div className="text-slate-800 text-sm font-semibold">Usuários da equipe</div>
        <button
          onClick={() => setShowNew(true)}
          className="ml-auto flex items-center gap-1.5 text-sm font-medium rounded-lg px-3 py-2 text-white"
          style={{ background: "#2E6FD9" }}
        >
          <Plus size={15} /> Novo usuário
        </button>
      </div>

      <div className="px-4 pt-4">
        <div className="relative">
          <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
            placeholder="Buscar pessoa pelo nome..."
            className="w-full bg-white border border-[#D1D7DB] rounded-lg pl-9 pr-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#2E6FD9]"
          />
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-4">
        {loading ? (
          <div className="text-slate-400 text-sm">Carregando...</div>
        ) : (
          <div className="bg-white rounded-xl border border-[#D1D7DB] overflow-hidden">
            {usersFiltrados.length === 0 && (
              <div className="text-slate-400 text-sm p-4 text-center">Ninguém encontrado com esse nome.</div>
            )}
            {usersFiltrados.map((u) => (
              <div key={u.id} className="flex items-center gap-3 px-4 py-3 border-b border-[#EFEAE2] last:border-0">
                <div className="w-9 h-9 rounded-full flex items-center justify-center text-white text-xs font-semibold shrink-0" style={{ background: u.color }}>
                  {u.name.split(" ").map((p) => p[0]).slice(0, 2).join("").toUpperCase()}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-1.5">
                    <span className="text-sm font-medium text-slate-800 truncate">{u.name}</span>
                    {u.role === "admin" && <ShieldCheck size={13} className="text-[#2E6FD9]" />}
                    {!u.active && <span className="text-[10px] px-1.5 py-0.5 rounded bg-slate-100 text-slate-500">Desativado</span>}
                  </div>
                  <div className="text-[12px] text-slate-500">{u.username} · {u.role === "admin" ? "Administrador" : "Operador"}</div>
                </div>
                <button
                  onClick={() => setEditTarget(u)}
                  title="Editar nome"
                  className="text-slate-400 hover:text-[#2E6FD9] p-1.5"
                >
                  <Pencil size={16} />
                </button>
                <button
                  onClick={() => setResetTarget(u)}
                  title="Definir nova senha"
                  className="text-slate-400 hover:text-[#2E6FD9] p-1.5"
                >
                  <KeyRound size={16} />
                </button>
                <button
                  onClick={() => toggleActive(u)}
                  title={u.active ? "Desativar" : "Ativar"}
                  className="text-slate-400 hover:text-red-500 p-1.5"
                >
                  {u.active ? <UserX size={16} /> : <UserCheck size={16} />}
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      {showNew && <NewUserModal onClose={() => setShowNew(false)} onCreated={() => { setShowNew(false); load(); }} />}
      {resetTarget && <ResetPasswordModal user={resetTarget} onClose={() => setResetTarget(null)} />}
      {editTarget && <EditUserModal user={editTarget} onClose={() => setEditTarget(null)} onSaved={() => { setEditTarget(null); load(); }} />}
    </div>
  );
}

function EditUserModal({ user, onClose, onSaved }) {
  const [name, setName] = useState(user.name);
  const [username, setUsername] = useState(user.username);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    setError("");
    setSaving(true);
    try {
      await api.patch(`/users/${user.id}`, { name, username });
      onSaved();
    } catch (err) {
      setError(err.response?.data?.error || "Não foi possível salvar.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50" onClick={onClose}>
      <div className="bg-white rounded-xl w-[340px] p-5" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-slate-800 font-semibold text-base">Editar usuário</h3>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600"><X size={18} /></button>
        </div>
        <form onSubmit={submit}>
          <label className="text-xs font-medium text-slate-500 mb-1 block">Nome completo</label>
          <input value={name} onChange={(e) => setName(e.target.value)} className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm mb-3 focus:outline-none focus:ring-2 focus:ring-[#2E6FD9]" required />

          <label className="text-xs font-medium text-slate-500 mb-1 block">Usuário de login</label>
          <input value={username} onChange={(e) => setUsername(e.target.value)} className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm mb-4 focus:outline-none focus:ring-2 focus:ring-[#2E6FD9]" required />

          {error && <div className="text-red-500 text-xs mb-3">{error}</div>}

          <button type="submit" disabled={saving} className="w-full rounded-lg py-2.5 text-sm font-medium text-white disabled:opacity-50" style={{ background: "#2E6FD9" }}>
            {saving ? "Salvando..." : "Salvar alterações"}
          </button>
        </form>
      </div>
    </div>
  );
}

function NewUserModal({ onClose, onCreated }) {
  const [name, setName] = useState("");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [role, setRole] = useState("operator");
  const [color, setColor] = useState(COLORS[0]);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    setError("");
    setSaving(true);
    try {
      await api.post("/users", { name, username, password, role, color });
      onCreated();
    } catch (err) {
      setError(err.response?.data?.error || "Não foi possível criar o usuário.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50" onClick={onClose}>
      <div className="bg-white rounded-xl w-[360px] p-5" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-slate-800 font-semibold text-base">Novo usuário</h3>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600"><X size={18} /></button>
        </div>
        <form onSubmit={submit}>
          <label className="text-xs font-medium text-slate-500 mb-1 block">Nome completo</label>
          <input value={name} onChange={(e) => setName(e.target.value)} className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm mb-3 focus:outline-none focus:ring-2 focus:ring-[#2E6FD9]" required />

          <label className="text-xs font-medium text-slate-500 mb-1 block">Usuário de login</label>
          <input value={username} onChange={(e) => setUsername(e.target.value)} className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm mb-3 focus:outline-none focus:ring-2 focus:ring-[#2E6FD9]" required placeholder="ex: joana" />

          <label className="text-xs font-medium text-slate-500 mb-1 block">Senha inicial</label>
          <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm mb-3 focus:outline-none focus:ring-2 focus:ring-[#2E6FD9]" required minLength={6} />

          <label className="text-xs font-medium text-slate-500 mb-1 block">Cargo</label>
          <div className="flex gap-2 mb-3">
            <button type="button" onClick={() => setRole("operator")} className={`flex-1 text-sm rounded-lg py-2 border ${role === "operator" ? "border-[#2E6FD9] text-[#2E6FD9] bg-[#EFEAE2]" : "border-slate-200 text-slate-500"}`}>Operador</button>
            <button type="button" onClick={() => setRole("admin")} className={`flex-1 text-sm rounded-lg py-2 border ${role === "admin" ? "border-[#2E6FD9] text-[#2E6FD9] bg-[#EFEAE2]" : "border-slate-200 text-slate-500"}`}>ADM</button>
          </div>

          <label className="text-xs font-medium text-slate-500 mb-1.5 block">Cor</label>
          <div className="flex gap-2 mb-4">
            {COLORS.map((c) => (
              <button key={c} type="button" onClick={() => setColor(c)} className="w-7 h-7 rounded-full" style={{ background: c, outline: color === c ? "2px solid #1E293B" : "none", outlineOffset: 2 }} />
            ))}
          </div>

          {error && <div className="text-red-500 text-xs mb-3">{error}</div>}

          <button type="submit" disabled={saving} className="w-full rounded-lg py-2.5 text-sm font-medium text-white disabled:opacity-50" style={{ background: "#2E6FD9" }}>
            {saving ? "Criando..." : "Criar usuário"}
          </button>
        </form>
      </div>
    </div>
  );
}

function ResetPasswordModal({ user, onClose }) {
  const [newPassword, setNewPassword] = useState("");
  const [saving, setSaving] = useState(false);
  const [done, setDone] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    setSaving(true);
    await api.patch(`/users/${user.id}/reset-password`, { newPassword });
    setSaving(false);
    setDone(true);
  };

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50" onClick={onClose}>
      <div className="bg-white rounded-xl w-[340px] p-5" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-slate-800 font-semibold text-base">Nova senha para {user.name.split(" ")[0]}</h3>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600"><X size={18} /></button>
        </div>
        {done ? (
          <div className="text-emerald-600 text-sm">Senha atualizada. Avise a pessoa da nova senha.</div>
        ) : (
          <form onSubmit={submit}>
            <label className="text-xs font-medium text-slate-500 mb-1 block">Nova senha</label>
            <input type="password" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm mb-4 focus:outline-none focus:ring-2 focus:ring-[#2E6FD9]" required minLength={6} />
            <button type="submit" disabled={saving} className="w-full rounded-lg py-2.5 text-sm font-medium text-white disabled:opacity-50" style={{ background: "#2E6FD9" }}>
              {saving ? "Salvando..." : "Definir nova senha"}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
