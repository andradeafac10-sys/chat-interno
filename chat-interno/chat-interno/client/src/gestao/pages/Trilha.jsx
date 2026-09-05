// client/src/gestao/pages/Trilha.jsx
import { useEffect, useState } from 'react';
import { GraduationCap, Plus, X, Trash2, CheckCircle2, XCircle, Circle } from 'lucide-react';
import PageHeader from '../PageHeader';
import { api, fileUrl } from '../../api';

const NAVY = '#2563EB';

export default function Trilha() {
  const [aba, setAba] = useState('conteudo'); // 'conteudo' | 'acompanhamento'

  return (
    <div className="flex-1 flex flex-col overflow-hidden">
      <PageHeader icon={GraduationCap} title="Trilha do Conhecimento" subtitle="Módulos de treinamento com vídeo e prova" />

      <div className="px-6 pt-3 bg-white border-b flex items-center gap-2" style={{ borderColor: '#E4E8EE' }}>
        {[
          { key: 'conteudo', label: 'Conteúdo' },
          { key: 'acompanhamento', label: 'Acompanhamento' },
        ].map((op) => (
          <button
            key={op.key}
            onClick={() => setAba(op.key)}
            className="text-[12px] font-semibold rounded-full px-3.5 py-1.5 mb-3"
            style={{ background: aba === op.key ? NAVY : '#F1F5F9', color: aba === op.key ? '#fff' : '#64748B' }}
          >
            {op.label}
          </button>
        ))}
      </div>

      <div className="flex-1 overflow-y-auto p-6" style={{ background: '#F7F9FB' }}>
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
    if (!confirm('Apagar esse módulo, o vídeo e a prova dele? Essa ação não tem volta.')) return;
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
        <Plus size={15} /> Novo módulo
      </button>

      {loading ? (
        <p className="text-sm text-slate-400">Carregando...</p>
      ) : modulos.length === 0 ? (
        <p className="text-sm text-slate-400">Nenhum módulo criado ainda.</p>
      ) : (
        <div className="flex flex-col gap-3">
          {modulos.map((m, i) => (
            <div key={m.id} className="bg-white rounded-xl border p-4" style={{ borderColor: '#E4E8EE' }}>
              <div className="flex items-start justify-between gap-3">
                <div>
                  <div className="text-[11px] font-semibold text-slate-400">MÓDULO {i + 1}</div>
                  <div className="text-[14px] font-semibold text-slate-800">{m.title}</div>
                  {m.description && <div className="text-[12.5px] text-slate-500 mt-0.5">{m.description}</div>}
                  <div className="text-[11.5px] text-slate-400 mt-1">{m.total_perguntas} pergunta(s) na prova</div>
                </div>
                <button onClick={() => apagarModulo(m.id)} className="text-slate-400 hover:text-red-500 shrink-0">
                  <Trash2 size={15} />
                </button>
              </div>
              <video src={fileUrl(m.video_url)} controls className="w-full rounded-lg mt-3 max-h-52 bg-black" />
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

function NovoModuloModal({ onClose, onSaved }) {
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [video, setVideo] = useState(null);
  const [saving, setSaving] = useState(false);
  const [progresso, setProgresso] = useState(0);
  const [error, setError] = useState('');

  const submit = async (e) => {
    e.preventDefault();
    if (!video) { setError('Escolha o arquivo de vídeo.'); return; }
    setError('');
    setSaving(true);
    try {
      const form = new FormData();
      form.append('title', title);
      form.append('description', description);
      form.append('video', video);
      await api.post('/trilha/modulos', form, {
        headers: { 'Content-Type': 'multipart/form-data' },
        // Vídeo grande demora pra subir de verdade — sem isso, herdava o
        // limite de 15s do resto do sistema e sempre dava erro de "demorou
        // demais", mesmo o envio estando indo bem, só que devagar.
        timeout: 0,
        onUploadProgress: (evt) => setProgresso(Math.round((evt.loaded * 100) / evt.total)),
      });
      onSaved();
    } catch (err) {
      setError(err.response?.data?.error || 'Não deu pra criar o módulo. Vídeos muito grandes podem falhar — tente um arquivo menor.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
      <div className="bg-white rounded-xl w-[420px] max-h-[85vh] overflow-y-auto p-5" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-slate-800 font-semibold text-base">Novo módulo</h3>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600"><X size={18} /></button>
        </div>
        <form onSubmit={submit}>
          <label className="text-xs font-medium text-slate-500 mb-1 block">Título</label>
          <input value={title} onChange={(e) => setTitle(e.target.value)} className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm mb-3 focus:outline-none focus:ring-2 focus:ring-[#2563EB]" required />

          <label className="text-xs font-medium text-slate-500 mb-1 block">Descrição (opcional)</label>
          <textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={2} className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm mb-3 resize-none focus:outline-none focus:ring-2 focus:ring-[#2563EB]" />

          <label className="text-xs font-medium text-slate-500 mb-1 block">Vídeo</label>
          <input type="file" accept="video/*" onChange={(e) => setVideo(e.target.files?.[0] || null)} className="w-full text-[13px] mb-1" required />
          <p className="text-[11px] text-slate-400 mb-3">Vídeos grandes podem demorar pra subir — não feche essa janela enquanto envia.</p>

          {saving && (
            <div className="w-full h-1.5 bg-slate-100 rounded-full mb-3 overflow-hidden">
              <div className="h-full" style={{ width: `${progresso}%`, background: NAVY }} />
            </div>
          )}
          {error && <div className="text-red-500 text-xs mb-3">{error}</div>}

          <button type="submit" disabled={saving} className="w-full rounded-lg py-2.5 text-sm font-medium text-white disabled:opacity-40" style={{ background: NAVY }}>
            {saving ? `Enviando... ${progresso}%` : 'Criar módulo'}
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
      <button onClick={onVoltar} className="text-[12.5px] font-medium mb-4" style={{ color: NAVY }}>← Voltar pros módulos</button>
      <div className="text-[15px] font-semibold text-slate-800 mb-1">{modulo.title}</div>
      <div className="text-[12.5px] text-slate-500 mb-4">Perguntas da prova desse módulo</div>

      <button onClick={() => setShowForm(true)} className="flex items-center gap-1.5 text-white text-[13px] font-medium px-3 py-2 rounded-lg mb-4" style={{ background: NAVY }}>
        <Plus size={15} /> Nova pergunta
      </button>

      {loading ? (
        <p className="text-sm text-slate-400">Carregando...</p>
      ) : perguntas.length === 0 ? (
        <p className="text-sm text-slate-400">Nenhuma pergunta cadastrada ainda — sem prova, o módulo libera direto depois do vídeo.</p>
      ) : (
        <div className="flex flex-col gap-3">
          {perguntas.map((p, i) => (
            <div key={p.id} className="bg-white rounded-xl border p-4" style={{ borderColor: '#E4E8EE' }}>
              <div className="flex items-start justify-between gap-3 mb-2">
                <div className="text-[13.5px] font-medium text-slate-800">{i + 1}. {p.question}</div>
                <button onClick={() => apagar(p.id)} className="text-slate-400 hover:text-red-500 shrink-0"><Trash2 size={14} /></button>
              </div>
              <div className="flex flex-col gap-1">
                {p.opcoes.map((o) => (
                  <div key={o.id} className="flex items-center gap-2 text-[12.5px]" style={{ color: o.is_correct ? '#16A34A' : '#475569' }}>
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
  const [question, setQuestion] = useState('');
  const [opcoes, setOpcoes] = useState([{ text: '', isCorrect: true }, { text: '', isCorrect: false }]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const atualizarOpcao = (i, campo, valor) => {
    setOpcoes((prev) => prev.map((o, idx) => (idx === i ? { ...o, [campo]: valor } : o)));
  };
  const marcarCorreta = (i) => {
    setOpcoes((prev) => prev.map((o, idx) => ({ ...o, isCorrect: idx === i })));
  };
  const adicionarOpcao = () => setOpcoes((prev) => [...prev, { text: '', isCorrect: false }]);
  const removerOpcao = (i) => setOpcoes((prev) => prev.filter((_, idx) => idx !== i));

  const submit = async (e) => {
    e.preventDefault();
    if (opcoes.some((o) => !o.text.trim())) { setError('Preencha o texto de todas as alternativas.'); return; }
    setError('');
    setSaving(true);
    try {
      await api.post(`/trilha/modulos/${moduloId}/perguntas`, { question, opcoes });
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
          <label className="text-xs font-medium text-slate-500 mb-1 block">Pergunta</label>
          <textarea value={question} onChange={(e) => setQuestion(e.target.value)} rows={2} className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm mb-3 resize-none focus:outline-none focus:ring-2 focus:ring-[#2563EB]" required />

          <label className="text-xs font-medium text-slate-500 mb-1.5 block">Alternativas (marque a certa)</label>
          <div className="flex flex-col gap-2 mb-2">
            {opcoes.map((o, i) => (
              <div key={i} className="flex items-center gap-2">
                <input type="radio" checked={o.isCorrect} onChange={() => marcarCorreta(i)} className="accent-[#2563EB] shrink-0" />
                <input
                  value={o.text}
                  onChange={(e) => atualizarOpcao(i, 'text', e.target.value)}
                  placeholder={`Alternativa ${i + 1}`}
                  className="flex-1 border border-slate-200 rounded-lg px-2.5 py-1.5 text-[13px] focus:outline-none focus:ring-2 focus:ring-[#2563EB]"
                />
                {opcoes.length > 2 && (
                  <button type="button" onClick={() => removerOpcao(i)} className="text-slate-400 hover:text-red-500 shrink-0"><X size={14} /></button>
                )}
              </div>
            ))}
          </div>
          <button type="button" onClick={adicionarOpcao} className="text-[12px] font-medium mb-4" style={{ color: NAVY }}>+ Adicionar alternativa</button>

          {error && <div className="text-red-500 text-xs mb-3">{error}</div>}

          <button type="submit" disabled={saving} className="w-full rounded-lg py-2.5 text-sm font-medium text-white disabled:opacity-40" style={{ background: NAVY }}>
            {saving ? 'Salvando...' : 'Salvar pergunta'}
          </button>
        </form>
      </div>
    </div>
  );
}

function AbaAcompanhamento() {
  const [dados, setDados] = useState(null);

  useEffect(() => {
    api.get('/trilha/admin/progresso').then(({ data }) => setDados(data));
  }, []);

  if (!dados) return <p className="text-sm text-slate-400">Carregando...</p>;
  if (dados.modulos.length === 0) return <p className="text-sm text-slate-400">Crie um módulo primeiro pra ter o que acompanhar.</p>;

  return (
    <div className="bg-white rounded-xl border overflow-x-auto" style={{ borderColor: '#E4E8EE' }}>
      <table className="w-full text-[12.5px]">
        <thead>
          <tr className="border-b" style={{ borderColor: '#E4E8EE' }}>
            <th className="text-left font-semibold text-slate-500 px-4 py-3 sticky left-0 bg-white">Pessoa</th>
            {dados.modulos.map((m, i) => (
              <th key={m.id} className="text-center font-semibold text-slate-500 px-3 py-3 whitespace-nowrap">Módulo {i + 1}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {dados.linhas.map((linha) => (
            <tr key={linha.pessoa.id} className="border-b last:border-0" style={{ borderColor: '#F1F5F9' }}>
              <td className="px-4 py-2.5 sticky left-0 bg-white">
                <div className="flex items-center gap-2">
                  <div className="w-6 h-6 rounded-full flex items-center justify-center text-white text-[9px] font-semibold overflow-hidden shrink-0" style={{ background: linha.pessoa.color || NAVY }}>
                    {linha.pessoa.avatar_url ? <img src={fileUrl(linha.pessoa.avatar_url)} alt="" className="w-full h-full object-cover" /> : linha.pessoa.name.split(' ').map((p) => p[0]).slice(0, 2).join('').toUpperCase()}
                  </div>
                  <span className="font-medium text-slate-700 whitespace-nowrap">{linha.pessoa.name}</span>
                </div>
              </td>
              {linha.modulos.map((m, i) => (
                <td key={i} className="text-center px-3 py-2.5">
                  {m.passou ? (
                    <CheckCircle2 size={16} className="mx-auto text-emerald-500" />
                  ) : m.video_assistido ? (
                    <span className="text-[11px] text-amber-600 font-medium">Na prova</span>
                  ) : m.tentativas > 0 ? (
                    <XCircle size={16} className="mx-auto text-red-400" />
                  ) : (
                    <Circle size={14} className="mx-auto text-slate-300" />
                  )}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
