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
const PRIORITY_COLORS = { low: '#6b7280', medium: '#d97706', high: '#dc2626' };
const NAVY = '#0f2a4a';

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
          <button style={styles.newBtn} onClick={() => { setEditingTask(null); setShowForm(true); }}>
            + Nova tarefa
          </button>
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
                <h3 style={styles.cardTitle}>{task.title}</h3>
                {task.is_overdue && <span style={styles.overdueBadge}>Atrasada</span>}
              </div>

              <div style={styles.cardMeta}>
                <span>{PRIORITY_LABELS[task.priority]}</span>
                {task.due_date && (
                  <span>· prazo {new Date(task.due_date).toLocaleDateString('pt-BR')}</span>
                )}
                <span>· {statusLabel(task.status)}</span>
              </div>

              {(task.assignees || []).length > 0 && (
                <div style={styles.assigneesRow}>
                  {task.assignees.map((a) => (
                    <span key={a.id} style={styles.assigneeChip}>{a.name}</span>
                  ))}
                </div>
              )}

              {task.progress_type === 'checklist' && (
                <div style={styles.progressOuter}>
                  <div style={{ ...styles.progressInner, width: `${task.progress_percent}%` }} />
                </div>
              )}
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
    background: NAVY, color: '#fff', border: 'none', borderRadius: 8,
    padding: '9px 16px', fontSize: 14, fontWeight: 600, cursor: 'pointer', flexShrink: 0,
  },
  filters: { display: 'flex', gap: 8, flexWrap: 'wrap' },
  filter: {
    padding: '7px 14px', borderRadius: 999, border: '1px solid #d1d5db', background: '#fff',
    fontSize: 13, cursor: 'pointer', color: '#374151',
  },
  filterActive: {
    padding: '7px 14px', borderRadius: 999, border: `1px solid ${NAVY}`, background: NAVY,
    fontSize: 13, cursor: 'pointer', color: '#fff', fontWeight: 600,
  },
  hint: { color: '#6b7280', fontSize: 14 },
  error: { color: '#ef4444', fontSize: 14 },
  list: { display: 'flex', flexDirection: 'column', gap: 10, paddingBottom: 24 },
  card: {
    background: '#fff', border: '1px solid #e5e7eb', borderRadius: 10,
    padding: 14, cursor: 'pointer',
  },
  cardTop: { display: 'flex', alignItems: 'center', gap: 8 },
  priorityDot: { width: 8, height: 8, borderRadius: '50%', flexShrink: 0 },
  cardTitle: { margin: 0, fontSize: 15, color: '#111827', flex: 1 },
  overdueBadge: {
    background: '#dc2626', color: '#fff', fontSize: 10, fontWeight: 700,
    padding: '2px 8px', borderRadius: 999,
  },
  cardMeta: { fontSize: 12, color: '#6b7280', marginTop: 6, display: 'flex', gap: 6 },
  assigneesRow: { display: 'flex', gap: 6, marginTop: 8, flexWrap: 'wrap' },
  assigneeChip: {
    background: '#eef2f7', color: '#1c4270', fontSize: 11, padding: '3px 9px',
    borderRadius: 999,
  },
  progressOuter: { height: 6, background: '#e5e7eb', borderRadius: 999, marginTop: 10, overflow: 'hidden' },
  progressInner: { height: '100%', background: NAVY },
};
