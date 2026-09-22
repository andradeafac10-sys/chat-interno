// client/src/gestao/components/RecurrenceFormModal.jsx
import { useEffect, useState } from 'react';
import { gestaoApi } from '../gestaoApi';

const PRIORITY_LABELS = { low: 'Baixa', medium: 'Média', high: 'Alta' };
const RECURRENCE_LABELS = {
  daily: 'Todos os dias',
  weekdays: 'Dias úteis (seg a sex)',
  specific_days: 'Dias específicos da semana',
  monthly: 'Todo mês (mesmo dia)',
};
const DIAS_SEMANA = [
  { valor: 0, label: 'D' }, { valor: 1, label: 'S' }, { valor: 2, label: 'T' },
  { valor: 3, label: 'Q' }, { valor: 4, label: 'Q' }, { valor: 5, label: 'S' }, { valor: 6, label: 'S' },
];

export default function RecurrenceFormModal({ recurrence, onClose, onSaved }) {
  const editando = !!recurrence;

  const [title, setTitle] = useState(recurrence?.title || '');
  const [description, setDescription] = useState(recurrence?.description || '');
  const [priority, setPriority] = useState(recurrence?.priority || 'medium');
  const [recurrenceType, setRecurrenceType] = useState(recurrence?.recurrence_type || 'daily');
  const [daysOfWeek, setDaysOfWeek] = useState(recurrence?.days_of_week || []);
  const [dayOfMonth, setDayOfMonth] = useState(recurrence?.day_of_month || 1);
  const [startTime, setStartTime] = useState(recurrence?.start_time?.slice(0, 5) || '');
  const [startDate, setStartDate] = useState(recurrence?.start_date?.slice(0, 10) || new Date().toISOString().slice(0, 10));
  const [endDate, setEndDate] = useState(recurrence?.end_date?.slice(0, 10) || '');
  const [assignees, setAssignees] = useState([]);
  const [assigneeIds, setAssigneeIds] = useState((recurrence?.assignees || []).map((a) => a.id));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    gestaoApi.assignableUsers().then((data) => setAssignees(data.users || [])).catch(() => {});
  }, []);

  const toggleAssignee = (id) => {
    setAssigneeIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  };
  const toggleDia = (dia) => {
    setDaysOfWeek((prev) => (prev.includes(dia) ? prev.filter((x) => x !== dia) : [...prev, dia]));
  };

  async function submit(e) {
    e.preventDefault();
    if (!title.trim()) { setError('Escreva um título pra rotina.'); return; }
    if (recurrenceType === 'specific_days' && daysOfWeek.length === 0) { setError('Escolha pelo menos um dia da semana.'); return; }
    if (assigneeIds.length === 0) { setError('Escolha ao menos um responsável.'); return; }
    setSaving(true);
    setError('');
    try {
      const payload = {
        title: title.trim(),
        description: description.trim() || null,
        priority,
        recurrence_type: recurrenceType,
        days_of_week: recurrenceType === 'specific_days' ? daysOfWeek : [],
        day_of_month: recurrenceType === 'monthly' ? Number(dayOfMonth) : null,
        start_time: startTime || null,
        start_date: startDate,
        end_date: endDate || null,
        assignee_ids: assigneeIds,
      };
      if (editando) {
        await gestaoApi.updateRecurrence(recurrence.id, payload);
      } else {
        await gestaoApi.createRecurrence(payload);
      }
      onSaved();
      onClose();
    } catch (err) {
      setError(err.message || 'Não consegui salvar a rotina.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div style={styles.overlay} onClick={onClose}>
      <form style={styles.modal} onClick={(e) => e.stopPropagation()} onSubmit={submit}>
        <div style={styles.header}>
          <h2 style={styles.title}>{editando ? 'Editar rotina' : 'Nova rotina'}</h2>
          <button type="button" style={styles.closeBtn} onClick={onClose}>✕</button>
        </div>

        <div style={styles.body}>
          <label style={styles.label}>Título</label>
          <input
            style={styles.input}
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Ex: Ligar os computadores"
            autoFocus
          />

          <label style={styles.label}>Descrição / observação (opcional)</label>
          <textarea
            style={styles.textarea}
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Detalhes da rotina..."
            rows={2}
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
              <label style={styles.label}>Horário (opcional)</label>
              <input type="time" style={styles.input} value={startTime} onChange={(e) => setStartTime(e.target.value)} />
            </div>
          </div>

          <label style={styles.label}>Repetir</label>
          <select style={styles.input} value={recurrenceType} onChange={(e) => setRecurrenceType(e.target.value)}>
            {Object.entries(RECURRENCE_LABELS).map(([value, label]) => (
              <option key={value} value={value}>{label}</option>
            ))}
          </select>

          {recurrenceType === 'specific_days' && (
            <div style={styles.diasRow}>
              {DIAS_SEMANA.map((d) => (
                <button
                  key={d.valor}
                  type="button"
                  onClick={() => toggleDia(d.valor)}
                  style={daysOfWeek.includes(d.valor) ? styles.diaBtnAtivo : styles.diaBtn}
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
                type="number" min={1} max={31}
                style={styles.input}
                value={dayOfMonth}
                onChange={(e) => setDayOfMonth(e.target.value)}
              />
            </>
          )}

          <div style={styles.row2}>
            <div style={{ flex: 1 }}>
              <label style={styles.label}>Começa em</label>
              <input type="date" style={styles.input} value={startDate} onChange={(e) => setStartDate(e.target.value)} />
            </div>
            <div style={{ flex: 1 }}>
              <label style={styles.label}>Termina em (opcional)</label>
              <input type="date" style={styles.input} value={endDate} onChange={(e) => setEndDate(e.target.value)} />
            </div>
          </div>

          <label style={styles.label}>Responsáveis</label>
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

          {error && <p style={styles.error}>{error}</p>}
        </div>

        <div style={styles.footer}>
          <button type="button" style={styles.cancelBtn} onClick={onClose}>Cancelar</button>
          <button type="submit" style={styles.saveBtn} disabled={saving}>
            {saving ? 'Salvando...' : editando ? 'Salvar alterações' : 'Criar rotina'}
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
    display: 'flex', alignItems: 'flex-start', justifyContent: 'center',
    overflowY: 'auto', padding: '4vh 16px', zIndex: 1000,
  },
  modal: {
    background: 'var(--pagina-cartao)', borderRadius: 12, width: '92%', maxWidth: 480,
    boxShadow: '0 10px 40px rgba(0,0,0,0.3)', margin: 'auto',
  },
  header: {
    display: 'flex', justifyContent: 'space-between', alignItems: 'center',
    padding: '16px 20px', borderBottom: '1px solid #E4E8EE', background: NAVY,
    borderRadius: '12px 12px 0 0',
  },
  title: { margin: 0, color: 'var(--pagina-cartao)', fontSize: 17 },
  closeBtn: { background: 'none', border: 'none', color: 'var(--pagina-cartao)', fontSize: 18, cursor: 'pointer' },
  body: { padding: 20, display: 'flex', flexDirection: 'column' },
  label: { fontSize: 13, fontWeight: 600, color: 'var(--pagina-texto-1)', marginTop: 12, marginBottom: 6 },
  input: {
    padding: '9px 10px', borderRadius: 8, border: '1px solid var(--pagina-borda)',
    fontSize: 14, fontFamily: 'inherit', width: '100%', boxSizing: 'border-box',
    background: 'var(--pagina-cartao)', color: 'var(--pagina-texto-1)',
  },
  textarea: {
    padding: '9px 10px', borderRadius: 8, border: '1px solid var(--pagina-borda)',
    fontSize: 14, fontFamily: 'inherit', width: '100%', boxSizing: 'border-box', resize: 'vertical',
    background: 'var(--pagina-cartao)', color: 'var(--pagina-texto-1)',
  },
  row2: { display: 'flex', gap: 12 },
  diasRow: { display: 'flex', gap: 6, marginTop: 6, flexWrap: 'wrap' },
  diaBtn: {
    padding: '7px 10px', borderRadius: 8, border: '1px solid var(--pagina-borda)', background: 'var(--pagina-cartao)',
    fontSize: 12, cursor: 'pointer', color: 'var(--pagina-texto-1)',
  },
  diaBtnAtivo: {
    padding: '7px 10px', borderRadius: 8, border: `1px solid ${NAVY}`, background: NAVY,
    fontSize: 12, cursor: 'pointer', color: 'var(--pagina-cartao)', fontWeight: 600,
  },
  assigneesBox: {
    border: '1px solid var(--pagina-borda)', borderRadius: 8, padding: '8px 10px',
    maxHeight: 140, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 6,
  },
  assigneeRow: { display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, color: 'var(--pagina-texto-1)', cursor: 'pointer' },
  hint: { fontSize: 13, color: 'var(--pagina-texto-2)', margin: 0 },
  error: { fontSize: 13, color: '#ef4444', marginTop: 12 },
  footer: {
    display: 'flex', justifyContent: 'flex-end', gap: 10, padding: '14px 20px',
    borderTop: '1px solid #E4E8EE',
  },
  cancelBtn: {
    background: 'none', border: '1px solid var(--pagina-borda)', color: 'var(--pagina-texto-1)',
    padding: '8px 14px', borderRadius: 8, cursor: 'pointer', fontSize: 13,
  },
  saveBtn: {
    background: NAVY, border: 'none', color: 'var(--pagina-cartao)',
    padding: '8px 16px', borderRadius: 8, cursor: 'pointer', fontSize: 13, fontWeight: 600,
  },
};
