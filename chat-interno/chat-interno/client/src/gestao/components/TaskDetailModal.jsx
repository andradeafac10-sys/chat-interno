// client/src/gestao/components/TaskDetailModal.jsx
import { useEffect, useRef, useState } from 'react';
import { gestaoApi } from '../gestaoApi';

const STATUS_LABELS = {
  pending: 'Pendente',
  in_progress: 'Em andamento',
  done: 'Concluída',
  canceled: 'Cancelada',
};

const PRIORITY_LABELS = { low: 'Baixa', medium: 'Média', high: 'Alta' };
const PRIORITY_COLORS = { low: '#16a34a', medium: '#f59e0b', high: '#dc2626' };

export default function TaskDetailModal({ taskId, onClose, onChanged, onEdit }) {
  const [task, setTask] = useState(null);
  const [comments, setComments] = useState([]);
  const [newComment, setNewComment] = useState('');
  const [loading, setLoading] = useState(true);

  async function load() {
    setLoading(true);
    try {
      const data = await gestaoApi.getTask(taskId);
      setTask(data.task);
      setComments(data.comments || []);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [taskId]);

  async function changeStatus(status) {
    await gestaoApi.updateTask(taskId, { status });
    await load();
    onChanged();
  }

  async function addComment(e) {
    e.preventDefault();
    if (!newComment.trim()) return;
    await gestaoApi.addComment(taskId, newComment.trim());
    setNewComment('');
    await load();
  }

  async function finalizarTarefa() {
    await changeStatus('done');
    onClose();
  }

  async function handleDelete() {
    if (!confirm('Apagar essa tarefa? Essa ação não tem volta.')) return;
    await gestaoApi.deleteTask(taskId);
    onChanged();
    onClose();
  }

  if (loading || !task) {
    return (
      <div style={styles.overlay} onClick={onClose}>
        <div style={styles.modal} onClick={(e) => e.stopPropagation()}>
          <p style={{ padding: 24 }}>Carregando...</p>
        </div>
      </div>
    );
  }

  return (
    <div style={styles.overlay} onClick={onClose}>
      <div style={styles.modal} onClick={(e) => e.stopPropagation()}>
        <div style={styles.header}>
          <div>
            <h2 style={styles.title}>{task.title}</h2>
            <div style={styles.badges}>
              <span style={{ ...styles.badge, background: PRIORITY_COLORS[task.priority] }}>
                {PRIORITY_LABELS[task.priority]}
              </span>
              {task.is_overdue && <span style={{ ...styles.badge, background: '#dc2626' }}>Atrasada</span>}
              {task.due_date && (
                <span style={styles.dueDate}>
                  prazo: {new Date(task.due_date).toLocaleString('pt-BR')}
                </span>
              )}
            </div>
          </div>
          <div style={styles.headerActions}>
            <button style={styles.deleteIconBtn} onClick={handleDelete} title="Apagar tarefa">🗑</button>
            <button style={styles.closeBtn} onClick={onClose}>✕</button>
          </div>
        </div>

        <div style={styles.body}>
          {task.description && <p style={styles.description}>{task.description}</p>}

          <div style={styles.statusRow}>
            <span style={styles.label}>Status:</span>
            <select
              style={styles.statusSelect}
              value={task.status}
              onChange={(e) => changeStatus(e.target.value)}
            >
              {Object.entries(STATUS_LABELS).map(([value, label]) => (
                <option key={value} value={value}>{label}</option>
              ))}
            </select>
          </div>

          {task.status !== 'done' && (
            <button onClick={finalizarTarefa} style={styles.finalizarBtn}>
              ✓ Marcar como finalizada
            </button>
          )}

          {task.assignees.length > 0 && (
            <div style={styles.assignees}>
              <span style={styles.label}>Responsáveis:</span>{' '}
              {task.assignees.map((a) => a.name).join(', ')}
            </div>
          )}

          {task.progress_type === 'checklist' && (
            <div style={styles.progressBarOuter}>
              <div style={{ ...styles.progressBarInner, width: `${task.progress_percent}%` }} />
            </div>
          )}

          <div style={styles.commentsTitle}>Comentários ({comments.length})</div>

          <div>
            {comments.map((c) => (
              <div key={c.id} style={styles.commentRow}>
                <strong style={styles.commentAuthor}>{c.user_name}</strong>
                <span style={styles.commentDate}>
                  {new Date(c.created_at).toLocaleString('pt-BR')}
                </span>
                {c.content && <p style={styles.commentText}>{c.content}</p>}
              </div>
            ))}
            {comments.length === 0 && <p style={styles.hint}>Nenhum comentário ainda.</p>}
            <form onSubmit={addComment} style={styles.addForm}>
              <input
                style={styles.input}
                value={newComment}
                onChange={(e) => setNewComment(e.target.value)}
                placeholder="Escrever um comentário"
              />
              <button style={styles.addBtn} type="submit">Enviar</button>
            </form>
          </div>
        </div>
      </div>
    </div>
  );
}

function describeAction(h) {
  switch (h.action) {
    case 'created': return 'criou a tarefa';
    case 'status_changed': return `mudou o status: ${STATUS_LABELS[h.details?.from] || h.details?.from} → ${STATUS_LABELS[h.details?.to] || h.details?.to}`;
    case 'priority_changed': return `mudou a prioridade: ${PRIORITY_LABELS[h.details?.from] || h.details?.from} → ${PRIORITY_LABELS[h.details?.to] || h.details?.to}`;
    case 'due_date_changed': return 'mudou o prazo';
    case 'assignee_added': return 'atualizou os responsáveis';
    case 'checklist_item_done': return `marcou "${h.details?.item}" como feito`;
    case 'checklist_item_undone': return `desmarcou "${h.details?.item}"`;
    case 'comment_added': return 'comentou';
    default: return h.action;
  }
}

const NAVY = '#2563EB';

const styles = {
  overlay: {
    position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)',
    display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000,
  },
  modal: {
    background: 'var(--pagina-cartao)', borderRadius: 12, width: '92%', maxWidth: 600,
    maxHeight: '88vh', overflowY: 'auto', boxShadow: '0 10px 40px rgba(0,0,0,0.3)',
  },
  header: {
    display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start',
    padding: '16px 20px', borderBottom: '1px solid #E4E8EE', background: NAVY,
    borderRadius: '12px 12px 0 0',
  },
  title: { margin: 0, color: 'var(--pagina-cartao)', fontSize: 18 },
  badges: { display: 'flex', gap: 8, alignItems: 'center', marginTop: 8, flexWrap: 'wrap' },
  badge: { color: 'var(--pagina-cartao)', fontSize: 11, fontWeight: 700, padding: '3px 8px', borderRadius: 999 },
  dueDate: { color: '#cbd5e1', fontSize: 12 },
  closeBtn: { background: 'none', border: 'none', color: 'var(--pagina-cartao)', fontSize: 18, cursor: 'pointer' },
  headerActions: { display: 'flex', alignItems: 'center', gap: 12 },
  deleteIconBtn: { background: 'none', border: 'none', color: 'rgba(255,255,255,0.85)', fontSize: 16, cursor: 'pointer', lineHeight: 1 },
  body: { padding: 20 },
  description: { color: 'var(--pagina-texto-1)', fontSize: 14, marginTop: 0 },
  statusRow: { display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 },
  finalizarBtn: {
    width: '100%', border: 'none', borderRadius: 8, padding: '11px', background: '#16a34a',
    color: 'var(--pagina-cartao)', fontSize: 14, fontWeight: 700, cursor: 'pointer', marginBottom: 14,
  },
  label: { fontSize: 13, fontWeight: 600, color: 'var(--pagina-texto-1)' },
  statusSelect: { padding: '6px 10px', borderRadius: 6, border: '1px solid #d1d5db', fontSize: 13 },
  assignees: { fontSize: 13, color: 'var(--pagina-texto-1)', marginBottom: 10 },
  progressBarOuter: { height: 8, background: 'var(--pagina-borda)', borderRadius: 999, marginBottom: 14, overflow: 'hidden' },
  progressBarInner: { height: '100%', background: NAVY, transition: 'width .2s' },
  commentsTitle: {
    fontSize: 14, fontWeight: 700, color: 'var(--pagina-texto-1)',
    borderBottom: `2px solid ${NAVY}`, display: 'inline-block', paddingBottom: 6, marginBottom: 12,
  },
  tabs: { display: 'flex', gap: 4, borderBottom: '1px solid #E4E8EE', marginBottom: 14 },
  tab: {
    padding: '8px 12px', background: 'none', border: 'none', cursor: 'pointer',
    fontSize: 13, color: 'var(--pagina-texto-2)', borderBottom: '2px solid transparent',
  },
  tabActive: {
    padding: '8px 12px', background: 'none', border: 'none', cursor: 'pointer',
    fontSize: 13, color: NAVY, fontWeight: 700, borderBottom: `2px solid ${NAVY}`,
  },
  checklistRow: { display: 'flex', alignItems: 'center', gap: 8, padding: '6px 0' },
  checklistText: { flex: 1, fontSize: 14, color: 'var(--pagina-texto-1)' },
  done: { textDecoration: 'line-through', color: 'var(--pagina-texto-2)' },
  removeBtn: { background: 'none', border: 'none', color: '#ef4444', cursor: 'pointer', fontSize: 13 },
  hint: { fontSize: 13, color: 'var(--pagina-texto-2)' },
  addForm: { display: 'flex', gap: 8, marginTop: 10 },
  input: {
    flex: 1, padding: '8px 10px', borderRadius: 8, border: '1px solid #d1d5db',
    fontSize: 13, fontFamily: 'inherit',
  },
  addBtn: {
    padding: '8px 14px', borderRadius: 8, border: 'none', background: NAVY,
    color: 'var(--pagina-cartao)', cursor: 'pointer', fontSize: 13, fontWeight: 600,
  },
  commentRow: { padding: '8px 0', borderBottom: '1px solid #f3f4f6' },
  commentAuthor: { fontSize: 13, color: 'var(--pagina-texto-1)', marginRight: 8 },
  commentDate: { fontSize: 11, color: 'var(--pagina-texto-2)' },
  commentText: { fontSize: 13, color: 'var(--pagina-texto-1)', margin: '4px 0 0' },
  anexoLink: {
    display: 'inline-block', marginTop: 4, fontSize: 12, fontWeight: 600, color: NAVY, textDecoration: 'none',
  },
  anexoBtn: {
    padding: '8px 10px', borderRadius: 8, border: '1px solid #d1d5db', background: 'var(--pagina-cartao)',
    cursor: 'pointer', fontSize: 14,
  },
  anexoPreview: {
    display: 'flex', alignItems: 'center', gap: 8, fontSize: 12, color: 'var(--pagina-texto-1)',
    background: 'var(--pagina-borda-suave)', borderRadius: 8, padding: '6px 10px', marginTop: 8, width: 'fit-content',
  },
  anexoRemover: { background: 'none', border: 'none', color: '#ef4444', cursor: 'pointer', fontSize: 12 },
  historyRow: {
    display: 'flex', justifyContent: 'space-between', gap: 8, padding: '6px 0',
    borderBottom: '1px solid #f3f4f6', fontSize: 12, color: 'var(--pagina-texto-2)',
  },
  historyUser: { fontWeight: 600, color: 'var(--pagina-texto-1)' },
  historyAction: { flex: 1 },
  historyDate: { color: 'var(--pagina-texto-2)' },
  footer: {
    display: 'flex', justifyContent: 'space-between', padding: '14px 20px',
    borderTop: '1px solid #E4E8EE',
  },
  deleteBtn: {
    background: 'none', border: '1px solid #ef4444', color: '#ef4444',
    padding: '8px 14px', borderRadius: 8, cursor: 'pointer', fontSize: 13,
  },
  editBtn: {
    background: NAVY, border: 'none', color: 'var(--pagina-cartao)',
    padding: '8px 14px', borderRadius: 8, cursor: 'pointer', fontSize: 13, fontWeight: 600,
  },
};
