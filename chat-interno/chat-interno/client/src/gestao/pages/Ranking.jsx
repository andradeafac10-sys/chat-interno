// client/src/gestao/pages/Ranking.jsx
import { useEffect, useState } from 'react';
import PageHeader from '../PageHeader';
import { gestaoApi } from '../gestaoApi';

const NAVY = '#0f2a4a';
const PERIODOS = [
  { value: 'day', label: 'Hoje' },
  { value: 'week', label: 'Últimos 7 dias' },
  { value: 'month', label: 'Últimos 30 dias' },
];
const MEDALHAS = ['🥇', '🥈', '🥉'];

export default function Ranking() {
  const [periodo, setPeriodo] = useState('week');
  const [ranking, setRanking] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  async function load() {
    setLoading(true);
    setError('');
    try {
      const data = await gestaoApi.ranking(periodo);
      setRanking(data.ranking || []);
    } catch (err) {
      setError(err.message || 'Não consegui carregar o ranking.');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); /* eslint-disable-next-line */ }, [periodo]);

  return (
    <div>
      <PageHeader title="Ranking" subtitle="Cumprimento das rotinas — feitas ÷ previstas" />

      <div style={{ padding: '0 24px 32px' }}>
        <div style={styles.periodos}>
          {PERIODOS.map((p) => (
            <button
              key={p.value}
              style={periodo === p.value ? styles.periodoAtivo : styles.periodo}
              onClick={() => setPeriodo(p.value)}
            >
              {p.label}
            </button>
          ))}
        </div>

        {loading && <p style={styles.hint}>Carregando ranking...</p>}
        {error && <p style={styles.error}>{error}</p>}
        {!loading && !error && ranking.length === 0 && (
          <p style={styles.hint}>Ninguém com rotina registrada nesse período ainda.</p>
        )}

        <div style={styles.lista}>
          {ranking.map((r, i) => (
            <div key={r.id} style={styles.card}>
              <div style={styles.posicao}>{MEDALHAS[i] || `${i + 1}º`}</div>
              <div style={styles.avatar}>
                {r.name.split(' ').map((p) => p[0]).slice(0, 2).join('').toUpperCase()}
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={styles.nome}>{r.name}</div>
                <div style={styles.detalhe}>{r.feitas} de {r.total} rotinas cumpridas</div>
              </div>
              <div style={styles.percentual}>{r.percentual}%</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

const styles = {
  periodos: { display: 'flex', gap: 8, marginTop: 20, marginBottom: 20 },
  periodo: {
    padding: '7px 14px', borderRadius: 999, border: '1px solid #d1d5db', background: '#fff',
    fontSize: 13, cursor: 'pointer', color: '#374151',
  },
  periodoAtivo: {
    padding: '7px 14px', borderRadius: 999, border: `1px solid ${NAVY}`, background: NAVY,
    fontSize: 13, cursor: 'pointer', color: '#fff', fontWeight: 600,
  },
  hint: { color: '#6b7280', fontSize: 14 },
  error: { color: '#ef4444', fontSize: 14 },
  lista: { display: 'flex', flexDirection: 'column', gap: 8 },
  card: {
    display: 'flex', alignItems: 'center', gap: 12, background: '#fff', border: '1px solid #e5e7eb',
    borderRadius: 10, padding: '12px 16px',
  },
  posicao: { fontSize: 18, width: 32, textAlign: 'center', flexShrink: 0 },
  avatar: {
    width: 34, height: 34, borderRadius: '50%', background: NAVY, color: '#fff', fontSize: 12, fontWeight: 700,
    display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
  },
  nome: { fontSize: 14, fontWeight: 600, color: '#111827' },
  detalhe: { fontSize: 12, color: '#6b7280', marginTop: 2 },
  percentual: { fontSize: 18, fontWeight: 700, color: NAVY, flexShrink: 0 },
};
