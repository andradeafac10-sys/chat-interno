// client/src/gestao/components/TodasRotinasModal.jsx
import { useEffect, useState } from 'react';
import { X, Search, Plus } from 'lucide-react';
import { gestaoApi } from '../gestaoApi';
import RecurrenceFormModal from './RecurrenceFormModal';

const NAVY = '#2563EB';
const DIAS_SEMANA_LABEL = ['domingo', 'segunda', 'terça', 'quarta', 'quinta', 'sexta', 'sábado'];
const CORES_PRIORIDADE = { high: '#dc2626', medium: '#f59e0b', low: '#16a34a' };
const LABEL_PRIORIDADE = { high: 'Alta', medium: 'Média', low: 'Baixa' };

function descreverRepeticao(r) {
  if (r.recurrence_type === 'daily') return 'Todos os dias';
  if (r.recurrence_type === 'weekdays') return 'Segunda a sexta';
  if (r.recurrence_type === 'monthly') return `Todo dia ${r.day_of_month} do mês`;
  if (r.recurrence_type === 'specific_days') {
    const dias = [...(r.days_of_week || [])].sort().map((d) => DIAS_SEMANA_LABEL[d]);
    return dias.length ? dias.join(', ') : 'Nenhum dia escolhido';
  }
  return '';
}

