// client/src/gestao/components/TaskFormModal.jsx
import { useEffect, useState } from 'react';
import { gestaoApi } from '../gestaoApi';

const PRIORITY_LABELS = { low: 'Baixa', medium: 'Média', high: 'Alta' };

// Formata uma data ISO pro formato que o <input type="datetime-local"> espera (sem segundos/fuso)
function toLocalInputValue(iso) {
  if (!iso) return '';
  const d = new Date(iso);
  const pad = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export default function TaskFormModal({ task, onClose, onSaved }) {
  const editando = !!task;

  const [title, setTitle] = useState(task?.title || '');
  const [description, setDescription] = useState(task?.description || '');
  const [priority, setPriority] = useState(task?.priority || 'medium');
  const [dueDate, setDueDate] = useState(toLocalInputValue(task?.due_date));
  const [assignees, setAssignees] = useState([]);
  const [assigneeIds, setAssigneeIds] = useState((task?.assignees || []).map((a) => a.id));
  const [checklistText, setChecklistText] = useState(''); // uma por linha — só na criação
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    gestaoApi.assignableUsers().then((data) => setAssignees(data.users || [])).catch(() => {});
  }, []);

  const toggleAssignee = (id) => {
    setAssigneeIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  };

  async function submit(e) {
    e.preventDefault();
    if (!title.trim()) {
      setError('Escreva um título pra tarefa.');
      return;
    }
    setSaving(true);
    setError('');
    try {
      const payload = {
        title: title.trim(),
        description: description.trim() || null,
        priority,
        due_date: dueDate ? new Date(dueDate).toISOString() : null,
        assignee_ids: assigneeIds,
      };
      if (editando) {
        await gestaoApi.updateTask(task.id, payload);
      } else {
        const itens = checklistText.split('\n').map((l) => l.trim()).filter(Boolean);
        await gestaoApi.createTask({ ...payload, checklist_items: itens.length > 0 ? itens : undefined });
      }
      onSaved();
      onClose();
    } catch (err) {
      setError(err.message || 'Não consegui salvar a tarefa.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div style={styles.overlay} onClick={onClose}>
      <form style={styles.modal} onClick={(e) => e.stopPropagation()} onSubmit={submit}>
        <div style={styles.header}>
          <h2 style={styles.title}>{editando ? 'Editar tarefa' : 'Nova tarefa'}</h2>
          <button type="button" style={styles.closeBtn} onClick={onClose}>✕</button>
        </div>

        <div style={styles.body}>
          <label style={styles.label}>Título</label>
          <input
            style={styles.input}
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Ex: Ligar pro cliente X"
            autoFocus
          />

          <label style={styles.label}>Descrição (opcional)</label>
          <textarea
            style={styles.textarea}
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Detalhes da tarefa..."
            rows={3}
          />

          <div style={styles.row2}>
            <div style={{ flex: 1 }}>
              <label style={styles.label}>Prioridade</label>
              <select style={styles.input} value={priority} onChange={(e) => setPriority(e.target.value)}>
                {Object.entries(PRIORITY_LABELS).map(([value, label]) => (
                  <option key={value} value={value}>{label}</option>
                ))}
              </select>
            </div>
            <div style={{ flex: 1 }}>
              <label style={styles.label}>Prazo (opcional)</label>
              <input
                type="datetime-local"
                style={styles.input}
                value={dueDate}
                onChange={(e) => setDueDate(e.target.value)}
              />
            </div>
          </div>

          <label style={styles.label}>Atribuir para</label>
          <div style={styles.assigneesBox}>
            {assignees.length === 0 && <p style={styles.hint}>Carregando...</p>}
            {assignees.map((u) => (
              <label key={u.id} style={styles.assigneeRow}>
                <input
                  type="checkbox"
                  checked={assigneeIds.includes(u.id)}
                  onChange={() => toggleAssignee(u.id)}
                />
                {u.name}
              </label>
            ))}
          </div>

          {!editando && (
            <>
              <label style={styles.label}>Checklist inicial (opcional, um item por linha)</label>
              <textarea
                style={styles.textarea}
                value={checklistText}
                onChange={(e) => setChecklistText(e.target.value)}
                placeholder={'Ligar pro cliente\nConfirmar pagamento'}
                rows={3}
              />
            </>
          )}

          {error && <p style={styles.error}>{error}</p>}
        </div>

        <div style={styles.footer}>
          <button type="button" style={styles.cancelBtn} onClick={onClose}>Cancelar</button>
          <button type="submit" style={styles.saveBtn} disabled={saving}>
            {saving ? 'Salvando...' : editando ? 'Salvar alterações' : 'Criar tarefa'}
          </button>
        </div>
      </form>
    </div>
  );
}

const NAVY = '#2563EB';

const styles = {
  overlay: {
    position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)',
    display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000,
  },
  modal: {
    background: '#fff', borderRadius: 12, width: '92%', maxWidth: 480,
    maxHeight: '88vh', overflowY: 'auto', boxShadow: '0 10px 40px rgba(0,0,0,0.3)',
  },
  header: {
    display: 'flex', justifyContent: 'space-between', alignItems: 'center',
    padding: '16px 20px', borderBottom: '1px solid #E4E8EE', background: NAVY,
    borderRadius: '12px 12px 0 0',
  },
  title: { margin: 0, color: '#fff', fontSize: 17 },
  closeBtn: { background: 'none', border: 'none', color: '#fff', fontSize: 18, cursor: 'pointer' },
  body: { padding: 20, display: 'flex', flexDirection: 'column' },
  label: { fontSize: 13, fontWeight: 600, color: '#374151', marginTop: 12, marginBottom: 6 },
  input: {
    padding: '9px 10px', borderRadius: 8, border: '1px solid #d1d5db',
    fontSize: 14, fontFamily: 'inherit', width: '100%', boxSizing: 'border-box',
  },
  textarea: {
    padding: '9px 10px', borderRadius: 8, border: '1px solid #d1d5db',
    fontSize: 14, fontFamily: 'inherit', width: '100%', boxSizing: 'border-box', resize: 'vertical',
  },
  row2: { display: 'flex', gap: 12 },
  assigneesBox: {
    border: '1px solid #d1d5db', borderRadius: 8, padding: '8px 10px',
    maxHeight: 140, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 6,
  },
  assigneeRow: { display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, color: '#111827', cursor: 'pointer' },
  hint: { fontSize: 13, color: '#6b7280', margin: 0 },
  error: { fontSize: 13, color: '#ef4444', marginTop: 12 },
  footer: {
    display: 'flex', justifyContent: 'flex-end', gap: 10, padding: '14px 20px',
    borderTop: '1px solid #E4E8EE',
  },
  cancelBtn: {
    background: 'none', border: '1px solid #d1d5db', color: '#374151',
    padding: '8px 14px', borderRadius: 8, cursor: 'pointer', fontSize: 13,
  },
  saveBtn: {
    background: NAVY, border: 'none', color: '#fff',
    padding: '8px 16px', borderRadius: 8, cursor: 'pointer', fontSize: 13, fontWeight: 600,
  },
};
