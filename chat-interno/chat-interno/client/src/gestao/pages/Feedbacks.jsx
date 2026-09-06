// client/src/gestao/pages/Feedbacks.jsx
import { useEffect, useState } from 'react';
import { MessageSquareText, Plus, X, Search, Paperclip, Check, ChevronDown, ChevronRight } from 'lucide-react';
import PageHeader from '../PageHeader';
import { api, fileUrl } from '../../api';

const NAVY = '#2563EB';

export default function Feedbacks() {
  const [aba, setAba] = useState('lista'); // 'lista' | 'ranking'
  const [feedbacks, setFeedbacks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [busca, setBusca] = useState('');
  const [filtroStatus, setFiltroStatus] = useState('todos'); // 'todos' | 'assinados' | 'pendentes'
  const [showForm, setShowForm] = useState(false);
  const [abertoId, setAbertoId] = useState(null);

  const load = () => {
    setLoading(true);
    api.get('/feedbacks').then(({ data }) => {
      setFeedbacks(data.feedbacks);
      setLoading(false);
    });
  };

  useEffect(() => { load(); }, []);

  // "Assinado" = todo mundo que recebeu já confirmou; "Pendente" = falta pelo
  // menos uma pessoa confirmar ainda.
  const estaAssinado = (f) => f.recipients.length > 0 && f.recipients.every((r) => r.acknowledgedAt);

  const contagem = {
    todos: feedbacks.length,
    assinados: feedbacks.filter(estaAssinado).length,
    pendentes: feedbacks.filter((f) => !estaAssinado(f)).length,
  };

  const filtrados = feedbacks.filter((f) => {
    if (filtroStatus === 'assinados' && !estaAssinado(f)) return false;
    if (filtroStatus === 'pendentes' && estaAssinado(f)) return false;

    const alvo = busca.trim().toLowerCase();
    if (!alvo) return true;
    return (
      f.title.toLowerCase().includes(alvo) ||
      f.content.toLowerCase().includes(alvo) ||
      f.created_by_name.toLowerCase().includes(alvo) ||
      f.recipients.some((r) => r.name.toLowerCase().includes(alvo))
    );
  });

  return (
    <div className="flex-1 flex flex-col overflow-hidden">
      <PageHeader icon={MessageSquareText} title="Feedbacks" subtitle="Registre e acompanhe feedbacks dados à equipe" />

      <div className="px-6 py-3 bg-white border-b flex items-center gap-3" style={{ borderColor: 'var(--pagina-borda)' }}>
        <div className="relative flex-1 max-w-sm">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
            placeholder="Buscar por pessoa ou texto do feedback..."
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

      <div className="px-6 pt-3 bg-white border-b flex items-center gap-2" style={{ borderColor: 'var(--pagina-borda)' }}>
        <button
          onClick={() => setAba('lista')}
          className="text-[11.5px] font-semibold rounded-full px-3 py-1.5 mb-3"
          style={{ background: aba === 'lista' ? '#081328' : 'var(--pagina-borda-suave)', color: aba === 'lista' ? 'var(--pagina-cartao)' : '#64748B' }}
        >
          Feedbacks
        </button>
        <button
          onClick={() => setAba('ranking')}
          className="text-[11.5px] font-semibold rounded-full px-3 py-1.5 mb-3"
          style={{ background: aba === 'ranking' ? '#081328' : 'var(--pagina-borda-suave)', color: aba === 'ranking' ? 'var(--pagina-cartao)' : '#64748B' }}
        >
          Ranking
        </button>
      </div>

      {aba === 'ranking' ? (
        <RankingFeedbacks />
      ) : (
      <>
      <div className="px-6 pt-3 bg-white border-b flex items-center gap-2" style={{ borderColor: 'var(--pagina-borda)' }}>
        {[
          { key: 'todos', label: `Todos (${contagem.todos})`, corBg: '#081328', corTexto: 'var(--pagina-cartao)' },
          { key: 'assinados', label: `Assinados (${contagem.assinados})`, corBg: '#F0FDF4', corTexto: '#16A34A' },
          { key: 'pendentes', label: `Pendentes (${contagem.pendentes})`, corBg: '#FEF2F2', corTexto: '#DC2626' },
        ].map((op) => (
          <button
            key={op.key}
            onClick={() => setFiltroStatus(op.key)}
            className="text-[11.5px] font-semibold rounded-full px-3 py-1.5 mb-3"
            style={{
              background: filtroStatus === op.key ? op.corBg : 'var(--pagina-borda-suave)',
              color: filtroStatus === op.key ? op.corTexto : '#64748B',
            }}
          >
            {op.label}
          </button>
        ))}
      </div>

      <div className="flex-1 overflow-y-auto p-6" style={{ background: 'var(--pagina-fundo)' }}>
        {loading ? (
          <p className="text-sm text-slate-400">Carregando...</p>
        ) : filtrados.length === 0 ? (
          <div className="text-center py-16">
            <MessageSquareText size={32} className="mx-auto text-slate-300 mb-2" />
            <p className="text-sm text-slate-400">Nenhum feedback encontrado.</p>
          </div>
        ) : (
          <div className="max-w-2xl mx-auto flex flex-col gap-3">
            {filtrados.map((f) => {
              const aberto = abertoId === f.id;
              const resumoPessoas = f.recipients.length === 1
                ? f.recipients[0].name
                : `${f.recipients[0]?.name || ''} + ${f.recipients.length - 1} pessoa${f.recipients.length - 1 > 1 ? 's' : ''}`;
              return (
              <div key={f.id} className="bg-white rounded-xl border overflow-hidden" style={{ borderColor: 'var(--pagina-borda)' }}>
                <button
                  onClick={() => setAbertoId(aberto ? null : f.id)}
                  className="w-full flex items-center gap-3 p-4 text-left"
                >
                  {aberto ? <ChevronDown size={15} className="text-slate-400 shrink-0" /> : <ChevronRight size={15} className="text-slate-400 shrink-0" />}
                  <div className="min-w-0 flex-1">
                    <div className="text-[13.5px] font-semibold text-slate-800 truncate">{f.title}</div>
                    <div className="text-[11.5px] text-slate-500 truncate">{resumoPessoas}</div>
                  </div>
                  <span
                    className="text-[10px] font-bold rounded-full px-2 py-0.5 shrink-0"
                    style={estaAssinado(f) ? { background: '#F0FDF4', color: '#16A34A' } : { background: '#FEF2F2', color: '#DC2626' }}
                  >
                    {estaAssinado(f) ? 'Assinado' : 'Pendente'}
                  </span>
                </button>

                {aberto && (
                <div className="px-4 pb-4 pt-0.5 border-t" style={{ borderColor: 'var(--pagina-borda-suave)' }}>
                <div className="flex flex-wrap gap-x-4 gap-y-0.5 text-[11.5px] text-slate-500 mb-2 mt-3">
                  <span><b className="text-slate-500 font-semibold">Aplicador:</b> {f.created_by_name}</span>
                  <span className="text-slate-300">·</span>
                  <span>{new Date(f.created_at).toLocaleDateString('pt-BR')}</span>
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

                <div className="mt-3 pt-3 border-t" style={{ borderColor: 'var(--pagina-borda-suave)' }}>
                  <div className="text-[10.5px] font-semibold text-slate-400 uppercase tracking-wide mb-1.5">
                    Operador{f.recipients.length > 1 ? "es" : ""}
                  </div>
                  <div className="flex flex-wrap gap-2">
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
                </div>
                )}
              </div>
              );
            })}
          </div>
        )}
      </div>

      {showForm && (
        <NewFeedbackModal onClose={() => setShowForm(false)} onSaved={() => { setShowForm(false); load(); }} />
      )}
      </>
      )}
    </div>
  );
}

function NewFeedbackModal({ onClose, onSaved }) {
  const [etapa, setEtapa] = useState('form'); // 'form' | 'perguntar' | 'agendar'
  const [feedbackCriadoId, setFeedbackCriadoId] = useState(null);
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
      const { data } = await api.post('/feedbacks', form, { headers: { 'Content-Type': 'multipart/form-data' } });
      setFeedbackCriadoId(data.feedbackId);
      setEtapa('perguntar');
    } catch (err) {
      setError(err.response?.data?.error || 'Não deu pra registrar o feedback.');
    } finally {
      setSaving(false);
    }
  };

  if (etapa === 'perguntar') {
    return (
      <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
        <div className="bg-white rounded-xl w-[360px] p-5 text-center">
          <h3 className="text-slate-800 font-semibold text-base mb-2">Feedback registrado!</h3>
          <p className="text-[13.5px] text-slate-600 mb-5">Cadastrar novo feedback?</p>
          <div className="flex gap-2">
            <button onClick={onSaved} className="flex-1 rounded-lg py-2.5 text-sm font-medium border border-slate-200 text-slate-600">Não</button>
            <button onClick={() => setEtapa('agendar')} className="flex-1 rounded-lg py-2.5 text-sm font-semibold text-white" style={{ background: NAVY }}>Sim</button>
          </div>
        </div>
      </div>
    );
  }

  if (etapa === 'agendar') {
    return (
      <AgendarProximoModal
        feedbackAnteriorId={feedbackCriadoId}
        colaboradores={pessoasEscolhidas}
        onClose={onSaved}
        onSaved={onSaved}
      />
    );
  }

  return (
    // Sem fechar ao clicar fora: só pelo X ou registrando o feedback — pra não
    // perder tudo que já foi escrito com um clique sem querer.
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
      <div className="bg-white rounded-xl w-[440px] max-h-[85vh] overflow-y-auto p-5">
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

function AgendarProximoModal({ feedbackAnteriorId, colaboradores, onClose, onSaved }) {
  const [colaboradorId, setColaboradorId] = useState(colaboradores[0]?.id || null);
  const [users, setUsers] = useState([]);
  const [responsavelId, setResponsavelId] = useState(null);
  const [dataPrevista, setDataPrevista] = useState('');
  const [motivo, setMotivo] = useState('');
  const [observacao, setObservacao] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    api.get('/users/manage').then(({ data }) => {
      setUsers(data.users);
      const admins = data.users.filter((u) => u.role === 'admin');
      if (admins[0]) setResponsavelId(admins[0].id);
    });
  }, []);

  const submit = async (e) => {
    e.preventDefault();
    if (!colaboradorId || !responsavelId || !dataPrevista || !motivo.trim()) {
      setError('Preencha colaborador, responsável, data e motivo.');
      return;
    }
    setError('');
    setSaving(true);
    try {
      await api.post('/feedbacks/agendar-proximo', {
        feedbackAnteriorId, colaboradorId, responsavelId,
        dataPrevista: new Date(dataPrevista).toISOString(),
        motivo, observacao,
      });
      onSaved();
    } catch (err) {
      setError(err.response?.data?.error || 'Não deu pra agendar o próximo feedback.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
      <div className="bg-white rounded-xl w-[400px] p-5" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-slate-800 font-semibold text-base">Agendar próximo feedback</h3>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600"><X size={18} /></button>
        </div>
        <form onSubmit={submit}>
          <label className="text-xs font-medium text-slate-500 mb-1 block">Colaborador</label>
          <select value={colaboradorId || ''} onChange={(e) => setColaboradorId(Number(e.target.value))} className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm mb-3">
            {colaboradores.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>

          <label className="text-xs font-medium text-slate-500 mb-1 block">Responsável por aplicar</label>
          <select value={responsavelId || ''} onChange={(e) => setResponsavelId(Number(e.target.value))} className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm mb-3">
            {users.map((u) => <option key={u.id} value={u.id}>{u.name}</option>)}
          </select>

          <label className="text-xs font-medium text-slate-500 mb-1 block">Data prevista</label>
          <input type="datetime-local" value={dataPrevista} onChange={(e) => setDataPrevista(e.target.value)} className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm mb-3" required />

          <label className="text-xs font-medium text-slate-500 mb-1 block">Motivo/assunto</label>
          <input value={motivo} onChange={(e) => setMotivo(e.target.value)} className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm mb-3" required />

          <label className="text-xs font-medium text-slate-500 mb-1 block">Observação (opcional)</label>
          <textarea value={observacao} onChange={(e) => setObservacao(e.target.value)} rows={3} className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm mb-3 resize-none" />

          <p className="text-[11px] text-slate-400 mb-3">Isso vai criar uma tarefa automaticamente na rotina do responsável, com a data marcada.</p>

          {error && <div className="text-red-500 text-xs mb-3">{error}</div>}

          <button type="submit" disabled={saving} className="w-full rounded-lg py-2.5 text-sm font-medium text-white disabled:opacity-40" style={{ background: NAVY }}>
            {saving ? 'Salvando...' : 'Agendar'}
          </button>
        </form>
      </div>
    </div>
  );
}

function RankingFeedbacks() {
  const [ranking, setRanking] = useState(null);
  const [periodo, setPeriodo] = useState('30'); // dias, ou 'tudo'

  useEffect(() => {
    const params = {};
    if (periodo !== 'tudo') {
      const ate = new Date();
      const de = new Date();
      de.setDate(de.getDate() - Number(periodo));
      params.de = de.toISOString().slice(0, 10);
      params.ate = ate.toISOString().slice(0, 10);
    }
    api.get('/feedbacks/ranking', { params }).then(({ data }) => setRanking(data.ranking));
  }, [periodo]);

  return (
    <div className="flex-1 overflow-y-auto p-6" style={{ background: 'var(--pagina-fundo)' }}>
      <div className="max-w-xl mx-auto">
        <div className="flex items-center justify-between mb-4">
          <div className="text-[13px] font-semibold text-slate-700">Quem mais recebeu feedback</div>
          <select value={periodo} onChange={(e) => setPeriodo(e.target.value)} className="border border-slate-200 rounded-lg px-2.5 py-1.5 text-[12.5px]">
            <option value="7">Últimos 7 dias</option>
            <option value="30">Últimos 30 dias</option>
            <option value="90">Últimos 90 dias</option>
            <option value="tudo">Desde sempre</option>
          </select>
        </div>
        <p className="text-[11px] text-slate-400 mb-3">
          Filtro por supervisor/coordenador/equipe ainda não disponível — o sistema não tem esses papéis cadastrados hoje.
        </p>
        {ranking === null ? (
          <p className="text-sm text-slate-400">Carregando...</p>
        ) : ranking.length === 0 ? (
          <p className="text-sm text-slate-400">Nenhum feedback nesse período.</p>
        ) : (
          <div className="bg-white rounded-xl border overflow-hidden" style={{ borderColor: 'var(--pagina-borda)' }}>
            {ranking.map((r, i) => (
              <div key={r.id} className="flex items-center gap-3 px-4 py-2.5 border-b last:border-0" style={{ borderColor: 'var(--pagina-borda-suave)' }}>
                <span className="text-[12px] font-bold text-slate-400 w-5">{i + 1}º</span>
                <div className="w-7 h-7 rounded-full flex items-center justify-center text-white text-[10px] font-semibold overflow-hidden shrink-0" style={{ background: r.color || NAVY }}>
                  {r.avatar_url ? <img src={fileUrl(r.avatar_url)} alt="" className="w-full h-full object-cover" /> : r.name.split(' ').map((p) => p[0]).slice(0, 2).join('').toUpperCase()}
                </div>
                <span className="text-[13px] font-medium text-slate-700 flex-1">{r.name}</span>
                <span className="text-[13px] font-bold" style={{ color: NAVY }}>{r.total}</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
