import React, { useEffect, useState } from "react";
import { ArrowLeft, Plus, X, MessageSquareText, Search } from "lucide-react";
import { api } from "../api";

export default function Feedbacks({ onBack }) {
  const [feedbacks, setFeedbacks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [busca, setBusca] = useState("");
  const [showNew, setShowNew] = useState(false);

  const load = () => {
    setLoading(true);
    api.get("/feedbacks").then(({ data }) => {
      setFeedbacks(data.feedbacks);
      setLoading(false);
    });
  };

  useEffect(() => { load(); }, []);

  const filtrados = feedbacks.filter(
    (f) =>
      f.user_name.toLowerCase().includes(busca.trim().toLowerCase()) ||
      f.title.toLowerCase().includes(busca.trim().toLowerCase())
  );

  return (
    <div className="flex-1 flex flex-col" style={{ background: "#EFEAE2" }}>
      <div className="h-16 flex items-center gap-3 px-4 border-b border-[#D1D7DB] bg-white shrink-0">
        <button onClick={onBack} className="text-slate-500 hover:text-slate-700">
          <ArrowLeft size={20} />
        </button>
        <div className="text-slate-800 text-sm font-semibold flex-1">Feedbacks</div>
        <button
          onClick={() => setShowNew(true)}
          className="flex items-center gap-1.5 text-white text-[13px] font-medium px-3 py-1.5 rounded-lg"
          style={{ background: "#2563EB" }}
        >
          <Plus size={15} /> Novo feedback
        </button>
      </div>

      <div className="px-4 py-3 bg-white border-b border-[#D1D7DB]">
        <div className="relative max-w-sm">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
            placeholder="Buscar por pessoa ou título..."
            className="w-full border border-slate-200 rounded-lg pl-9 pr-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#2563EB]"
          />
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-4">
        {loading ? (
          <p className="text-sm text-slate-400">Carregando...</p>
        ) : filtrados.length === 0 ? (
          <div className="text-center py-16">
            <MessageSquareText size={32} className="mx-auto text-slate-300 mb-2" />
            <p className="text-sm text-slate-400">Nenhum feedback registrado ainda.</p>
          </div>
        ) : (
          <div className="max-w-2xl mx-auto flex flex-col gap-3">
            {filtrados.map((f) => (
              <div key={f.id} className="bg-white rounded-xl border border-slate-200 p-4">
                <div className="flex items-center gap-2.5 mb-2">
                  <div
                    className="w-8 h-8 rounded-full flex items-center justify-center text-white text-[11px] font-semibold shrink-0 overflow-hidden"
                    style={{ background: "#2563EB" }}
                  >
                    {f.user_name.split(" ").map((p) => p[0]).slice(0, 2).join("").toUpperCase()}
                  </div>
                  <div>
                    <div className="text-[13.5px] font-semibold text-slate-800">{f.user_name}</div>
                    <div className="text-[11px] text-slate-400">
                      por {f.created_by_name} · {new Date(f.created_at).toLocaleDateString("pt-BR")}
                    </div>
                  </div>
                </div>
                <div className="text-[13.5px] font-medium text-slate-700">{f.title}</div>
                <div className="text-[13px] text-slate-600 whitespace-pre-wrap mt-1">{f.content}</div>
              </div>
            ))}
          </div>
        )}
      </div>

      {showNew && (
        <NewFeedbackModal onClose={() => setShowNew(false)} onSaved={() => { setShowNew(false); load(); }} />
      )}
    </div>
  );
}

function NewFeedbackModal({ onClose, onSaved }) {
  const [users, setUsers] = useState([]);
  const [userId, setUserId] = useState("");
  const [filtroPessoa, setFiltroPessoa] = useState("");
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    api.get("/users/manage").then(({ data }) => setUsers(data.users));
  }, []);

  const pessoasFiltradas = users.filter((u) => u.name.toLowerCase().includes(filtroPessoa.toLowerCase()));
  const pessoaEscolhida = users.find((u) => u.id === Number(userId));

  const submit = async (e) => {
    e.preventDefault();
    if (!userId) { setError("Escolha a pessoa que vai receber o feedback."); return; }
    setError("");
    setSaving(true);
    try {
      await api.post("/feedbacks", { userId: Number(userId), title, content });
      onSaved();
    } catch (err) {
      setError(err.response?.data?.error || "Não deu pra registrar o feedback.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50" onClick={onClose}>
      <div className="bg-white rounded-xl w-[420px] max-h-[85vh] overflow-y-auto p-5" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-slate-800 font-semibold text-base">Novo feedback</h3>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600"><X size={18} /></button>
        </div>

        <form onSubmit={submit}>
          <label className="text-xs font-medium text-slate-500 mb-1 block">Pra quem é esse feedback</label>
          {pessoaEscolhida ? (
            <div className="flex items-center justify-between border border-slate-200 rounded-lg px-3 py-2 text-sm mb-3">
              <span>{pessoaEscolhida.name}</span>
              <button type="button" onClick={() => setUserId("")} className="text-slate-400 hover:text-slate-600">
                <X size={14} />
              </button>
            </div>
          ) : (
            <>
              <input
                value={filtroPessoa}
                onChange={(e) => setFiltroPessoa(e.target.value)}
                placeholder="Buscar pessoa..."
                className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm mb-1 focus:outline-none focus:ring-2 focus:ring-[#2563EB]"
              />
              <div className="max-h-32 overflow-y-auto border border-slate-100 rounded-lg mb-3 divide-y divide-slate-50">
                {pessoasFiltradas.slice(0, 20).map((u) => (
                  <button
                    key={u.id}
                    type="button"
                    onClick={() => { setUserId(String(u.id)); setFiltroPessoa(""); }}
                    className="w-full text-left px-3 py-1.5 text-sm hover:bg-slate-50"
                  >
                    {u.name}
                  </button>
                ))}
              </div>
            </>
          )}

          <label className="text-xs font-medium text-slate-500 mb-1 block">Título</label>
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Ex: Feedback sobre atendimento"
            className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm mb-3 focus:outline-none focus:ring-2 focus:ring-[#2563EB]"
            required
          />

          <label className="text-xs font-medium text-slate-500 mb-1 block">Resumo / observações</label>
          <textarea
            value={content}
            onChange={(e) => setContent(e.target.value)}
            placeholder="Escreva aqui o resumo da conversa, pontos combinados, etc."
            rows={5}
            className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm mb-4 resize-none focus:outline-none focus:ring-2 focus:ring-[#2563EB]"
            required
          />

          {error && <div className="text-red-500 text-xs mb-3">{error}</div>}

          <button
            type="submit"
            disabled={saving}
            className="w-full rounded-lg py-2.5 text-sm font-medium text-white disabled:opacity-50"
            style={{ background: "#2563EB" }}
          >
            {saving ? "Salvando..." : "Registrar feedback"}
          </button>
        </form>
      </div>
    </div>
  );
}