// Mesma lista da tela "Rotinas" (cadastro geral), mas dentro de um modal —
// pra dar pra ver e editar tudo sem sair do Dashboard.
export default function TodasRotinasModal({ onClose, onChanged }) {
  const [recurrences, setRecurrences] = useState([]);
  const [loading, setLoading] = useState(true);
  const [erro, setErro] = useState('');
  const [filtroNome, setFiltroNome] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState(null);

  const load = async () => {
    setLoading(true);
    setErro('');
    try {
      const data = await gestaoApi.listRecurrences();
      setRecurrences(data.recurrences || []);
    } catch (err) {
      setErro(err.message || 'Não consegui carregar as rotinas.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const toggleAtiva = async (rec) => {
    try {
      await gestaoApi.updateRecurrence(rec.id, { active: !rec.active });
      load();
      onChanged?.();
    } catch (err) {
      alert(err.message || 'Não consegui atualizar a rotina.');
    }
  };

  const apagar = async (rec) => {
    if (!confirm(`Apagar a rotina "${rec.title}"? O histórico de dias já marcados como feito/não feito some junto.`)) return;
    try {
      await gestaoApi.deleteRecurrence(rec.id);
      load();
      onChanged?.();
    } catch (err) {
      alert(err.message || 'Não consegui apagar a rotina.');
    }
  };

  // Ordena por horário (sem horário vai pro fim) e filtra por responsável
  const lista = [...recurrences]
    .sort((a, b) => {
      if (!a.start_time && !b.start_time) return a.title.localeCompare(b.title);
      if (!a.start_time) return 1;
      if (!b.start_time) return -1;
      return a.start_time.localeCompare(b.start_time);
    })
    .filter((r) => {
      const alvo = filtroNome.trim().toLowerCase();
      if (!alvo) return true;
      return (r.assignees || []).some((a) => a.name.toLowerCase().includes(alvo))
        || r.title.toLowerCase().includes(alvo);
    });

  if (showForm) {
    return (
      <RecurrenceFormModal
        recurrence={editing}
        onClose={() => { setShowForm(false); setEditing(null); }}
        onSaved={() => { setShowForm(false); setEditing(null); load(); onChanged?.(); }}
      />
    );
  }

  return (
    <div className="fixed inset-0 bg-black/40 flex items-start justify-center z-50 overflow-y-auto py-[4vh] px-4" onClick={onClose}>
      <div className="bg-white rounded-xl w-[720px] max-w-full p-5 my-auto" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-3">
          <div>
            <h3 className="text-slate-800 font-semibold text-base">Todas as rotinas</h3>
            <p className="text-[11.5px]" style={{ color: 'var(--pagina-texto-2)' }}>
              Cadastro geral — o que se repete, pra quem e quando
            </p>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600"><X size={18} /></button>
        </div>

        <div className="flex items-center gap-2 mb-3">
          <div className="relative flex-1">
            <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2" style={{ color: 'var(--pagina-texto-2)' }} />
            <input
              value={filtroNome}
              onChange={(e) => setFiltroNome(e.target.value)}
              placeholder="Filtrar por pessoa ou nome da rotina..."
              className="w-full border rounded-lg pl-7 pr-3 py-1.5 text-[12.5px] focus:outline-none focus:ring-2 focus:ring-[#2563EB]"
              style={{ borderColor: 'var(--pagina-borda)' }}
            />
          </div>
          <button
            onClick={() => { setEditing(null); setShowForm(true); }}
            className="flex items-center gap-1.5 text-white text-[12px] font-medium px-3 py-1.5 rounded-lg shrink-0"
            style={{ background: NAVY }}
          >
            <Plus size={13} /> Nova rotina
          </button>
        </div>

        {loading && <p className="text-[12px]" style={{ color: 'var(--pagina-texto-2)' }}>Carregando rotinas...</p>}
        {erro && <p className="text-[12px] text-red-500">{erro}</p>}
        {!loading && !erro && lista.length === 0 && (
          <p className="text-[12px]" style={{ color: 'var(--pagina-texto-2)' }}>
            {recurrences.length === 0 ? 'Nenhuma rotina cadastrada ainda.' : 'Nenhuma rotina encontrada com esse filtro.'}
          </p>
        )}

        <div className="flex flex-col gap-2 max-h-[62vh] overflow-y-auto">
          {lista.map((r) => (
            <div key={r.id} className="border rounded-lg p-3" style={{ borderColor: 'var(--pagina-borda)' }}>
              <div className="flex items-center gap-2 mb-1">
                <span className="w-2.5 h-2.5 rounded-full shrink-0"
                  style={{ background: CORES_PRIORIDADE[r.priority] || CORES_PRIORIDADE.medium }}
                  title={`Prioridade ${LABEL_PRIORIDADE[r.priority] || 'Média'}`} />
                <span className="text-[13px] font-semibold text-slate-800 flex-1 truncate">{r.title}</span>
                <span className="text-[10px] font-bold rounded-full px-2 py-0.5 shrink-0"
                  style={r.active ? { background: '#ECFDF3', color: '#16A34A' } : { background: 'var(--pagina-borda-suave)', color: 'var(--pagina-texto-2)' }}>
                  {r.active ? 'Ativa' : 'Pausada'}
                </span>
              </div>

              {r.description && (
                <p className="text-[12px] mb-1.5" style={{ color: 'var(--pagina-texto-2)' }}>{r.description}</p>
              )}

              <div className="text-[11.5px] mb-1.5" style={{ color: 'var(--pagina-texto-2)' }}>
                🔁 {descreverRepeticao(r)}{r.start_time ? ` · às ${r.start_time.slice(0, 5)}` : ''}
              </div>

              {(r.assignees || []).length > 0 && (
                <div className="flex flex-wrap gap-1 mb-2">
                  {r.assignees.map((a) => (
                    <span key={a.id} className="text-[10.5px] rounded-full px-2 py-0.5" style={{ background: '#EFF4FF', color: NAVY }}>
                      {a.name}
                    </span>
                  ))}
                </div>
              )}

              <div className="flex items-center gap-3 pt-1.5 border-t" style={{ borderColor: 'var(--pagina-borda)' }}>
                <button onClick={() => { setEditing(r); setShowForm(true); }} className="text-[11.5px] font-medium" style={{ color: NAVY }}>Editar</button>
                <button onClick={() => toggleAtiva(r)} className="text-[11.5px] font-medium" style={{ color: NAVY }}>
                  {r.active ? 'Pausar' : 'Reativar'}
                </button>
                <button onClick={() => apagar(r)} className="text-[11.5px] font-medium text-red-500">Apagar</button>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
