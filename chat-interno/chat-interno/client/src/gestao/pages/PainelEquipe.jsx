// client/src/gestao/pages/PainelEquipe.jsx
import { useEffect, useState } from 'react';
import { Users, List, Kanban as KanbanIcon, Calendar, Eye, Pencil, Trash2, Plus } from 'lucide-react';
import PageHeader from '../PageHeader';
import { gestaoApi } from '../gestaoApi';
import TaskFormModal from '../components/TaskFormModal';
import TaskDetailModal from '../components/TaskDetailModal';

const NAVY = '#2563EB';
const STATUS_LABELS = { pending: 'Pendente', in_progress: 'Em andamento', done: 'Concluída', canceled: 'Cancelada' };
const STATUS_CORES = {
  pending: { bg: '#F1F5F9', cor: '#475569' },
  in_progress: { bg: '#EFF4FF', cor: NAVY },
  done: { bg: '#ECFDF3', cor: '#16A34A' },
  canceled: { bg: '#F1F5F9', cor: '#94A3B8' },
};
const PRIORIDADE_LABELS = { low: 'Baixa', medium: 'Média', high: 'Alta' };
const PRIORIDADE_CORES = { low: '#16A34A', medium: '#EAB308', high: '#DC2626' };
const DIAS_SEMANA = ['dom', 'seg', 'ter', 'qua', 'qui', 'sex', 'sáb'];
const MESES = ['Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho', 'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'];

function mesmoDia(a, b) {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
}
function gerarGradeDoMes(ano, mes) {
  const primeiro = new Date(ano, mes, 1);
  const inicio = new Date(primeiro);
  inicio.setDate(inicio.getDate() - inicio.getDay());
  const dias = [];
  for (let i = 0; i < 42; i++) {
    const d = new Date(inicio);
    d.setDate(inicio.getDate() + i);
    dias.push(d);
    if (i >= 34 && d.getMonth() !== mes && d.getDay() === 6) break;
  }
  return dias;
}

