// client/src/gestao/components/RecurrenceFormModal.jsx
import { useEffect, useState } from 'react';
import { gestaoApi } from '../gestaoApi';

const TIPOS = [
  { value: 'daily', label: 'Diariamente' },
  { value: 'weekdays', label: 'Segunda a sexta' },
  { value: 'specific_days', label: 'Dias específicos da semana' },
  { value: 'monthly', label: 'Mensalmente' },
];

const DIAS_SEMANA = [
  { value: 0, label: 'Dom' }, { value: 1, label: 'Seg' }, { value: 2, label: 'Ter' },
  { value: 3, label: 'Qua' }, { value: 4, label: 'Qui' }, { value: 5, label: 'Sex' }, { value: 6, label: 'Sáb' },
];

export default function RecurrenceFormModal({ recurrence, onClose, onSaved }) {
  const isEditing = !!recurrence;
  const [title, setTitle] = useState(recurrence?.title || '');
  const [description, setDescription] = useState(recurrence?.description || '');
  const [recurrenceType, setRecurrenceType] = useState(recurrence?.recurrence_type || 'weekdays');
  const [daysOfWeek, setDaysOfWeek] = useState(new Set(recurrence?.days_of_week || []));
  const [dayOfMonth, setDayOfMonth] = useState(recurrence?.day_of_month || 1);
  const [startTime, setStartTime] = useState(recurrence?.start_time?.slice(0, 5) || '09:00');
  const [startDate, setStartDate] = useState(recurrence?.start_date || new Date().toISOString().slice(0, 10));
  const [endDate, setEndDate] = useState(recurrence?.end_date || '');
  const [assignees, setAssignees] = useState(new Set((recurrence?.assignees || []).map((a) => a.id)));
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
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  }
  function toggleDia(dia) {
    setDaysOfWeek((prev) => {
      const next = new Set(prev);
      next.has(dia) ? next.delete(dia) : next.add(dia);
      return next;
    });
  }

  async function handleSubmit(e) {
    e.preventDefault();
    if (!title.trim()) return setError('Escreve o que precisa ser feito.');
    if (recurrenceType === 'specific_days' && daysOfWeek.size === 0) {
      return setError('Escolhe pelo menos um dia da semana.');
    }
    if (assignees.size === 0) return setError('Escolhe pelo menos um responsável.');

    setSaving(true);
    setError('');

    const payload = {
      title: title.trim(),
      description: description.trim() || null,
      recurrence_type: recurrenceType,
      days_of_week: recurrenceType === 'specific_days' ? Array.from(daysOfWeek) : [],
      day_of_month: recurrenceType === 'monthly' ? Number(dayOfMonth) : null,
      start_time: startTime ? `${startTime}:00` : null,
      start_date: startDate,
      end_date: endDate || null,
      assignee_ids: Array.from(assignees),
    };

    try {
      if (isEditing) await gestaoApi.updateRecurrence(recurrence.id, payload);
      else await gestaoApi.createRecurrence(payload);
      onSaved();
    } catch (err) {
      setError(err.message || 'Não consegui salvar a rotina.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div style={styles.overlay}>
      <div style={styles.modal} onClick={(e) => e.stopPropagation()}>
        <div style={styles.header}>
          <h2 style={styles.title}>{isEditing ? 'Editar rotina' : 'Nova rotina'}</h2>
        </div>

        <form onSubmit={handleSubmit} style={styles.body}>
          <label style={styles.label}>O que precisa ser feito</label>
          <input
            style={styles.input}
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Ex: Conferir pagamentos"
            autoFocus
          />

          <label style={styles.label}>Descrição (opcional)</label>
          <textarea
            style={{ ...styles.input, minHeight: 60, resize: 'vertical' }}
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Detalhes de como fazer, o que conferir etc."
          />

          <label style={styles.label}>Repetição</label>
          <select style={styles.input} value={recurrenceType} onChange={(e) => setRecurrenceType(e.target.value)}>
            {TIPOS.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
          </select>

          {recurrenceType === 'specific_days' && (
            <div style={styles.diasRow}>
              {DIAS_SEMANA.map((d) => (
                <button
                  key={d.value}
                  type="button"
                  style={daysOfWeek.has(d.value) ? styles.diaBtnAtivo : styles.diaBtn}
                  onClick={() => toggleDia(d.value)}
                >
                  {d.label}
                </button>
              ))}
            </div>
          )}

          {recurrenceType === 'monthly' && (
            <>
              <label style={styles.label}>Dia do mês</label>
              <input
                type="number" min={1} max={31} style={styles.input}
                value={dayOfMonth} onChange={(e) => setDayOfMonth(e.target.value)}
              />
            </>
          )}

          <label style={styles.label}>Horário (opcional, só pra organizar)</label>
          <input type="time" style={styles.input} value={startTime} onChange={(e) => setStartTime(e.target.value)} />

          <div style={styles.row}>
            <div style={{ flex: 1 }}>
              <label style={styles.label}>Data de início</label>
              <input type="date" style={styles.input} value={startDate} onChange={(e) => setStartDate(e.target.value)} />
            </div>
            <div style={{ flex: 1 }}>
              <label style={styles.label}>Data de término (opcional)</label>
              <input type="date" style={styles.input} value={endDate} onChange={(e) => setEndDate(e.target.value)} />
            </div>
          </div>

          <label style={styles.label}>Quem vai cumprir essa rotina</label>
          {loadingUsers ? (
            <p style={styles.hint}>Carregando...</p>
          ) : (
            <div style={styles.assigneeList}>
              {users.map((u) => (
                <label key={u.id} style={styles.assigneeItem}>
                  <input type="checkbox" checked={assignees.has(u.id)} onChange={() => toggleAssignee(u.id)} />
                  {u.name}
                </label>
              ))}
              {users.length === 0 && <p style={styles.hint}>Nenhum ADM ativo encontrado.</p>}
            </div>
          )}

          <p style={styles.avisoTexto}>
            Se marcar mais de uma pessoa, cada uma tem a própria lista pra marcar como feita —
            não é uma rotina compartilhada, é uma cópia pra cada responsável.
          </p>

          {error && <p style={styles.error}>{error}</p>}

          <div style={styles.footer}>
            <button type="button" style={styles.cancelBtn} onClick={onClose}>Cancelar</button>
            <button type="submit" style={styles.saveBtn} disabled={saving}>
              {saving ? 'Salvando...' : isEditing ? 'Salvar alterações' : 'Criar rotina'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

const NAVY = '#0f2a4a';

const styles = {
  overlay: {
    position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)',
    display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000,
  },
  modal: {
    background: '#fff', borderRadius: 12, width: '90%', maxWidth: 480,
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
    fontSize: 14, boxSizing: 'border-box', fontFamily: 'inherit', background: '#fff',
  },
  row: { display: 'flex', gap: 12 },
  diasRow: { display: 'flex', gap: 6, marginTop: 6, flexWrap: 'wrap' },
  diaBtn: {
    padding: '7px 10px', borderRadius: 8, border: '1px solid #d1d5db', background: '#fff',
    fontSize: 12, cursor: 'pointer', color: '#374151',
  },
  diaBtnAtivo: {
    padding: '7px 10px', borderRadius: 8, border: `1px solid ${NAVY}`, background: NAVY,
    fontSize: 12, cursor: 'pointer', color: '#fff', fontWeight: 600,
  },
  assigneeList: {
    display: 'flex', flexDirection: 'column', gap: 6, maxHeight: 130, overflowY: 'auto',
    border: '1px solid #e5e7eb', borderRadius: 8, padding: 10,
  },
  assigneeItem: { display: 'flex', alignItems: 'center', gap: 8, fontSize: 14 },
  hint: { fontSize: 13, color: '#6b7280', margin: 0 },
  avisoTexto: { fontSize: 12, color: '#6b7280', marginTop: 12, fontStyle: 'italic' },
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
