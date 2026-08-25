// client/src/gestao/pages/VisaoGeral.jsx
import { useEffect, useState } from 'react';
import PageHeader from '../PageHeader';
import { gestaoApi } from '../gestaoApi';

const NAVY = '#0f2a4a';

export default function VisaoGeral() {
  const [totals, setTotals] = useState(null);
  const [byAssignee, setByAssignee] = useState([]);
  const [error, setError] = useState('');

  useEffect(() => {
    gestaoApi
      .overview()
      .then((data) => {
        setTotals(data.totals);
        setByAssignee(data.by_assignee || []);
      })
      .catch((err) => setError(err.message || 'Não consegui carregar a visão geral.'));
  }, []);

  const cards = [
    { label: 'Pendentes', value: totals?.pending, color: '#6b7280' },
    { label: 'Em andamento', value: totals?.in_progress, color: '#d97706' },
    { label: 'Concluídas', value: totals?.done, color: '#16a34a' },
    { label: 'Atrasadas', value: totals?.overdue, color: '#dc2626' },
  ];

  return (
    <div>
      <PageHeader title="Visão Geral" />

      {error && <p style={styles.error}>{error}</p>}

      <div style={styles.cardsRow}>
        {cards.map((c) => (
          <div key={c.label} style={styles.card}>
            <span style={{ ...styles.cardValue, color: c.color }}>
              {c.value === undefined ? '—' : c.value}
            </span>
            <span style={styles.cardLabel}>{c.label}</span>
          </div>
        ))}
      </div>

      <h3 style={styles.sectionTitle}>Por responsável</h3>
      <div style={styles.table}>
        <div style={styles.tableHeader}>
          <span style={{ flex: 1 }}>Nome</span>
          <span style={styles.col}>Total</span>
          <span style={styles.col}>Concluídas</span>
          <span style={styles.col}>Atrasadas</span>
        </div>
        {byAssignee.map((a) => (
          <div key={a.id} style={styles.tableRow}>
            <span style={{ flex: 1 }}>{a.name}</span>
            <span style={styles.col}>{a.total}</span>
            <span style={styles.col}>{a.done}</span>
            <span style={{ ...styles.col, color: a.overdue > 0 ? '#dc2626' : '#374151', fontWeight: a.overdue > 0 ? 700 : 400 }}>
              {a.overdue}
            </span>
          </div>
        ))}
        {byAssignee.length === 0 && !error && <p style={styles.hint}>Sem dados ainda.</p>}
      </div>
    </div>
  );
}

const styles = {
  error: { color: '#ef4444', fontSize: 14 },
  cardsRow: { display: 'flex', gap: 12, flexWrap: 'wrap', marginBottom: 28 },
  card: {
    flex: '1 1 140px', background: '#fff', border: '1px solid #e5e7eb', borderRadius: 10,
    padding: '18px 16px', display: 'flex', flexDirection: 'column', gap: 4,
  },
  cardValue: { fontSize: 28, fontWeight: 700 },
  cardLabel: { fontSize: 13, color: '#6b7280' },
  sectionTitle: { fontSize: 15, color: NAVY, marginBottom: 10 },
  table: { background: '#fff', border: '1px solid #e5e7eb', borderRadius: 10, overflow: 'hidden' },
  tableHeader: {
    display: 'flex', padding: '10px 16px', background: '#f8fafc', fontSize: 12,
    fontWeight: 700, color: '#6b7280', textTransform: 'uppercase',
  },
  tableRow: {
    display: 'flex', padding: '10px 16px', borderTop: '1px solid #f1f5f9', fontSize: 14, color: '#111827',
  },
  col: { width: 100, textAlign: 'center' },
  hint: { padding: 16, fontSize: 13, color: '#6b7280', margin: 0 },
};