// Painel da equipe: visão geral por responsável + todas as tarefas da
// empresa numa lista/kanban/calendário só. A tela de "Tarefas" comum
// continua existindo do jeito que está, só mostrando as tarefas da própria
// pessoa — esse painel aqui é o extra, pra quem gerencia enxergar tudo.
export default function PainelEquipe() {
  const [overview, setOverview] = useState(null);
  const [tasks, setTasks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [visao, setVisao] = useState('lista'); // lista | kanban | calendario
  const [filtroResponsavel, setFiltroResponsavel] = useState('');
  const [filtroStatus, setFiltroStatus] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [openTaskId, setOpenTaskId] = useState(null);
  const [editingTask, setEditingTask] = useState(null);

  const hoje = new Date();
  const [mesAtual, setMesAtual] = useState(new Date(hoje.getFullYear(), hoje.getMonth(), 1));

  const load = async () => {
    setLoading(true);
    try {
      const params = {};
      if (filtroResponsavel) params.assignee_id = filtroResponsavel;
      if (filtroStatus) params.status = filtroStatus;
      const [ov, ts] = await Promise.all([gestaoApi.overview(), gestaoApi.listTasks(params)]);
      setOverview(ov);
      setTasks(ts.tasks || []);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, [filtroResponsavel, filtroStatus]); // eslint-disable-line react-hooks/exhaustive-deps

  const apagar = async (id) => {
    if (!confirm('Apagar essa tarefa? Essa ação não tem volta.')) return;
    await gestaoApi.deleteTask(id);
    load();
  };

  const dias = gerarGradeDoMes(mesAtual.getFullYear(), mesAtual.getMonth());
  const tasksNoDia = (dia) => tasks.filter((t) => t.due_date && mesmoDia(new Date(t.due_date), dia));

  const statusOrdem = ['pending', 'in_progress', 'done'];

  return (
    <div className="flex-1 flex flex-col overflow-hidden">
      <PageHeader icon={Users} title="Painel da Equipe" subtitle="Visão geral e acompanhamento de todas as tarefas" />

      <div className="flex-1 overflow-y-auto p-6" style={{ background: 'var(--pagina-fundo)' }}>
        {/* Visão por responsável — números que já existiam, só não apareciam em lugar nenhum */}
        <div className="bg-white rounded-xl border p-4 mb-4" style={{ borderColor: 'var(--pagina-borda)' }}>
          <div className="text-[13px] font-semibold text-slate-800 mb-3 flex items-center gap-1.5">
            <Users size={14} /> Visão por responsável
          </div>
          <div className="flex gap-3 overflow-x-auto pb-1">
            {(overview?.by_assignee || []).map((a) => {
              const pct = a.total > 0 ? Math.round((a.done / a.total) * 100) : 0;
              const ativo = filtroResponsavel === String(a.id);
              return (
                <button
                  key={a.id}
                  onClick={() => setFiltroResponsavel(ativo ? '' : String(a.id))}
                  className="shrink-0 rounded-xl border px-4 py-3 text-left min-w-[170px] transition-colors"
                  style={{ borderColor: ativo ? NAVY : 'var(--pagina-borda)', background: ativo ? '#EFF4FF' : 'transparent' }}
                >
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-[12.5px] font-semibold text-slate-800 truncate">{a.name}</span>
                    <span className="text-[11px] text-slate-500 shrink-0">{a.done}/{a.total}</span>
                  </div>
                  <div className="h-1.5 rounded-full bg-slate-100 overflow-hidden">
                    <div className="h-full rounded-full" style={{ width: `${pct}%`, background: pct === 100 ? '#16A34A' : NAVY }} />
                  </div>
                  {a.overdue > 0 && (
                    <div className="text-[10.5px] text-red-500 mt-1.5">{a.overdue} atrasada{a.overdue > 1 ? 's' : ''}</div>
                  )}
                </button>
              );
            })}
          </div>
        </div>

        {/* Barra de filtros/visão */}
        <div className="flex items-center gap-2 mb-4 flex-wrap">
          <select
            value={filtroStatus}
            onChange={(e) => setFiltroStatus(e.target.value)}
            className="border rounded-lg px-2.5 py-1.5 text-[12.5px]"
            style={{ borderColor: 'var(--pagina-borda)' }}
          >
            <option value="">Todos os status</option>
            {Object.entries(STATUS_LABELS).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
          </select>
          {filtroResponsavel && (
            <button onClick={() => setFiltroResponsavel('')} className="text-[12px] font-medium" style={{ color: NAVY }}>
              Limpar filtro de responsável ×
            </button>
          )}
          <div className="flex-1" />
          <div className="flex rounded-lg border overflow-hidden" style={{ borderColor: 'var(--pagina-borda)' }}>
            {[
              { key: 'lista', icone: List, label: 'Lista' },
              { key: 'kanban', icone: KanbanIcon, label: 'Kanban' },
              { key: 'calendario', icone: Calendar, label: 'Calendário' },
            ].map((v) => (
              <button
                key={v.key}
                onClick={() => setVisao(v.key)}
                className="flex items-center gap-1.5 text-[12px] font-medium px-3 py-1.5"
                style={{ background: visao === v.key ? NAVY : 'transparent', color: visao === v.key ? '#fff' : 'var(--pagina-texto-2)' }}
              >
                <v.icone size={13} /> {v.label}
              </button>
            ))}
          </div>
          <button
            onClick={() => setShowForm(true)}
            className="flex items-center gap-1.5 text-white text-[12.5px] font-medium px-3 py-1.5 rounded-lg"
            style={{ background: NAVY }}
          >
            <Plus size={14} /> Nova tarefa
          </button>
        </div>

        {loading && <p className="text-[12px]" style={{ color: 'var(--pagina-texto-2)' }}>Carregando...</p>}

        {!loading && visao === 'lista' && (
          <div className="bg-white rounded-xl border overflow-hidden" style={{ borderColor: 'var(--pagina-borda)' }}>
            <table className="w-full text-[12.5px]">
              <thead>
                <tr className="border-b" style={{ borderColor: 'var(--pagina-borda)', background: '#F8FAFC' }}>
                  {['Responsável', 'Demanda', 'Prazo', 'Prioridade', 'Status', 'Obs', 'Ações'].map((h) => (
                    <th key={h} className="text-left px-3 py-2 font-medium text-slate-500 text-[11px] uppercase tracking-wide">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {tasks.length === 0 && (
                  <tr><td colSpan={7} className="text-center py-6 text-slate-400 text-[12.5px]">Nenhuma tarefa encontrada.</td></tr>
                )}
                {tasks.map((t) => (
                  <tr key={t.id} className="border-b last:border-0" style={{ borderColor: 'var(--pagina-borda)' }}>
                    <td className="px-3 py-2 text-slate-700">{(t.assignees || []).map((a) => a.name).join(', ') || '—'}</td>
                    <td className="px-3 py-2 text-slate-800 font-medium">{t.title}</td>
                    <td className="px-3 py-2" style={{ color: t.is_overdue ? '#DC2626' : 'var(--pagina-texto-2)' }}>
                      {t.due_date ? new Date(t.due_date).toLocaleDateString('pt-BR') : '—'}
                    </td>
                    <td className="px-3 py-2">
                      <span className="rounded-full px-2 py-0.5 text-[11px] font-medium" style={{ color: PRIORIDADE_CORES[t.priority] }}>
                        {PRIORIDADE_LABELS[t.priority]}
                      </span>
                    </td>
                    <td className="px-3 py-2">
                      <span className="rounded-full px-2 py-0.5 text-[11px] font-medium" style={{ background: STATUS_CORES[t.status]?.bg, color: STATUS_CORES[t.status]?.cor }}>
                        {t.is_overdue ? 'Atrasada' : STATUS_LABELS[t.status]}
                      </span>
                    </td>
                    <td className="px-3 py-2 text-slate-500 max-w-[180px] truncate" title={t.description}>{t.description || '—'}</td>
                    <td className="px-3 py-2">
                      <div className="flex items-center gap-2">
                        <button onClick={() => setOpenTaskId(t.id)} className="text-slate-400 hover:text-[#2563EB]" title="Ver"><Eye size={14} /></button>
                        <button onClick={() => setEditingTask(t)} className="text-slate-400 hover:text-[#2563EB]" title="Editar"><Pencil size={14} /></button>
                        <button onClick={() => apagar(t.id)} className="text-slate-400 hover:text-red-500" title="Apagar"><Trash2 size={14} /></button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {!loading && visao === 'kanban' && (
          <div className="grid grid-cols-3 gap-3">
            {statusOrdem.map((status) => (
              <div key={status} className="bg-white rounded-xl border p-3" style={{ borderColor: 'var(--pagina-borda)' }}>
                <div className="text-[12px] font-semibold mb-2 flex items-center gap-1.5" style={{ color: STATUS_CORES[status].cor }}>
                  {STATUS_LABELS[status]} ({tasks.filter((t) => t.status === status).length})
                </div>
                <div className="flex flex-col gap-2">
                  {tasks.filter((t) => t.status === status).map((t) => (
                    <button
                      key={t.id}
                      onClick={() => setOpenTaskId(t.id)}
                      className="text-left border rounded-lg p-2.5 hover:border-[#2563EB] transition-colors"
                      style={{ borderColor: 'var(--pagina-borda)' }}
                    >
                      <div className="text-[12.5px] font-medium text-slate-800">{t.title}</div>
                      <div className="text-[11px] text-slate-500 mt-1">{(t.assignees || []).map((a) => a.name).join(', ') || 'sem responsável'}</div>
                      {t.due_date && (
                        <div className="text-[10.5px] mt-1" style={{ color: t.is_overdue ? '#DC2626' : 'var(--pagina-texto-2)' }}>
                          {new Date(t.due_date).toLocaleDateString('pt-BR')}
                        </div>
                      )}
                    </button>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}

        {!loading && visao === 'calendario' && (
          <div className="bg-white rounded-xl border p-3" style={{ borderColor: 'var(--pagina-borda)' }}>
            <div className="flex items-center gap-3 mb-3">
              <button onClick={() => setMesAtual(new Date(mesAtual.getFullYear(), mesAtual.getMonth() - 1, 1))} className="text-slate-500">‹</button>
              <span className="text-[13px] font-semibold text-slate-800 min-w-[130px] text-center">{MESES[mesAtual.getMonth()]} {mesAtual.getFullYear()}</span>
              <button onClick={() => setMesAtual(new Date(mesAtual.getFullYear(), mesAtual.getMonth() + 1, 1))} className="text-slate-500">›</button>
            </div>
            <div className="grid grid-cols-7 gap-1 mb-1.5">
              {DIAS_SEMANA.map((d) => <div key={d} className="text-[11px] text-center" style={{ color: 'var(--pagina-texto-2)' }}>{d}</div>)}
            </div>
            <div className="grid grid-cols-7 gap-1">
              {dias.map((dia, i) => {
                const doMes = dia.getMonth() === mesAtual.getMonth();
                const ehHoje = mesmoDia(dia, hoje);
                const doDia = tasksNoDia(dia);
                return (
                  <div key={i} className="min-h-[76px] rounded-md p-1.5 border" style={{ borderColor: ehHoje ? NAVY : 'var(--pagina-borda)', borderWidth: ehHoje ? 2 : 1, opacity: doMes ? 1 : 0.4 }}>
                    <span className="text-[11px] font-medium" style={{ color: ehHoje ? NAVY : 'var(--pagina-texto-2)' }}>{dia.getDate()}</span>
                    <div className="flex flex-col gap-0.5 mt-1">
                      {doDia.slice(0, 3).map((t) => (
                        <button key={t.id} onClick={() => setOpenTaskId(t.id)} className="text-[10px] rounded px-1 py-0.5 truncate block text-left" style={{ background: t.is_overdue ? '#FEE2E2' : '#EFF4FF', color: t.is_overdue ? '#DC2626' : '#0C447C' }}>
                          {t.title}
                        </button>
                      ))}
                      {doDia.length > 3 && <span className="text-[10px]" style={{ color: 'var(--pagina-texto-2)' }}>+{doDia.length - 3} mais</span>}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>

      {showForm && (
        <TaskFormModal onClose={() => setShowForm(false)} onSaved={() => { setShowForm(false); load(); }} />
      )}
      {editingTask && (
        <TaskFormModal task={editingTask} onClose={() => setEditingTask(null)} onSaved={() => { setEditingTask(null); load(); }} />
      )}
      {openTaskId && (
        <TaskDetailModal taskId={openTaskId} onClose={() => setOpenTaskId(null)} onChanged={load} />
      )}
    </div>
  );
}
