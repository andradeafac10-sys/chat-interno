// client/src/gestao/pages/Trilha.jsx
import { useEffect, useState } from 'react';
import { GraduationCap, Plus, X, Trash2, CheckCircle2, XCircle, Circle, PlayCircle, FileQuestion } from 'lucide-react';
import PageHeader from '../PageHeader';
import { api, fileUrl } from '../../api';

const NAVY = '#2563EB';

export default function Trilha() {
  const [aba, setAba] = useState('conteudo'); // 'conteudo' | 'acompanhamento'

  return (
    <div className="flex-1 flex flex-col overflow-hidden">
      <PageHeader icon={GraduationCap} title="Trilha do Conhecimento" subtitle="Treinamentos com vídeo e/ou avaliação" />

      <div className="px-6 pt-3 bg-white border-b flex items-center gap-2" style={{ borderColor: 'var(--pagina-borda)' }}>
        {[
          { key: 'conteudo', label: 'Conteúdo' },
          { key: 'acompanhamento', label: 'Acompanhamento' },
        ].map((op) => (
          <button
            key={op.key}
            onClick={() => setAba(op.key)}
            className="text-[12px] font-semibold rounded-full px-3.5 py-1.5 mb-3"
            style={{ background: aba === op.key ? NAVY : 'var(--pagina-borda-suave)', color: aba === op.key ? 'var(--pagina-cartao)' : '#64748B' }}
          >
            {op.label}
          </button>
        ))}
      </div>

      <div className="flex-1 overflow-y-auto p-6" style={{ background: 'var(--pagina-fundo)' }}>
        {aba === 'conteudo' ? <AbaConteudo /> : <AbaAcompanhamento />}
      </div>
    </div>
  );
}

