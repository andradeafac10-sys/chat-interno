// client/src/gestao/components/TaskFormModal.jsx
import { useEffect, useState } from 'react';
import { gestaoApi } from '../gestaoApi';

const PRIORITIES = [
  { value: 'low', label: 'Baixa' },
  { value: 'medium', label: 'Média' },
  { value: 'high', label: 'Alta' },
];

export default function TaskFormModal({ task, initialDueDate, onClose, onSaved }) {
  const isEditing = !!task;
  const [title, setTitle] = useState(task?.title || '');
  const [description, setDescription] = useState(task?.description || '');
  const [priority, setPriority] = useState(task?.priority || 'medium');
  const [dueDate, setDueDate] = useState(
    task?.due_date
      ? new Date(task.due_date).toISOString().slice(0, 16)
      : initialDueDate
      ? new Date(initialDueDate).toISOString().slice(0, 16)
      : ''
  );
  const [assignees, setAssignees] = useState(new Set((task?.assignees || []).map((a) => a.id)));
  const [checklistItems, setChecklistItems] = useState(['']);
  const [users, setUsers] = useState([]);
  const [loadingUsers, setLoadingUsers] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    gestaoApi
      .assignableUsers()
      .then((data) => setUsers(data.users || []))
      .catch(() => setError('Não consegui carregar a lista de responsáveis.'))
      .finally(() => setLoadingUsers(false));
  }, []);

  function toggleAssignee(id) {
    setAssignees((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function updateChecklistItem(index, value) {
    setChecklistItems((prev) => prev.map((item, i) => (i === index ? value : item)));
  }

  function addChecklistRow() {
    setChecklistItems((prev) => [...prev, '']);
  }

  function removeChecklistRow(index) {
    setChecklistItems((prev) => prev.filter((_, i) => i !== index));
  }

  async function handleSubmit(e) {
    e.preventDefault();
    if (!title.trim()) {
      setError('Escreve um título pra tarefa.');
      return;
    }
    setSaving(true);
    setError('');

    const payload = {
      title: title.trim(),
      description: description.trim() || null,
      priority,
      due_date: dueDate ? new Date(dueDate).toISOString() : null,
      assignee_ids: Array.from(assignees),
    };

    try {
      if (isEditing) {
        await gestaoApi.updateTask(task.id, payload);
      } else {
        payload.checklist_items = checklistItems.map((c) => c.trim()).filter(Boolean);
        await gestaoApi.createTask(payload);
      }
      onSaved();
    } catch (err) {
      setError(err.message || 'Não consegui salvar a tarefa.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div style={styles.overlay}>
      <div style={styles.modal} onClick={(e) => e.stopPropagation()}>
        <div style={styles.header}>
          <h2 style={styles.title}>{isEditing ? 'Editar tarefa' : 'Nova tarefa'}</h2>
        </div>

        <form onSubmit={handleSubmit} style={styles.body}>
          <label style={styles.label}>Título</label>
          <input
            style={styles.input}
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Ex: Fechar relatório mensal"
            autoFocus
          />

          <label style={styles.label}>Descrição</label>
          <textarea
            style={{ ...styles.input, minHeight: 70, resize: 'vertical' }}
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Detalhes da tarefa (opcional)"
          />

          <div style={styles.row}>
            <div style={{ flex: 1 }}>
              <label style={styles.label}>Prioridade</label>
              <select style={styles.input} value={priority} onChange={(e) => setPriority(e.target.value)}>
                {PRIORITIES.map((p) => (
                  <option key={p.value} value={p.value}>{p.label}</option>
                ))}
              </select>
            </div>
            <div style={{ flex: 1 }}>
              <label style={styles.label}>Prazo</label>
              <input
                type="datetime-local"
                style={styles.input}
                value={dueDate}
                onChange={(e) => setDueDate(e.target.value)}
              />
            </div>
          </div>

          <label style={styles.label}>Responsáveis</label>
          {loadingUsers ? (
            <p style={styles.hint}>Carregando...</p>
          ) : (
            <div style={styles.assigneeList}>
              {users.map((u) => (
                <label key={u.id} style={styles.assigneeItem}>
                  <input
                    type="checkbox"
                    checked={assignees.has(u.id)}
                    onChange={() => toggleAssignee(u.id)}
                  />
                  {u.name}
                </label>
              ))}
              {users.length === 0 && <p style={styles.hint}>Nenhum ADM ativo encontrado.</p>}
            </div>
          )}

          {!isEditing && (
            <>
              <label style={styles.label}>Checklist (opcional)</label>
              {checklistItems.map((item, index) => (
                <div key={index} style={styles.checklistRow}>
                  <input
                    style={{ ...styles.input, flex: 1 }}
                    value={item}
                    onChange={(e) => updateChecklistItem(index, e.target.value)}
                    placeholder={`Item ${index + 1}`}
                  />
                  {checklistItems.length > 1 && (
                    <button
                      type="button"
                      style={styles.removeBtn}
                      onClick={() => removeChecklistRow(index)}
                    >
                      ✕
                    </button>
                  )}
                </div>
              ))}
              <button type="button" style={styles.addRowBtn} onClick={addChecklistRow}>
                + adicionar item
              </button>
            </>
          )}

          {error && <p style={styles.error}>{error}</p>}

          <div style={styles.footer}>
            <button type="button" style={styles.cancelBtn} onClick={onClose}>Cancelar</button>
            <button type="submit" style={styles.saveBtn} disabled={saving}>
              {saving ? 'Salvando...' : isEditing ? 'Salvar alterações' : 'Criar tarefa'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

const NAVY = '#0f2a4a';
const NAVY_LIGHT = '#1c4270';

const styles = {
  overlay: {
    position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)',
    display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000,
  },
  modal: {
    background: '#fff', borderRadius: 12, width: '90%', maxWidth: 520,
    maxHeight: '88vh', overflowY: 'auto', boxShadow: '0 10px 40px rgba(0,0,0,0.3)',
  },
  header: {
    display: 'flex', justifyContent: 'space-between', alignItems: 'center',
    padding: '16px 20px', borderBottom: '1px solid #e5e7eb', background: NAVY,
    borderRadius: '12px 12px 0 0',
  },
  title: { margin: 0, color: '#fff', fontSize: 18 },
  closeBtn: { background: 'none', border: 'none', color: '#fff', fontSize: 18, cursor: 'pointer' },
  body: { padding: 20, display: 'flex', flexDirection: 'column', gap: 4 },
  label: { fontSize: 13, fontWeight: 600, color: '#374151', marginTop: 12, marginBottom: 4 },
  input: {
    width: '100%', padding: '9px 12px', borderRadius: 8, border: '1px solid #d1d5db',
    fontSize: 14, boxSizing: 'border-box', fontFamily: 'inherit',
  },
  row: { display: 'flex', gap: 12 },
  assigneeList: {
    display: 'flex', flexDirection: 'column', gap: 6, maxHeight: 130, overflowY: 'auto',
    border: '1px solid #e5e7eb', borderRadius: 8, padding: 10,
  },
  assigneeItem: { display: 'flex', alignItems: 'center', gap: 8, fontSize: 14 },
  hint: { fontSize: 13, color: '#6b7280', margin: 0 },
  checklistRow: { display: 'flex', gap: 6, alignItems: 'center', marginBottom: 6 },
  removeBtn: { background: 'none', border: 'none', color: '#ef4444', cursor: 'pointer', fontSize: 14 },
  addRowBtn: {
    alignSelf: 'flex-start', background: 'none', border: 'none', color: NAVY_LIGHT,
    cursor: 'pointer', fontSize: 13, fontWeight: 600, padding: '4px 0',
  },
  error: { color: '#ef4444', fontSize: 13, marginTop: 8 },
  footer: { display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 20 },
  cancelBtn: {
    padding: '9px 16px', borderRadius: 8, border: '1px solid #d1d5db', background: '#fff',
    cursor: 'pointer', fontSize: 14,
  },
  saveBtn: {
    padding: '9px 16px', borderRadius: 8, border: 'none', background: NAVY, color: '#fff',
    cursor: 'pointer', fontSize: 14, fontWeight: 600,
  },
};
