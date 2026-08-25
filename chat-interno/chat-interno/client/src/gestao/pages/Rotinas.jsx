// client/src/gestao/pages/Rotinas.jsx
import { useEffect, useState } from 'react';
import PageHeader from '../PageHeader';
import { gestaoApi } from '../gestaoApi';
import RecurrenceFormModal from '../components/RecurrenceFormModal';
import TaskDetailModal from '../components/TaskDetailModal';

const NAVY = '#0f2a4a';
const PRIORITY_LABELS = { low: 'Baixa', medium: 'Média', high: 'Alta' };
const PRIORITY_COLORS = { low: '#6b7280', medium: '#d97706', high: '#dc2626' };
const DIAS_SEMANA_LABEL = ['domingo', 'segunda', 'terça', 'quarta', 'quinta', 'sexta', 'sábado'];

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

export default function Rotinas() {
  const [recurrences, setRecurrences] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState(null);
  const [gerando, setGerando] = useState(false);
  const [mensagemGerar, setMensagemGerar] = useState('');
  const [openTaskId, setOpenTaskId] = useState(null);

  async function load() {
    setLoading(true);
    setError('');
    try {
      const data = await gestaoApi.listRecurrences();
      setRecurrences(data.recurrences || []);
    } catch (err) {
      setError(err.message || 'Não consegui carregar as rotinas.');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); }, []);

  async function toggleAtiva(rec) {
    try {
      await gestaoApi.updateRecurrence(rec.id, { active: !rec.active });
      load();
    } catch (err) {
      alert(err.message || 'Não consegui atualizar a rotina.');
    }
  }

  async function apagar(rec) {
    if (!confirm(`Apagar a rotina "${rec.title}"? As tarefas já criadas por ela continuam existindo.`)) return;
    try {
      await gestaoApi.deleteRecurrence(rec.id);
      load();
    } catch (err) {
      alert(err.message || 'Não consegui apagar a rotina.');
    }
  }

  async function gerarAgora() {
    setGerando(true);
    setMensagemGerar('');
    try {
      const data = await gestaoApi.generateOccurrencesNow();
      setMensagemGerar(
        data.ocorrencias_criadas > 0
          ? `${data.ocorrencias_criadas} tarefa(s) nova(s) gerada(s).`
          : 'Tudo em dia — nenhuma tarefa nova pra gerar agora.'
      );
      load();
    } catch (err) {
      setMensagemGerar(err.message || 'Não consegui gerar as ocorrências.');
    } finally {
      setGerando(false);
      setTimeout(() => setMensagemGerar(''), 5000);
    }
  }

  return (
    <div>
      <PageHeader title="Rotinas" subtitle="Tarefas que se repetem automaticamente" />

      <div style={{ padding: '0 24px 32px' }}>
        <div style={styles.topRow}>
          <button style={styles.gerarBtn} onClick={gerarAgora} disabled={gerando}>
            {gerando ? 'Gerando...' : 'Gerar ocorrências agora'}
          </button>
          <button style={styles.newBtn} onClick={() => { setEditing(null); setShowForm(true); }}>
            + Nova rotina
          </button>
        </div>

        {mensagemGerar && <p style={styles.mensagemGerar}>{mensagemGerar}</p>}

        <p style={styles.explicacao}>
          As tarefas dos próximos 14 dias de cada rotina ativa são criadas sozinhas — o servidor
          confere de tempos em tempos, e você também pode forçar agora com o botão acima.
        </p>

        {loading && <p style={styles.hint}>Carregando rotinas...</p>}
        {error && <p style={styles.error}>{error}</p>}
        {!loading && !error && recurrences.length === 0 && (
          <p style={styles.hint}>Nenhuma rotina cadastrada ainda.</p>
        )}

        <div style={styles.list}>
          {recurrences.map((r) => (
            <div key={r.id} style={styles.card}>
              <div style={styles.cardTop}>
                <span style={{ ...styles.priorityDot, background: PRIORITY_COLORS[r.priority] }} />
                <h3 style={styles.cardTitle}>{r.title}</h3>
                <span style={r.active ? styles.badgeAtiva : styles.badgeInativa}>
                  {r.active ? 'Ativa' : 'Pausada'}
                </span>
              </div>

              {r.description && <p style={styles.descricao}>{r.description}</p>}

              <div style={styles.cardMeta}>
                <span>🔁 {descreverRepeticao(r)}</span>
                {r.start_time && <span>· às {r.start_time.slice(0, 5)}</span>}
                <span>· prioridade {PRIORITY_LABELS[r.priority]}</span>
              </div>

              {(r.assignees || []).length > 0 && (
                <div style={styles.assigneesRow}>
                  {r.assignees.map((a) => <span key={a.id} style={styles.assigneeChip}>{a.name}</span>)}
                </div>
              )}

              {(r.proximas_ocorrencias || []).length > 0 && (
                <div style={styles.proximasBox}>
                  <div style={styles.proximasTitulo}>Próximas tarefas geradas:</div>
                  <div style={styles.proximasLista}>
                    {r.proximas_ocorrencias.map((t) => (
                      <button key={t.id} style={styles.proximaChip} onClick={() => setOpenTaskId(t.id)}>
                        {new Date(t.due_date).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              <div style={styles.cardFooter}>
                <button style={styles.linkBtn} onClick={() => { setEditing(r); setShowForm(true); }}>Editar</button>
                <button style={styles.linkBtn} onClick={() => toggleAtiva(r)}>
                  {r.active ? 'Pausar' : 'Reativar'}
                </button>
                <button style={styles.linkBtnPerigo} onClick={() => apagar(r)}>Apagar</button>
              </div>
            </div>
          ))}
        </div>
      </div>

      {showForm && (
        <RecurrenceFormModal
          recurrence={editing}
          onClose={() => { setShowForm(false); setEditing(null); }}
          onSaved={() => { setShowForm(false); setEditing(null); load(); }}
        />
      )}

      {openTaskId && (
        <TaskDetailModal
          taskId={openTaskId}
          onClose={() => setOpenTaskId(null)}
          onChanged={load}
          onEdit={() => {}}
        />
      )}
    </div>
  );
}

const styles = {
  topRow: {
    display: 'flex', justifyContent: 'space-between', alignItems: 'center',
    marginTop: 20, marginBottom: 8, flexWrap: 'wrap', gap: 12,
  },
  newBtn: {
    background: NAVY, color: '#fff', border: 'none', borderRadius: 8,
    padding: '9px 16px', fontSize: 14, fontWeight: 600, cursor: 'pointer',
  },
  gerarBtn: {
    background: '#fff', color: NAVY, border: `1px solid ${NAVY}`, borderRadius: 8,
    padding: '9px 16px', fontSize: 14, fontWeight: 600, cursor: 'pointer',
  },
  mensagemGerar: { color: '#16a34a', fontSize: 13, fontWeight: 600, marginTop: 4 },
  explicacao: { fontSize: 12, color: '#6b7280', marginTop: 8, marginBottom: 16, maxWidth: 620 },
  hint: { color: '#6b7280', fontSize: 14 },
  error: { color: '#ef4444', fontSize: 14 },
  list: { display: 'flex', flexDirection: 'column', gap: 10, paddingBottom: 24 },
  card: { background: '#fff', border: '1px solid #e5e7eb', borderRadius: 10, padding: 14 },
  cardTop: { display: 'flex', alignItems: 'center', gap: 8 },
  priorityDot: { width: 8, height: 8, borderRadius: '50%', flexShrink: 0 },
  cardTitle: { margin: 0, fontSize: 15, color: '#111827', flex: 1 },
  badgeAtiva: {
    background: '#dcfce7', color: '#16a34a', fontSize: 10, fontWeight: 700,
    padding: '2px 8px', borderRadius: 999,
  },
  badgeInativa: {
    background: '#f3f4f6', color: '#6b7280', fontSize: 10, fontWeight: 700,
    padding: '2px 8px', borderRadius: 999,
  },
  descricao: { fontSize: 13, color: '#4b5563', margin: '6px 0 0' },
  cardMeta: { fontSize: 12, color: '#6b7280', marginTop: 6, display: 'flex', gap: 6, flexWrap: 'wrap' },
  assigneesRow: { display: 'flex', gap: 6, marginTop: 8, flexWrap: 'wrap' },
  assigneeChip: { background: '#eef2f7', color: '#1c4270', fontSize: 11, padding: '3px 9px', borderRadius: 999 },
  proximasBox: { marginTop: 10, paddingTop: 10, borderTop: '1px dashed #e5e7eb' },
  proximasTitulo: { fontSize: 11, color: '#9ca3af', marginBottom: 4 },
  proximasLista: { display: 'flex', gap: 5, flexWrap: 'wrap' },
  proximaChip: {
    background: '#f9fafb', border: '1px solid #e5e7eb', borderRadius: 6, padding: '3px 8px',
    fontSize: 11, color: '#374151', cursor: 'pointer',
  },
  cardFooter: { display: 'flex', gap: 14, marginTop: 12 },
  linkBtn: { background: 'none', border: 'none', color: NAVY, fontSize: 12.5, fontWeight: 600, cursor: 'pointer', padding: 0 },
  linkBtnPerigo: { background: 'none', border: 'none', color: '#dc2626', fontSize: 12.5, fontWeight: 600, cursor: 'pointer', padding: 0 },
};
