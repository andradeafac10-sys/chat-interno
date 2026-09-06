// client/src/gestao/pages/Tarefas.jsx
import { useEffect, useState } from 'react';
import PageHeader from '../PageHeader';
import { gestaoApi } from '../gestaoApi';
import { useAuth } from '../../context/AuthContext';
import TaskFormModal from '../components/TaskFormModal';
import TaskDetailModal from '../components/TaskDetailModal';

const FILTERS = [
  { key: 'all', label: 'Todas' },
  { key: 'pending', label: 'Pendentes' },
  { key: 'in_progress', label: 'Em andamento' },
  { key: 'done', label: 'Concluídas' },
  { key: 'overdue', label: 'Atrasadas' },
];

const PRIORITY_LABELS = { low: 'Baixa', medium: 'Média', high: 'Alta' };
const PRIORITY_COLORS = { low: '#16a34a', medium: '#f59e0b', high: '#dc2626' };
const NAVY = '#2563EB';

export default function Tarefas() {
  const { user } = useAuth();
  const [tasks, setTasks] = useState([]);
  const [filter, setFilter] = useState('all');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [editingTask, setEditingTask] = useState(null);
  const [openTaskId, setOpenTaskId] = useState(null);

  async function load() {
    setLoading(true);
    setError('');
    try {
      const params = { assignee_id: user.id };
      if (filter === 'overdue') params.overdue = '1';
      else if (filter !== 'all') params.status = filter;

      const data = await gestaoApi.listTasks(params);
      setTasks(data.tasks || []);
    } catch (err) {
      setError(err.message || 'Não consegui carregar as tarefas.');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filter]);

  function handleSaved() {
    setShowForm(false);
    setEditingTask(null);
    load();
  }

  async function apagarTodas() {
    if (tasks.length === 0) return;
    if (!confirm(`Isso vai apagar TODAS as suas ${tasks.length} tarefa(s). Essa ação não tem volta. Quer continuar?`)) return;
    if (!confirm('Confirmando de novo: TEM CERTEZA que quer apagar todas as suas tarefas?')) return;
    setLoading(true);
    try {
      for (const task of tasks) {
        await gestaoApi.deleteTask(task.id);
      }
      load();
    } catch (err) {
      setError(err.message || 'Não consegui apagar todas as tarefas.');
      setLoading(false);
    }
  }

  return (
    <div>
      <PageHeader title="Minhas tarefas" subtitle="Só as suas — você pode criar tarefas para outras pessoas também" />

      <div style={{ padding: '0 24px' }}>
        <div style={styles.topRow}>
          <div style={styles.filters}>
            {FILTERS.map((f) => (
              <button
                key={f.key}
                style={filter === f.key ? styles.filterActive : styles.filter}
                onClick={() => setFilter(f.key)}
              >
                {f.label}
              </button>
            ))}
          </div>
          <div style={{ display: 'flex', gap: 10 }}>
            <button style={styles.deleteAllBtn} onClick={apagarTodas} disabled={tasks.length === 0}>
              Apagar todas
            </button>
            <button style={styles.newBtn} onClick={() => { setEditingTask(null); setShowForm(true); }}>
              + Nova tarefa
            </button>
          </div>
        </div>

        {loading && <p style={styles.hint}>Carregando tarefas...</p>}
        {error && <p style={styles.error}>{error}</p>}

        {!loading && !error && tasks.length === 0 && (
          <p style={styles.hint}>Nenhuma tarefa por aqui ainda.</p>
        )}

        <div style={styles.list}>
          {tasks.map((task) => (
            <div key={task.id} style={styles.card} onClick={() => setOpenTaskId(task.id)}>
              <div style={styles.cardTop}>
                <span style={{ ...styles.priorityDot, background: PRIORITY_COLORS[task.priority] }} />
                <div style={styles.cardLinha}>
                  <span style={styles.cardTituloCompacto}>{task.title}</span>
                  <span style={{ ...styles.cardPrioridadeTexto, color: PRIORITY_COLORS[task.priority] }}>
                    PRIORIDADE: {PRIORITY_LABELS[task.priority]?.toUpperCase()}
                  </span>
                  {task.due_date && (
                    <span style={styles.cardPrazoTexto}>
                      PRAZO: {new Date(task.due_date).toLocaleDateString('pt-BR')}
                    </span>
                  )}
                </div>
                {task.is_overdue && <span style={styles.overdueBadge}>Atrasada</span>}
                <button
                  onClick={async (e) => {
                    e.stopPropagation();
                    if (!confirm(`Apagar a tarefa "${task.title}"? Essa ação não tem volta.`)) return;
                    await gestaoApi.deleteTask(task.id);
                    load();
                  }}
                  title="Apagar tarefa"
                  style={styles.deleteIconBtn}
                >
                  ✕
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>

      {showForm && (
        <TaskFormModal
          task={editingTask}
          onClose={() => { setShowForm(false); setEditingTask(null); }}
          onSaved={handleSaved}
        />
      )}

      {openTaskId && (
        <TaskDetailModal
          taskId={openTaskId}
          onClose={() => setOpenTaskId(null)}
          onChanged={load}
          onEdit={(task) => { setOpenTaskId(null); setEditingTask(task); setShowForm(true); }}
        />
      )}
    </div>
  );
}

function statusLabel(status) {
  const map = { pending: 'Pendente', in_progress: 'Em andamento', done: 'Concluída', canceled: 'Cancelada' };
  return map[status] || status;
}

const styles = {
  topRow: {
    display: 'flex', justifyContent: 'space-between', alignItems: 'center',
    marginTop: 20, marginBottom: 16, flexWrap: 'wrap', gap: 12,
  },
  newBtn: {
    background: NAVY, color: 'var(--pagina-cartao)', border: 'none', borderRadius: 8,
    padding: '9px 16px', fontSize: 14, fontWeight: 600, cursor: 'pointer', flexShrink: 0,
  },
  deleteAllBtn: {
    background: 'var(--pagina-cartao)', color: '#dc2626', border: '1px solid #dc2626', borderRadius: 8,
    padding: '9px 16px', fontSize: 14, fontWeight: 600, cursor: 'pointer', flexShrink: 0,
  },
  filters: { display: 'flex', gap: 8, flexWrap: 'wrap' },
  filter: {
    padding: '7px 14px', borderRadius: 999, border: '1px solid #d1d5db', background: 'var(--pagina-cartao)',
    fontSize: 13, cursor: 'pointer', color: '#374151',
  },
  filterActive: {
    padding: '7px 14px', borderRadius: 999, border: `1px solid ${NAVY}`, background: NAVY,
    fontSize: 13, cursor: 'pointer', color: 'var(--pagina-cartao)', fontWeight: 600,
  },
  hint: { color: 'var(--pagina-texto-2)', fontSize: 14 },
  error: { color: '#ef4444', fontSize: 14 },
  list: { display: 'flex', flexDirection: 'column', gap: 10, paddingBottom: 24 },
  card: {
    background: 'var(--pagina-cartao)', border: '1px solid #E4E8EE', borderRadius: 10,
    padding: 14, cursor: 'pointer',
  },
  cardTop: { display: 'flex', alignItems: 'center', gap: 8 },
  priorityDot: { width: 8, height: 8, borderRadius: '50%', flexShrink: 0 },
  cardTitle: { margin: 0, fontSize: 15, color: 'var(--pagina-texto-1)', flex: 1 },
  cardLinha: { flex: 1, minWidth: 0, display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' },
  cardTituloCompacto: { fontSize: 14.5, fontWeight: 600, color: 'var(--pagina-texto-1)' },
  cardPrioridadeTexto: { fontSize: 11, fontWeight: 700, letterSpacing: 0.3 },
  cardPrazoTexto: { fontSize: 11, fontWeight: 600, color: 'var(--pagina-texto-2)', letterSpacing: 0.3 },
  overdueBadge: {
    background: '#dc2626', color: 'var(--pagina-cartao)', fontSize: 10, fontWeight: 700,
    padding: '2px 8px', borderRadius: 999,
  },
  deleteIconBtn: {
    marginLeft: 'auto', background: 'none', border: 'none', color: '#9ca3af',
    fontSize: 14, cursor: 'pointer', padding: '2px 6px', flexShrink: 0,
  },
  cardMeta: { fontSize: 12, color: 'var(--pagina-texto-2)', marginTop: 6, display: 'flex', gap: 6 },
  assigneesRow: { display: 'flex', gap: 6, marginTop: 8, flexWrap: 'wrap' },
  assigneeChip: {
    background: '#eef2f7', color: '#1c4270', fontSize: 11, padding: '3px 9px',
    borderRadius: 999,
  },
  progressOuter: { height: 6, background: 'var(--pagina-borda)', borderRadius: 999, marginTop: 10, overflow: 'hidden' },
  progressInner: { height: '100%', background: NAVY },
};
