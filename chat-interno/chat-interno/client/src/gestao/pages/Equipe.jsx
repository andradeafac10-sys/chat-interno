// client/src/gestao/pages/Equipe.jsx
import { useEffect, useState } from 'react';
import PageHeader from '../PageHeader';
import { gestaoApi } from '../gestaoApi';
import TaskDetailModal from '../components/TaskDetailModal';
import TaskFormModal from '../components/TaskFormModal';

const NAVY = '#0f2a4a';
const PRIORITY_LABELS = { low: 'Baixa', medium: 'Média', high: 'Alta' };
const PRIORITY_COLORS = { low: '#6b7280', medium: '#d97706', high: '#dc2626' };

function initials(name) {
  return name
    .split(' ')
    .slice(0, 2)
    .map((p) => p[0])
    .join('')
    .toUpperCase();
}

export default function Equipe() {
  const [members, setMembers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const [selectedMember, setSelectedMember] = useState(null);
  const [memberTasks, setMemberTasks] = useState([]);
  const [loadingTasks, setLoadingTasks] = useState(false);
  const [openTaskId, setOpenTaskId] = useState(null);
  const [editingTask, setEditingTask] = useState(null);
  const [showForm, setShowForm] = useState(false);

  useEffect(() => {
    gestaoApi
      .overview()
      .then((data) => setMembers(data.by_assignee || []))
      .catch((err) => setError(err.message || 'Não consegui carregar a equipe.'))
      .finally(() => setLoading(false));
  }, []);

  async function openMember(member) {
    setSelectedMember(member);
    setLoadingTasks(true);
    try {
      const data = await gestaoApi.listTasks({ assignee_id: member.id });
      setMemberTasks(data.tasks || []);
    } catch (err) {
      setMemberTasks([]);
    } finally {
      setLoadingTasks(false);
    }
  }

  function closeMember() {
    setSelectedMember(null);
    setMemberTasks([]);
  }

  function reloadMemberTasks() {
    if (selectedMember) openMember(selectedMember);
  }

  return (
    <div>
      <PageHeader title="Equipe" subtitle="Veja a carga de tarefas de cada responsável" />

      <div style={{ padding: '20px 24px' }}>
        {loading && <p style={styles.hint}>Carregando equipe...</p>}
        {error && <p style={styles.error}>{error}</p>}

        <div style={styles.grid}>
          {members.map((m) => (
            <div key={m.id} style={styles.card} onClick={() => openMember(m)}>
              <div style={styles.avatar}>{initials(m.name)}</div>
              <div style={styles.info}>
                <h3 style={styles.name}>{m.name}</h3>
                <div style={styles.stats}>
                  <span>{m.total} tarefa{m.total === '1' || m.total === 1 ? '' : 's'}</span>
                  <span style={styles.dot}>·</span>
                  <span style={styles.doneStat}>{m.done} concluída{m.done === '1' || m.done === 1 ? '' : 's'}</span>
                  {Number(m.overdue) > 0 && (
                    <>
                      <span style={styles.dot}>·</span>
                      <span style={styles.overdueStat}>{m.overdue} atrasada{m.overdue === '1' ? '' : 's'}</span>
                    </>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>

        {!loading && !error && members.length === 0 && (
          <p style={styles.hint}>Nenhum ADM ativo encontrado.</p>
        )}
      </div>

      {selectedMember && (
        <div style={styles.overlay} onClick={closeMember}>
          <div style={styles.panel} onClick={(e) => e.stopPropagation()}>
            <div style={styles.panelHeader}>
              <div>
                <h2 style={styles.panelTitle}>{selectedMember.name}</h2>
                <p style={styles.panelSubtitle}>Tarefas atribuídas a essa pessoa</p>
              </div>
              <button style={styles.closeBtn} onClick={closeMember}>✕</button>
            </div>

            <div style={styles.panelBody}>
              {loadingTasks && <p style={styles.hint}>Carregando...</p>}
              {!loadingTasks && memberTasks.length === 0 && (
                <p style={styles.hint}>Nenhuma tarefa atribuída.</p>
              )}
              {memberTasks.map((task) => (
                <div key={task.id} style={styles.taskRow} onClick={() => setOpenTaskId(task.id)}>
                  <span style={{ ...styles.priorityDot, background: PRIORITY_COLORS[task.priority] }} />
                  <span style={styles.taskTitle}>{task.title}</span>
                  {task.is_overdue && <span style={styles.overdueBadge}>Atrasada</span>}
                  <span style={styles.taskPriority}>{PRIORITY_LABELS[task.priority]}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {openTaskId && (
        <TaskDetailModal
          taskId={openTaskId}
          onClose={() => setOpenTaskId(null)}
          onChanged={reloadMemberTasks}
          onEdit={(task) => { setOpenTaskId(null); setEditingTask(task); setShowForm(true); }}
        />
      )}

      {showForm && (
        <TaskFormModal
          task={editingTask}
          onClose={() => { setShowForm(false); setEditingTask(null); }}
          onSaved={() => { setShowForm(false); setEditingTask(null); reloadMemberTasks(); }}
        />
      )}
    </div>
  );
}

const styles = {
  hint: { color: '#6b7280', fontSize: 14 },
  error: { color: '#ef4444', fontSize: 14 },
  grid: {
    display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))', gap: 12,
  },
  card: {
    display: 'flex', gap: 12, alignItems: 'center', background: '#fff',
    border: '1px solid #e5e7eb', borderRadius: 10, padding: 14, cursor: 'pointer',
  },
  avatar: {
    width: 42, height: 42, borderRadius: '50%', background: NAVY, color: '#fff',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    fontSize: 14, fontWeight: 700, flexShrink: 0,
  },
  info: { minWidth: 0 },
  name: { margin: 0, fontSize: 14, color: '#111827', fontWeight: 600 },
  stats: { fontSize: 12, color: '#6b7280', marginTop: 4, display: 'flex', gap: 4, flexWrap: 'wrap' },
  dot: { color: '#d1d5db' },
  doneStat: { color: '#16a34a' },
  overdueStat: { color: '#dc2626', fontWeight: 600 },

  overlay: {
    position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)',
    display: 'flex', justifyContent: 'flex-end', zIndex: 1000,
  },
  panel: {
    background: '#fff', width: '100%', maxWidth: 420, height: '100%',
    overflowY: 'auto', boxShadow: '-6px 0 24px rgba(0,0,0,0.2)',
  },
  panelHeader: {
    display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start',
    padding: '18px 20px', background: NAVY,
  },
  panelTitle: { margin: 0, color: '#fff', fontSize: 17 },
  panelSubtitle: { margin: '4px 0 0', color: '#cbd5e1', fontSize: 12 },
  closeBtn: { background: 'none', border: 'none', color: '#fff', fontSize: 18, cursor: 'pointer' },
  panelBody: { padding: 16 },
  taskRow: {
    display: 'flex', alignItems: 'center', gap: 8, padding: '10px 8px',
    borderBottom: '1px solid #f1f5f9', cursor: 'pointer',
  },
  priorityDot: { width: 8, height: 8, borderRadius: '50%', flexShrink: 0 },
  taskTitle: { flex: 1, fontSize: 13, color: '#111827' },
  taskPriority: { fontSize: 11, color: '#6b7280' },
  overdueBadge: {
    background: '#dc2626', color: '#fff', fontSize: 10, fontWeight: 700,
    padding: '2px 7px', borderRadius: 999,
  },
};
