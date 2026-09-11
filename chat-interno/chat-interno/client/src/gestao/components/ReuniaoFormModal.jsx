// client/src/gestao/components/ReuniaoFormModal.jsx
import { useEffect, useState } from 'react';
import { X, Users, Building2 } from 'lucide-react';
import { api } from '../../api';

const NAVY = '#2563EB';
const LEMBRETES = [
  { minutos: 0, label: 'No dia' },
  { minutos: 30, label: '30 min' },
  { minutos: 15, label: '15 min' },
  { minutos: 5, label: '5 min' },
];

function paraInputDate(d) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

export default function ReuniaoFormModal({ dataInicial, onClose, onSaved }) {
  const [titulo, setTitulo] = useState('');
  const [tipo, setTipo] = useState('interna');
  const [data, setData] = useState(paraInputDate(dataInicial || new Date()));
  const [horaInicio, setHoraInicio] = useState('09:00');
  const [horaFim, setHoraFim] = useState('10:00');
  const [local, setLocal] = useState('');
  const [descricao, setDescricao] = useState('');
  const [lembretes, setLembretes] = useState([0, 30, 15, 5]);

  const [users, setUsers] = useState([]);
  const [participantes, setParticipantes] = useState([]);
  const [filtroPessoa, setFiltroPessoa] = useState('');

  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    // Só ADM participa de reunião — operador nunca aparece aqui.
    api.get('/users/manage').then(({ data }) => setUsers(data.users.filter((u) => u.role === 'admin')));
  }, []);

  const escolhidos = users.filter((u) => participantes.includes(u.id));
  const filtrados = users.filter(
    (u) => !participantes.includes(u.id) && u.name.toLowerCase().includes(filtroPessoa.toLowerCase())
  );

  const toggleLembrete = (m) => {
    setLembretes((prev) => (prev.includes(m) ? prev.filter((x) => x !== m) : [...prev, m]));
  };

  const submit = async (e) => {
    e.preventDefault();
    if (horaFim <= horaInicio) { setError('O horário de fim precisa ser depois do início.'); return; }
    setError('');
    setSaving(true);
    try {
      await api.post('/reunioes', {
        titulo,
        tipo,
        inicio: new Date(`${data}T${horaInicio}`).toISOString(),
        fim: new Date(`${data}T${horaFim}`).toISOString(),
        local,
        descricao,
        participantes,
        lembretes,
      });
      onSaved();
    } catch (err) {
      setError(err.response?.data?.error || 'Não deu pra agendar a reunião.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/40 flex items-start justify-center z-50 overflow-y-auto py-[4vh] px-4">
      <div className="bg-white rounded-xl w-[440px] max-w-full p-5 my-auto" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-slate-800 font-semibold text-base">Nova reunião</h3>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600"><X size={18} /></button>
        </div>

        <form onSubmit={submit}>
          <label className="text-xs font-medium text-slate-500 mb-1 block">Título</label>
          <input value={titulo} onChange={(e) => setTitulo(e.target.value)} required
            className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm mb-3 focus:outline-none focus:ring-2 focus:ring-[#2563EB]" />

          <label className="text-xs font-medium text-slate-500 mb-1.5 block">Tipo</label>
          <div className="flex gap-2 mb-3">
            <button type="button" onClick={() => setTipo('interna')}
              className="flex-1 flex items-center justify-center gap-1.5 text-[12.5px] font-medium rounded-lg py-2 border"
              style={tipo === 'interna' ? { background: '#EFF4FF', borderColor: NAVY, color: NAVY } : { borderColor: '#E2E8F0', color: '#64748B' }}>
              <Users size={14} /> Interna
            </button>
            <button type="button" onClick={() => setTipo('externa')}
              className="flex-1 flex items-center justify-center gap-1.5 text-[12.5px] font-medium rounded-lg py-2 border"
              style={tipo === 'externa' ? { background: '#FAEEDA', borderColor: '#BA7517', color: '#854F0B' } : { borderColor: '#E2E8F0', color: '#64748B' }}>
              <Building2 size={14} /> Externa
            </button>
          </div>

          <div className="flex gap-2 mb-3">
            <div className="flex-[1.3]">
              <label className="text-xs font-medium text-slate-500 mb-1 block">Data</label>
              <input type="date" value={data} onChange={(e) => setData(e.target.value)} required
                className="w-full border border-slate-200 rounded-lg px-2.5 py-2 text-sm" />
            </div>
            <div className="flex-1">
              <label className="text-xs font-medium text-slate-500 mb-1 block">Início</label>
              <input type="time" value={horaInicio} onChange={(e) => setHoraInicio(e.target.value)} required
                className="w-full border border-slate-200 rounded-lg px-2.5 py-2 text-sm" />
            </div>
            <div className="flex-1">
              <label className="text-xs font-medium text-slate-500 mb-1 block">Fim</label>
              <input type="time" value={horaFim} onChange={(e) => setHoraFim(e.target.value)} required
                className="w-full border border-slate-200 rounded-lg px-2.5 py-2 text-sm" />
            </div>
          </div>

          <label className="text-xs font-medium text-slate-500 mb-1 block">Local ou link (opcional)</label>
          <input value={local} onChange={(e) => setLocal(e.target.value)} placeholder="meet.google.com/... ou sala de reunião"
            className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm mb-3 focus:outline-none focus:ring-2 focus:ring-[#2563EB]" />

          <label className="text-xs font-medium text-slate-500 mb-1 block">Pauta (opcional)</label>
          <textarea value={descricao} onChange={(e) => setDescricao(e.target.value)} rows={2}
            className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm mb-3 resize-none focus:outline-none focus:ring-2 focus:ring-[#2563EB]" />

          <label className="text-xs font-medium text-slate-500 mb-1 block">Participantes</label>
          {escolhidos.length > 0 && (
            <div className="flex flex-wrap gap-1.5 mb-2">
              {escolhidos.map((u) => (
                <span key={u.id} className="flex items-center gap-1.5 text-[12px] font-medium rounded-full pl-2.5 pr-1.5 py-1" style={{ background: '#EFF4FF', color: NAVY }}>
                  {u.name}
                  <button type="button" onClick={() => setParticipantes((p) => p.filter((x) => x !== u.id))}><X size={12} /></button>
                </span>
              ))}
            </div>
          )}
          <input value={filtroPessoa} onChange={(e) => setFiltroPessoa(e.target.value)} placeholder="Buscar pessoa..."
            className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm mb-1 focus:outline-none focus:ring-2 focus:ring-[#2563EB]" />
          {filtroPessoa && (
            <div className="max-h-28 overflow-y-auto border border-slate-100 rounded-lg mb-3 divide-y divide-slate-50">
              {filtrados.slice(0, 20).map((u) => (
                <button key={u.id} type="button"
                  onClick={() => { setParticipantes((p) => [...p, u.id]); setFiltroPessoa(''); }}
                  className="w-full text-left px-3 py-1.5 text-sm hover:bg-slate-50">
                  {u.name}
                </button>
              ))}
              {filtrados.length === 0 && <div className="px-3 py-1.5 text-[12px] text-slate-400">Ninguém encontrado.</div>}
            </div>
          )}
          {!filtroPessoa && <div className="mb-3" />}

          <label className="text-xs font-medium text-slate-500 mb-1.5 block">Avisar</label>
          <div className="flex gap-1.5 flex-wrap mb-4">
            {LEMBRETES.map((l) => (
              <button key={l.minutos} type="button" onClick={() => toggleLembrete(l.minutos)}
                className="text-[11.5px] font-medium rounded-full px-3 py-1 border"
                style={lembretes.includes(l.minutos)
                  ? { background: '#EFF4FF', borderColor: NAVY, color: NAVY }
                  : { borderColor: '#E2E8F0', color: '#94A3B8' }}>
                {l.label}
              </button>
            ))}
          </div>

          {error && <div className="text-red-500 text-xs mb-3">{error}</div>}

          <button type="submit" disabled={saving}
            className="w-full rounded-lg py-2.5 text-sm font-medium text-white disabled:opacity-40" style={{ background: NAVY }}>
            {saving ? 'Agendando...' : 'Agendar reunião'}
          </button>
        </form>
      </div>
    </div>
  );
}