function AbaConteudo() {
  const [modulos, setModulos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [moduloAberto, setModuloAberto] = useState(null);

  const load = () => {
    setLoading(true);
    api.get('/trilha/modulos').then(({ data }) => { setModulos(data.modulos); setLoading(false); });
  };
  useEffect(() => { load(); }, []);

  const apagarModulo = async (id) => {
    if (!confirm('Apagar esse treinamento (vídeo e prova)? Essa ação não tem volta.')) return;
    await api.delete(`/trilha/modulos/${id}`);
    load();
  };

  if (moduloAberto) {
    return <PerguntasModulo modulo={moduloAberto} onVoltar={() => { setModuloAberto(null); load(); }} />;
  }

  return (
    <div className="max-w-2xl mx-auto">
      <button
        onClick={() => setShowForm(true)}
        className="flex items-center gap-1.5 text-white text-[13px] font-medium px-3 py-2 rounded-lg mb-4"
        style={{ background: NAVY }}
      >
        <Plus size={15} /> NOVO TREINAMENTO
      </button>

      {loading ? (
        <p className="text-sm text-slate-400">Carregando...</p>
      ) : modulos.length === 0 ? (
        <p className="text-sm text-slate-400">Nenhum treinamento criado ainda.</p>
      ) : (
        <div className="flex flex-col gap-3">
          {modulos.map((m, i) => (
            <div key={m.id} className="bg-white rounded-xl border p-4" style={{ borderColor: 'var(--pagina-borda)' }}>
              <div className="flex items-start justify-between gap-3">
                <div>
                  <div className="text-[11px] font-semibold text-slate-400 flex items-center gap-1.5">
                    {m.tipo === 'avaliacao' ? <FileQuestion size={12} /> : <PlayCircle size={12} />}
                    TREINAMENTO {i + 1} · {m.tipo === 'avaliacao' ? 'AVALIAÇÃO' : 'VÍDEO'}
                  </div>
                  <div className="text-[14px] font-semibold text-slate-800">{m.title}</div>
                  {m.description && <div className="text-[12.5px] text-slate-500 mt-0.5">{m.description}</div>}
                  <div className="text-[11.5px] text-slate-400 mt-1">{m.total_perguntas} pergunta(s) na prova</div>
                </div>
                <button onClick={() => apagarModulo(m.id)} className="text-slate-400 hover:text-red-500 shrink-0">
                  <Trash2 size={15} />
                </button>
              </div>
              {m.tipo === 'video' && m.video_url && (
                <video src={fileUrl(m.video_url)} controls className="w-full rounded-lg mt-3 max-h-52 bg-black" />
              )}
              <button
                onClick={() => setModuloAberto(m)}
                className="mt-3 text-[12.5px] font-medium"
                style={{ color: NAVY }}
              >
                Gerenciar perguntas da prova →
              </button>
            </div>
          ))}
        </div>
      )}

      {showForm && <NovoModuloModal onClose={() => setShowForm(false)} onSaved={() => { setShowForm(false); load(); }} />}
    </div>
  );
}

function PerguntaBuilder({ pergunta, onChange, onRemover, indice }) {
  const atualizarPergunta = (texto) => onChange({ ...pergunta, question: texto });
  const atualizarOpcaoTexto = (oi, texto) => onChange({ ...pergunta, opcoes: pergunta.opcoes.map((o, j) => (j === oi ? { ...o, text: texto } : o)) });
  const marcarCorreta = (oi) => onChange({ ...pergunta, opcoes: pergunta.opcoes.map((o, j) => ({ ...o, isCorrect: j === oi })) });

  return (
    <div className="border border-slate-200 rounded-lg p-3">
      <div className="flex items-center gap-2 mb-2">
        <input
          value={pergunta.question}
          onChange={(e) => atualizarPergunta(e.target.value)}
          placeholder={`Pergunta ${indice + 1}`}
          className="flex-1 border border-slate-200 rounded-lg px-2.5 py-1.5 text-[13px] focus:outline-none focus:ring-2 focus:ring-[#2563EB]"
        />
        <button type="button" onClick={onRemover} className="text-slate-400 hover:text-red-500 shrink-0"><Trash2 size={14} /></button>
      </div>
      <p className="text-[10.5px] text-slate-400 mb-1.5 ml-1">Exatamente 4 alternativas — marque a certa</p>
      <div className="flex flex-col gap-1.5 pl-1">
        {pergunta.opcoes.map((o, oi) => (
          <div key={oi} className="flex items-center gap-2">
            <span className="text-[11px] font-semibold text-slate-400 w-4 shrink-0">{String.fromCharCode(65 + oi)}</span>
            <input type="radio" checked={o.isCorrect} onChange={() => marcarCorreta(oi)} className="accent-[#2563EB] shrink-0" />
            <input
              value={o.text}
              onChange={(e) => atualizarOpcaoTexto(oi, e.target.value)}
              placeholder={`Alternativa ${String.fromCharCode(65 + oi)}`}
              className="flex-1 border border-slate-200 rounded-lg px-2.5 py-1.5 text-[12.5px] focus:outline-none focus:ring-2 focus:ring-[#2563EB]"
            />
          </div>
        ))}
      </div>
    </div>
  );
}

function novaPerguntaVazia() {
  return { question: '', opcoes: [{ text: '', isCorrect: true }, { text: '', isCorrect: false }, { text: '', isCorrect: false }, { text: '', isCorrect: false }] };
}

function NovoModuloModal({ onClose, onSaved }) {
  const [tipo, setTipo] = useState('video'); // 'video' | 'avaliacao'
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [video, setVideo] = useState(null);
  const [saving, setSaving] = useState(false);
  const [progresso, setProgresso] = useState(0);
  const [error, setError] = useState('');

  // Destinatários: se ninguém for marcado, o treinamento fica aberto pra todo mundo
  const [users, setUsers] = useState([]);
  const [userIds, setUserIds] = useState([]);
  const [filtroPessoa, setFiltroPessoa] = useState('');

  const [perguntas, setPerguntas] = useState([]);

  useEffect(() => {
    api.get('/users/manage').then(({ data }) => setUsers(data.users));
  }, []);

  const pessoasEscolhidas = users.filter((u) => userIds.includes(u.id));
  const pessoasFiltradas = users.filter(
    (u) => !userIds.includes(u.id) && u.name.toLowerCase().includes(filtroPessoa.toLowerCase())
  );

  const marcarTodos = () => setUserIds(users.map((u) => u.id));

  const adicionarPergunta = () => {
    if (perguntas.length >= 6) return; // no máximo 6 perguntas por treinamento
    setPerguntas((prev) => [...prev, novaPerguntaVazia()]);
  };
  const removerPergunta = (i) => setPerguntas((prev) => prev.filter((_, idx) => idx !== i));
  const atualizarPergunta = (i, nova) => setPerguntas((prev) => prev.map((p, idx) => (idx === i ? nova : p)));

  const submit = async (e) => {
    e.preventDefault();
    if (tipo === 'video' && !video) { setError('Escolha o arquivo de vídeo (ou mude o tipo pra Avaliação).'); return; }
    for (const p of perguntas) {
      if (!p.question.trim() || p.opcoes.some((o) => !o.text.trim())) {
        setError('Preencha o texto de todas as perguntas e das 4 alternativas.');
        return;
      }
    }
    setError('');
    setSaving(true);
    try {
      const form = new FormData();
      form.append('title', title);
      form.append('description', description);
      form.append('tipo', tipo);
      if (video) form.append('video', video);
      form.append('userIds', JSON.stringify(userIds));
      form.append('perguntas', JSON.stringify(perguntas));
      await api.post('/trilha/modulos', form, {
        headers: { 'Content-Type': 'multipart/form-data' },
        timeout: 0, // vídeo grande demora — sem isso, herdava o limite de 15s do resto do sistema
        onUploadProgress: (evt) => setProgresso(Math.round((evt.loaded * 100) / (evt.total || 1))),
      });
      onSaved();
    } catch (err) {
      setError(err.response?.data?.error || 'Não deu pra criar o treinamento. Vídeos muito grandes podem falhar — tente um arquivo menor.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
      <div className="bg-white rounded-xl w-[480px] max-h-[85vh] overflow-y-auto p-5" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-slate-800 font-semibold text-base">NOVO TREINAMENTO</h3>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600"><X size={18} /></button>
        </div>
        <form onSubmit={submit}>
          <label className="text-xs font-medium text-slate-500 mb-1.5 block">Tipo de treinamento</label>
          <div className="flex gap-2 mb-4">
            <button
              type="button"
              onClick={() => setTipo('video')}
              className="flex-1 flex items-center justify-center gap-1.5 text-[12.5px] font-medium rounded-lg py-2 border"
              style={tipo === 'video' ? { background: '#EFF4FF', borderColor: NAVY, color: NAVY } : { borderColor: '#E2E8F0', color: '#64748B' }}
            >
              <PlayCircle size={14} /> Vídeo
            </button>
            <button
              type="button"
              onClick={() => setTipo('avaliacao')}
              className="flex-1 flex items-center justify-center gap-1.5 text-[12.5px] font-medium rounded-lg py-2 border"
              style={tipo === 'avaliacao' ? { background: '#EFF4FF', borderColor: NAVY, color: NAVY } : { borderColor: '#E2E8F0', color: '#64748B' }}
            >
              <FileQuestion size={14} /> Avaliação/Prova
            </button>
          </div>

          <label className="text-xs font-medium text-slate-500 mb-1 block">Título</label>
          <input value={title} onChange={(e) => setTitle(e.target.value)} className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm mb-3 focus:outline-none focus:ring-2 focus:ring-[#2563EB]" required />

          <label className="text-xs font-medium text-slate-500 mb-1 block">Descrição (opcional)</label>
          <textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={2} className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm mb-3 resize-none focus:outline-none focus:ring-2 focus:ring-[#2563EB]" />

          {tipo === 'video' && (
            <>
              <label className="text-xs font-medium text-slate-500 mb-1 block">Vídeo</label>
              <input type="file" accept="video/*" onChange={(e) => setVideo(e.target.files?.[0] || null)} className="w-full text-[13px] mb-1" required={tipo === 'video'} />
              <p className="text-[11px] text-slate-400 mb-4">Vídeos grandes podem demorar pra subir — não feche essa janela enquanto envia.</p>
            </>
          )}

          <div className="flex items-center justify-between mb-1">
            <label className="text-xs font-medium text-slate-500 block">
              Quem vai receber (em branco = todo mundo)
            </label>
            <button type="button" onClick={marcarTodos} className="text-[11.5px] font-medium" style={{ color: NAVY }}>Marcar todos</button>
          </div>
          {pessoasEscolhidas.length > 0 && (
            <div className="flex flex-wrap gap-1.5 mb-2">
              {pessoasEscolhidas.map((u) => (
                <span key={u.id} className="flex items-center gap-1.5 text-[12px] font-medium rounded-full pl-2.5 pr-1.5 py-1" style={{ background: '#EFF4FF', color: NAVY }}>
                  {u.name}
                  <button type="button" onClick={() => setUserIds((prev) => prev.filter((id) => id !== u.id))}><X size={12} /></button>
                </span>
              ))}
            </div>
          )}
          <input
            value={filtroPessoa}
            onChange={(e) => setFiltroPessoa(e.target.value)}
            placeholder="Buscar pessoa, equipe..."
            className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm mb-1 focus:outline-none focus:ring-2 focus:ring-[#2563EB]"
          />
          {filtroPessoa && (
            <div className="max-h-28 overflow-y-auto border border-slate-100 rounded-lg mb-4 divide-y divide-slate-50">
              {pessoasFiltradas.slice(0, 20).map((u) => (
                <button
                  key={u.id}
                  type="button"
                  onClick={() => { setUserIds((prev) => [...prev, u.id]); setFiltroPessoa(''); }}
                  className="w-full text-left px-3 py-1.5 text-sm hover:bg-slate-50"
                >
                  {u.name}
                </button>
              ))}
              {pessoasFiltradas.length === 0 && <div className="px-3 py-1.5 text-[12px] text-slate-400">Ninguém encontrado.</div>}
            </div>
          )}
          {!filtroPessoa && <div className="mb-4" />}

          <div className="flex items-center justify-between mb-1.5">
            <label className="text-xs font-medium text-slate-500 block">Perguntas da prova ({perguntas.length}/6, opcional, 4 alternativas cada)</label>
            <button
              type="button"
              onClick={adicionarPergunta}
              disabled={perguntas.length >= 6}
              className="text-[12px] font-medium disabled:opacity-40 disabled:cursor-not-allowed"
              style={{ color: NAVY }}
            >
              + Adicionar pergunta
            </button>
          </div>
          {perguntas.length >= 6 && (
            <p className="text-[11px] text-amber-600 mb-2">Máximo de 6 perguntas por treinamento já atingido.</p>
          )}
          {perguntas.length === 0 && (
            <p className="text-[11.5px] text-slate-400 mb-3">Sem pergunta cadastrada, o treinamento conclui direto.</p>
          )}
          <div className="flex flex-col gap-3 mb-2">
            {perguntas.map((p, pi) => (
              <PerguntaBuilder key={pi} pergunta={p} indice={pi} onChange={(nova) => atualizarPergunta(pi, nova)} onRemover={() => removerPergunta(pi)} />
            ))}
          </div>

          {saving && (
            <div className="w-full h-1.5 bg-slate-100 rounded-full my-3 overflow-hidden">
              <div className="h-full" style={{ width: `${progresso}%`, background: NAVY }} />
            </div>
          )}
          {error && <div className="text-red-500 text-xs mb-3 mt-2">{error}</div>}

          <button type="submit" disabled={saving} className="w-full rounded-lg py-2.5 text-sm font-medium text-white disabled:opacity-40 mt-2" style={{ background: NAVY }}>
            {saving ? `Enviando... ${progresso}%` : 'Criar treinamento'}
          </button>
        </form>
      </div>
    </div>
  );
}

function PerguntasModulo({ modulo, onVoltar }) {
  const [perguntas, setPerguntas] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);

  const load = () => {
    setLoading(true);
    api.get(`/trilha/modulos/${modulo.id}/perguntas-admin`).then(({ data }) => { setPerguntas(data.perguntas); setLoading(false); });
  };
  useEffect(() => { load(); }, []);

  const apagar = async (id) => {
    if (!confirm('Apagar essa pergunta?')) return;
    await api.delete(`/trilha/perguntas/${id}`);
    load();
  };

  return (
    <div className="max-w-2xl mx-auto">
      <button onClick={onVoltar} className="text-[12.5px] font-medium mb-4" style={{ color: NAVY }}>← Voltar pros treinamentos</button>
      <div className="text-[15px] font-semibold text-slate-800 mb-1">{modulo.title}</div>
      <div className="text-[12.5px] text-slate-500 mb-4">Perguntas da prova desse treinamento (25% cada, 4 alternativas)</div>

      <button
        onClick={() => setShowForm(true)}
        disabled={perguntas.length >= 6}
        className="flex items-center gap-1.5 text-white text-[13px] font-medium px-3 py-2 rounded-lg mb-1 disabled:opacity-40 disabled:cursor-not-allowed"
        style={{ background: NAVY }}
      >
        <Plus size={15} /> Nova pergunta ({perguntas.length}/6)
      </button>
      {perguntas.length >= 6 && (
        <p className="text-[11px] text-amber-600 mb-3">Máximo de 6 perguntas por treinamento já atingido.</p>
      )}

      {loading ? (
        <p className="text-sm text-slate-400">Carregando...</p>
      ) : perguntas.length === 0 ? (
        <p className="text-sm text-slate-400">Nenhuma pergunta cadastrada ainda — sem prova, o treinamento conclui direto.</p>
      ) : (
        <div className="flex flex-col gap-3">
          {perguntas.map((p, i) => (
            <div key={p.id} className="bg-white rounded-xl border p-4" style={{ borderColor: 'var(--pagina-borda)' }}>
              <div className="flex items-start justify-between gap-3 mb-2">
                <div className="text-[13.5px] font-medium text-slate-800">{i + 1}. {p.question}</div>
                <button onClick={() => apagar(p.id)} className="text-slate-400 hover:text-red-500 shrink-0"><Trash2 size={14} /></button>
              </div>
              <div className="flex flex-col gap-1">
                {p.opcoes.map((o, oi) => (
                  <div key={o.id} className="flex items-center gap-2 text-[12.5px]" style={{ color: o.is_correct ? '#16A34A' : '#475569' }}>
                    <span className="text-[10px] font-semibold text-slate-400 w-3">{String.fromCharCode(65 + oi)}</span>
                    {o.is_correct ? <CheckCircle2 size={13} /> : <Circle size={13} className="text-slate-300" />}
                    {o.text}
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      {showForm && <NovaPerguntaModal moduloId={modulo.id} onClose={() => setShowForm(false)} onSaved={() => { setShowForm(false); load(); }} />}
    </div>
  );
}

function NovaPerguntaModal({ moduloId, onClose, onSaved }) {
  const [pergunta, setPergunta] = useState(novaPerguntaVazia());
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const submit = async (e) => {
    e.preventDefault();
    if (!pergunta.question.trim() || pergunta.opcoes.some((o) => !o.text.trim())) {
      setError('Preencha a pergunta e as 4 alternativas.');
      return;
    }
    setError('');
    setSaving(true);
    try {
      await api.post(`/trilha/modulos/${moduloId}/perguntas`, pergunta);
      onSaved();
    } catch (err) {
      setError(err.response?.data?.error || 'Não deu pra salvar a pergunta.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
      <div className="bg-white rounded-xl w-[420px] max-h-[85vh] overflow-y-auto p-5" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-slate-800 font-semibold text-base">Nova pergunta</h3>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600"><X size={18} /></button>
        </div>
        <form onSubmit={submit}>
          <PerguntaBuilder pergunta={pergunta} indice={0} onChange={setPergunta} onRemover={onClose} />
          {error && <div className="text-red-500 text-xs mb-3 mt-3">{error}</div>}
          <button type="submit" disabled={saving} className="w-full rounded-lg py-2.5 text-sm font-medium text-white disabled:opacity-40 mt-3" style={{ background: NAVY }}>
            {saving ? 'Salvando...' : 'Salvar pergunta'}
          </button>
        </form>
      </div>
    </div>
  );
}

function AbaAcompanhamento() {
  const [dados, setDados] = useState(null);
  const [moduloSelecionado, setModuloSelecionado] = useState(null); // id ou null (visão geral)

  useEffect(() => {
    api.get('/trilha/admin/progresso').then(({ data }) => setDados(data));
  }, []);

  if (!dados) return <p className="text-sm text-slate-400">Carregando...</p>;
  if (dados.modulos.length === 0) return <p className="text-sm text-slate-400">Crie um treinamento primeiro pra ter o que acompanhar.</p>;

  if (moduloSelecionado) {
    const modulo = dados.modulos.find((m) => m.id === moduloSelecionado);
    const resumo = dados.resumoModulos.find((r) => r.moduloId === moduloSelecionado);
    const linhasDoModulo = dados.linhas
      .map((l) => ({ pessoa: l.pessoa, dado: l.modulos[dados.modulos.findIndex((m) => m.id === moduloSelecionado)] }))
      .filter((l) => l.dado !== null);

    return (
      <div className="max-w-3xl mx-auto">
        <button onClick={() => setModuloSelecionado(null)} className="text-[12.5px] font-medium mb-4" style={{ color: NAVY }}>← Voltar pra visão geral</button>
        <div className="text-[16px] font-bold text-slate-800 mb-1 uppercase">TREINAMENTO: {modulo.title}</div>
        <div className="flex gap-4 text-[12px] text-slate-500 mb-4">
          <span>{resumo.concluidos} de {resumo.totalPessoas} concluíram ({resumo.percentualConclusao}%)</span>
          {resumo.mediaNota != null && <span>Média: {resumo.mediaNota}%</span>}
        </div>
        <div className="bg-white rounded-xl border overflow-x-auto" style={{ borderColor: 'var(--pagina-borda)' }}>
          <table className="w-full text-[12.5px]">
            <thead>
              <tr className="border-b" style={{ borderColor: 'var(--pagina-borda)' }}>
                <th className="text-left font-semibold text-slate-500 px-4 py-3">Colaborador</th>
                <th className="text-center font-semibold text-slate-500 px-3 py-3">Status</th>
                <th className="text-center font-semibold text-slate-500 px-3 py-3">Data conclusão</th>
                <th className="text-center font-semibold text-slate-500 px-3 py-3">Nota</th>
                <th className="text-center font-semibold text-slate-500 px-3 py-3">Certas</th>
                <th className="text-center font-semibold text-slate-500 px-3 py-3">Erradas</th>
              </tr>
            </thead>
            <tbody>
              {linhasDoModulo.map(({ pessoa, dado }) => (
                <tr key={pessoa.id} className="border-b last:border-0" style={{ borderColor: 'var(--pagina-borda-suave)' }}>
                  <td className="px-4 py-2.5 font-medium text-slate-700">{pessoa.name}</td>
                  <td className="text-center px-3 py-2.5">
                    {dado.concluido ? (
                      <span className="text-[11px] font-semibold text-emerald-600">Concluído</span>
                    ) : (
                      <span className="text-[11px] font-semibold text-slate-400">Não concluído</span>
                    )}
                  </td>
                  <td className="text-center px-3 py-2.5 text-slate-500">
                    {dado.concluidoEm ? new Date(dado.concluidoEm).toLocaleString('pt-BR') : '—'}
                  </td>
                  <td className="text-center px-3 py-2.5 font-semibold" style={{ color: dado.nota == null ? '#94A3B8' : dado.nota === 100 ? '#16A34A' : dado.nota >= 50 ? '#EA4E1B' : '#DC2626' }}>
                    {dado.nota != null ? `${dado.nota}%` : '—'}
                  </td>
                  <td className="text-center px-3 py-2.5 text-emerald-600">{dado.acertos}</td>
                  <td className="text-center px-3 py-2.5 text-red-500">{dado.erros}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto flex flex-col gap-3">
      {dados.modulos.map((m, i) => {
        const resumo = dados.resumoModulos.find((r) => r.moduloId === m.id);
        return (
          <button
            key={m.id}
            onClick={() => setModuloSelecionado(m.id)}
            className="bg-white rounded-xl border p-4 text-left hover:border-[#2563EB] transition-colors"
            style={{ borderColor: 'var(--pagina-borda)' }}
          >
            <div className="text-[11px] font-semibold text-slate-400">TREINAMENTO {i + 1}</div>
            <div className="text-[14px] font-semibold text-slate-800 mb-2">{m.title}</div>
            <div className="flex items-center gap-4">
              <div className="flex-1 h-2 rounded-full bg-slate-100 overflow-hidden">
                <div className="h-full" style={{ width: `${resumo.percentualConclusao}%`, background: NAVY }} />
              </div>
              <span className="text-[11.5px] text-slate-500 shrink-0">{resumo.concluidos}/{resumo.totalPessoas} concluíram</span>
              {resumo.mediaNota != null && <span className="text-[11.5px] font-semibold shrink-0" style={{ color: NAVY }}>Média {resumo.mediaNota}%</span>}
            </div>
          </button>
        );
      })}
    </div>
  );
}
