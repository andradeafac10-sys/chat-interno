import React, { useEffect, useState } from "react";
import { X, ShieldCheck, Search } from "lucide-react";
import { api } from "../api";
import { useAuth } from "../context/AuthContext";

export default function NewGroupModal({ onClose, onCreated }) {
  const { user: currentUser } = useAuth();
  const [operators, setOperators] = useState([]);
  const [name, setName] = useState("");
  const [memberIds, setMemberIds] = useState([]);
  const [saving, setSaving] = useState(false);
  const [memberFilter, setMemberFilter] = useState("");

  useEffect(() => {
    api.get("/users/manage").then(({ data }) => setOperators(data.users.filter((u) => u.id !== currentUser.id)));
  }, [currentUser.id]);

  const toggle = (id) =>
    setMemberIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));

  const filteredOperators = operators.filter((op) =>
    op.name.toLowerCase().includes(memberFilter.toLowerCase())
  );

  const create = async () => {
    if (!name.trim() || memberIds.length === 0) return;
    setSaving(true);
    try {
      const { data } = await api.post("/groups", { name: name.trim(), memberIds });
      onCreated(data.group);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50" onClick={onClose}>
      <div className="bg-white rounded-xl w-[360px] p-5" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-slate-800 font-semibold text-base">Criar novo grupo</h3>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600"><X size={18} /></button>
        </div>

        <label className="text-xs font-medium text-slate-500 mb-1 block">Nome do grupo</label>
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Ex: Equipe Carteira X"
          className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm mb-4 focus:outline-none focus:ring-2 focus:ring-[#2563EB]"
        />

        <div className="flex items-center justify-between mb-1.5">
          <label className="text-xs font-medium text-slate-500 block">Membros</label>
          <button
            type="button"
            onClick={() => {
              const idsVisiveis = filteredOperators.map((op) => op.id);
              const todosMarcados = idsVisiveis.length > 0 && idsVisiveis.every((id) => memberIds.includes(id));
              setMemberIds((prev) =>
                todosMarcados
                  ? prev.filter((id) => !idsVisiveis.includes(id)) // desmarca só os que estão sendo mostrados agora
                  : [...new Set([...prev, ...idsVisiveis])] // marca todos os que estão sendo mostrados agora
              );
            }}
            className="text-[11.5px] font-medium text-[#2563EB] hover:underline"
          >
            {filteredOperators.length > 0 && filteredOperators.every((op) => memberIds.includes(op.id))
              ? "Desmarcar todos"
              : "Marcar todos"}
          </button>
        </div>
        <div className="relative mb-2">
          <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            value={memberFilter}
            onChange={(e) => setMemberFilter(e.target.value)}
            placeholder="Buscar pessoa..."
            className="w-full border border-slate-200 rounded-lg pl-8 pr-3 py-1.5 text-[13px] focus:outline-none focus:ring-2 focus:ring-[#2563EB]"
          />
        </div>
        <div className="flex flex-col gap-1 mb-5 max-h-40 overflow-y-auto">
          {filteredOperators.map((op) => (
            <label key={op.id} className="flex items-center gap-2.5 px-2 py-1.5 rounded-lg hover:bg-slate-50 cursor-pointer">
              <input type="checkbox" checked={memberIds.includes(op.id)} onChange={() => toggle(op.id)} className="accent-[#2563EB]" />
              <div className="w-6 h-6 rounded-full flex items-center justify-center text-white text-[9px] font-semibold" style={{ background: op.color }}>
                {op.name.split(" ").map((p) => p[0]).slice(0, 2).join("").toUpperCase()}
              </div>
              <span className="text-sm text-slate-700 flex items-center gap-1">
                {op.name}
                {op.role === "admin" && <ShieldCheck size={12} className="text-[#2563EB]" />}
              </span>
            </label>
          ))}
          {filteredOperators.length === 0 && (
            <span className="text-xs text-slate-400">
              {operators.length === 0 ? "Nenhuma outra pessoa cadastrada ainda." : "Ninguém encontrado com esse nome."}
            </span>
          )}
        </div>

        <button
          onClick={create}
          disabled={!name.trim() || memberIds.length === 0 || saving}
          className="w-full rounded-lg py-2.5 text-sm font-medium text-white disabled:opacity-40"
          style={{ background: "#2563EB" }}
        >
          {saving ? "Criando..." : "Criar grupo"}
        </button>
      </div>
    </div>
  );
}
