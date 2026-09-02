// client/src/gestao/pages/Feedbacks.jsx
import { useEffect, useState } from 'react';
import { MessageSquareText, Plus, X, Search, Paperclip, Check } from 'lucide-react';
import PageHeader from '../PageHeader';
import { api, fileUrl } from '../../api';

const NAVY = '#2563EB';

export default function Feedbacks() {
  const [feedbacks, setFeedbacks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [busca, setBusca] = useState('');
  const [showForm, setShowForm] = useState(false);

  const load = () => {
    setLoading(true);
    api.get('/feedbacks').then(({ data }) => {
      setFeedbacks(data.feedbacks);
      setLoading(false);
    });
  };

  useEffect(() => { load(); }, []);

  const filtrados = feedbacks.filter((f) => {
    const alvo = busca.trim().toLowerCase();
    if (!alvo) return true;
    return f.title.toLowerCase().includes(alvo) || f.recipients.some((r) => r.name.toLowerCase().includes(alvo));
  });

  return (
    <div className="flex-1 flex flex-col overflow-hidden">
      <PageHeader icon={MessageSquareText} title="Feedbacks" subtitle="Registre e acompanhe feedbacks dados à equipe" />

      <div className="px-6 py-3 bg-white border-b flex items-center gap-3" style={{ borderColor: '#E4E8EE' }}>
        <div className="relative flex-1 max-w-sm">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
            placeholder="Buscar por pessoa ou título..."
            className="w-full border border-slate-200 rounded-lg pl-9 pr-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#2563EB]"
          />
        </div>
        <button
          onClick={() => setShowForm(true)}
          className="ml-auto flex items-center gap-1.5 text-white text-[13px] font-medium px-3 py-2 rounded-lg"
          style={{ background: NAVY }}
        >
          <Plus size={15} /> Novo feedback
        </button>
      </div>

      <div className="flex-1 overflow-y-auto p-6" style={{ background: '#F7F9FB' }}>
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
              <div key={f.id} className="bg-white rounded-xl border p-4" style={{ borderColor: '#E4E8EE' }}>
                <div className="flex items-center justify-between gap-3 mb-2">
                  <div className="text-[13.5px] font-semibold text-slate-800">{f.title}</div>
                  <div className="text-[11px] text-slate-400 shrink-0">
                    {f.created_by_name} · {new Date(f.created_at).toLocaleDateString('pt-BR')}
                  </div>
                </div>
                <div className="text-[13px] text-slate-600 whitespace-pre-wrap">{f.content}</div>
                {f.attachment_url && (
                  <a
                    href={fileUrl(f.attachment_url)}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-1 text-[12px] font-medium mt-2 underline"
                    style={{ color: NAVY }}
                  >
                    <Paperclip size={12} /> {f.attachment_name || 'Ver anexo'}
                  </a>
                )}

                <div className="flex flex-wrap gap-2 mt-3 pt-3 border-t" style={{ borderColor: '#F1F5F9' }}>
                  {f.recipients.map((r) => (
                    <span
                      key={r.userId}
                      className="flex items-center gap-1.5 text-[11px] font-medium rounded-full pl-1 pr-2.5 py-1"
                      style={
                        r.acknowledgedAt
                          ? { background: '#F0FDF4', color: '#16A34A' }
                          : { background: '#FEF2F2', color: '#DC2626' }
                      }
                    >
                      <span
                        className="w-4 h-4 rounded-full flex items-center justify-center text-white text-[8px] font-semibold overflow-hidden shrink-0"
                        style={{ background: NAVY }}
                      >
                        {r.avatarUrl ? (
                          <img src={fileUrl(r.avatarUrl)} alt={r.name} className="w-full h-full object-cover" />
                        ) : (
                          r.name.split(' ').map((p) => p[0]).slice(0, 2).join('').toUpperCase()
                        )}
                      </span>
                      {r.name} {r.acknowledgedAt ? <Check size={11} /> : '· Aguardando ciente'}
                    </span>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {showForm && (
        <NewFeedbackModal onClose={() => setShowForm(false)} onSaved={() => { setShowForm(false); load(); }} />
      )}
    </div>
  );
}

function NewFeedbackModal({ onClose, onSaved }) {
  const [users, setUsers] = useState([]);
  const [userIds, setUserIds] = useState([]);
  const [filtroPessoa, setFiltroPessoa] = useState('');
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [attachment, setAttachment] = useState(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    api.get('/users/manage').then(({ data }) => setUsers(data.users));
  }, []);

  const pessoasEscolhidas = users.filter((u) => userIds.includes(u.id));
  const pessoasFiltradas = users.filter(
    (u) => !userIds.includes(u.id) && u.name.toLowerCase().includes(filtroPessoa.toLowerCase())
  );

  const toggleAdd = (id) => setUserIds((prev) => [...prev, id]);
  const remover = (id) => setUserIds((prev) => prev.filter((x) => x !== id));

  const submit = async (e) => {
    e.preventDefault();
    if (userIds.length === 0) { setError('Marque pelo menos uma pessoa.'); return; }
    setError('');
    setSaving(true);
    try {
      const form = new FormData();
      form.append('title', title);
      form.append('content', content);
      form.append('userIds', JSON.stringify(userIds));
      if (attachment) form.append('attachment', attachment);
      await api.post('/feedbacks', form, { headers: { 'Content-Type': 'multipart/form-data' } });
      onSaved();
    } catch (err) {
      setError(err.response?.data?.error || 'Não deu pra registrar o feedback.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50" onClick={onClose}>
      <div className="bg-white rounded-xl w-[440px] max-h-[85vh] overflow-y-auto p-5" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-slate-800 font-semibold text-base">Novo feedback</h3>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600"><X size={18} /></button>
        </div>

        <form onSubmit={submit}>
          <label className="text-xs font-medium text-slate-500 mb-1 block">
            Pra quem é esse feedback (pode marcar várias pessoas)
          </label>
          {pessoasEscolhidas.length > 0 && (
            <div className="flex flex-wrap gap-1.5 mb-2">
              {pessoasEscolhidas.map((u) => (
                <span key={u.id} className="flex items-center gap-1.5 text-[12px] font-medium rounded-full pl-2.5 pr-1.5 py-1" style={{ background: '#EFF4FF', color: NAVY }}>
                  {u.name}
                  <button type="button" onClick={() => remover(u.id)}><X size={12} /></button>
                </span>
              ))}
            </div>
          )}
          <input
            value={filtroPessoa}
            onChange={(e) => setFiltroPessoa(e.target.value)}
            placeholder="Buscar pessoa pra adicionar..."
            className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm mb-1 focus:outline-none focus:ring-2 focus:ring-[#2563EB]"
          />
          {filtroPessoa && (
            <div className="max-h-32 overflow-y-auto border border-slate-100 rounded-lg mb-3 divide-y divide-slate-50">
              {pessoasFiltradas.slice(0, 20).map((u) => (
                <button
                  key={u.id}
                  type="button"
                  onClick={() => { toggleAdd(u.id); setFiltroPessoa(''); }}
                  className="w-full text-left px-3 py-1.5 text-sm hover:bg-slate-50"
                >
                  {u.name}
                </button>
              ))}
              {pessoasFiltradas.length === 0 && (
                <div className="px-3 py-1.5 text-[12px] text-slate-400">Ninguém encontrado.</div>
              )}
            </div>
          )}
          {!filtroPessoa && <div className="mb-3" />}

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
            className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm mb-3 resize-none focus:outline-none focus:ring-2 focus:ring-[#2563EB]"
            required
          />

          <label className="text-xs font-medium text-slate-500 mb-1 block">Anexo (opcional)</label>
          {attachment ? (
            <div className="flex items-center justify-between border border-slate-200 rounded-lg px-3 py-2 text-sm mb-4">
              <span className="truncate flex items-center gap-1.5"><Paperclip size={13} /> {attachment.name}</span>
              <button type="button" onClick={() => setAttachment(null)} className="text-slate-400 hover:text-slate-600 shrink-0">
                <X size={14} />
              </button>
            </div>
          ) : (
            <label className="flex items-center gap-2 text-sm text-slate-500 border border-dashed border-slate-300 rounded-lg px-3 py-2 mb-4 cursor-pointer hover:bg-slate-50">
              <Paperclip size={15} /> Anexar arquivo
              <input type="file" className="hidden" onChange={(e) => setAttachment(e.target.files?.[0] || null)} />
            </label>
          )}

          {error && <div className="text-red-500 text-xs mb-3">{error}</div>}

          <button
            type="submit"
            disabled={saving}
            className="w-full rounded-lg py-2.5 text-sm font-medium text-white disabled:opacity-50"
            style={{ background: NAVY }}
          >
            {saving ? 'Salvando...' : `Registrar feedback${userIds.length > 1 ? ` (${userIds.length} pessoas)` : ''}`}
          </button>
        </form>
      </div>
    </div>
  );
}
