// client/src/gestao/pages/VisaoGeral.jsx
// Mostra SÓ dados de rotinas (não tarefas — tarefas são de uso pessoal e não
// devem aparecer numa tela que todo ADM vê).
import { useEffect, useState } from 'react';
import PageHeader from '../PageHeader';
import { gestaoApi } from '../gestaoApi';
import { fileUrl } from '../../api';

const NAVY = '#0f2a4a';
const MEDALHAS = ['🥇', '🥈', '🥉'];

function hojeISO() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

export default function VisaoGeral() {
  const [periodo, setPeriodo] = useState('day'); // day | week | month | custom
  const [dataDe, setDataDe] = useState(hojeISO());
  const [dataAte, setDataAte] = useState(hojeISO());
  const [mostrarCalendario, setMostrarCalendario] = useState(false);
  const [admFiltro, setAdmFiltro] = useState('');
  const [adms, setAdms] = useState([]);
  const [ranking, setRanking] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    gestaoApi.assignableUsers().then((data) => setAdms(data.users || [])).catch(() => {});
  }, []);

  useEffect(() => {
    setLoading(true);
    setError('');
    const params = new URLSearchParams();
    if (periodo === 'custom') {
      params.set('de', dataDe);
      params.set('ate', dataAte);
    } else {
      params.set('periodo', periodo);
    }
    if (admFiltro) params.set('assignee_id', admFiltro);

    gestaoApi
      .rankingComParams(params.toString())
      .then((data) => setRanking(data.ranking || []))
      .catch((err) => setError(err.message || 'Não consegui carregar os dados.'))
      .finally(() => setLoading(false));
  }, [periodo, dataDe, dataAte, admFiltro]);

  const totalGeral = ranking.reduce((acc, r) => acc + r.total, 0);
  const feitasGeral = ranking.reduce((acc, r) => acc + r.feitas, 0);
  const percentualGeral = totalGeral > 0 ? Math.round((feitasGeral / totalGeral) * 100) : 0;

  return (
    <div>
      <PageHeader title="Visão Geral" subtitle="Cumprimento de rotinas da equipe" />

      <div style={{ padding: '0 24px 32px' }}>
        <div style={styles.filtrosRow}>
          <div style={styles.periodos}>
            {[
              { value: 'day', label: 'Hoje' },
              { value: 'week', label: 'Essa semana' },
              { value: 'month', label: 'Esse mês' },
            ].map((p) => (
              <button
                key={p.value}
                onClick={() => { setPeriodo(p.value); setMostrarCalendario(false); }}
                style={periodo === p.value ? styles.periodoAtivo : styles.periodo}
              >
                {p.label}
              </button>
            ))}
            <button
              onClick={() => setMostrarCalendario((v) => !v)}
              style={periodo === 'custom' ? styles.periodoAtivo : styles.periodo}
            >
              📅 Escolher datas
            </button>
          </div>

          <select value={admFiltro} onChange={(e) => setAdmFiltro(e.target.value)} style={styles.selectAdm}>
            <option value="">Todos os ADMs</option>
            {adms.map((a) => (
              <option key={a.id} value={a.id}>{a.name}</option>
            ))}
          </select>
        </div>

        {mostrarCalendario && (
          <div style={styles.calendarioBox}>
            <div>
              <label style={styles.calendarioLabel}>De</label>
              <input type="date" value={dataDe} onChange={(e) => setDataDe(e.target.value)} style={styles.calendarioInput} />
            </div>
            <div>
              <label style={styles.calendarioLabel}>Até</label>
              <input type="date" value={dataAte} onChange={(e) => setDataAte(e.target.value)} style={styles.calendarioInput} />
            </div>
            <button onClick={() => { setPeriodo('custom'); setMostrarCalendario(false); }} style={styles.calendarioBtn}>
              Aplicar
            </button>
          </div>
        )}

        {error && <p style={styles.error}>{error}</p>}

        {!loading && !error && (
          <>
            <div style={styles.percentualCard}>
              <div style={styles.percentualNumero}>{percentualGeral}%</div>
              <div style={styles.percentualTexto}>
                das rotinas cumpridas no período — {feitasGeral} de {totalGeral}
              </div>
            </div>

            <h3 style={styles.sectionTitle}>Ranking dos ADMs</h3>
            <div style={styles.lista}>
              {ranking.map((r, i) => (
                <div key={r.id} style={styles.card}>
                  <div style={styles.posicao}>{MEDALHAS[i] || `${i + 1}º`}</div>
                  <div style={styles.avatar}>
                    {r.avatar_url ? (
                      <img src={fileUrl(r.avatar_url)} alt={r.name} style={{ width: '100%', height: '100%', objectFit: 'cover', borderRadius: '50%' }} />
                    ) : (
                      r.name.split(' ').map((p) => p[0]).slice(0, 2).join('').toUpperCase()
                    )}
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={styles.nome}>{r.name}</div>
                    <div style={styles.detalhe}>{r.feitas} de {r.total} rotinas cumpridas</div>
                  </div>
                  <div style={styles.percentual}>{r.percentual}%</div>
                </div>
              ))}
              {ranking.length === 0 && <p style={styles.hint}>Ninguém com rotina registrada nesse período.</p>}
            </div>
          </>
        )}
      </div>
    </div>
  );
}

const styles = {
  filtrosRow: {
    display: 'flex', justifyContent: 'space-between', alignItems: 'center',
    flexWrap: 'wrap', gap: 12, marginTop: 20, marginBottom: 12,
  },
  periodos: { display: 'flex', gap: 8, flexWrap: 'wrap' },
  periodo: {
    padding: '7px 14px', borderRadius: 999, border: '1px solid #d1d5db', background: '#fff',
    fontSize: 13, cursor: 'pointer', color: '#374151',
  },
  periodoAtivo: {
    padding: '7px 14px', borderRadius: 999, border: `1px solid ${NAVY}`, background: NAVY,
    fontSize: 13, cursor: 'pointer', color: '#fff', fontWeight: 600,
  },
  selectAdm: {
    padding: '7px 12px', borderRadius: 8, border: '1px solid #d1d5db', background: '#fff', fontSize: 13, color: '#374151',
  },
  calendarioBox: {
    display: 'flex', gap: 12, alignItems: 'flex-end', background: '#fff', border: '1px solid #e5e7eb',
    borderRadius: 10, padding: 14, marginBottom: 16,
  },
  calendarioLabel: { fontSize: 11, fontWeight: 600, color: '#6b7280', display: 'block', marginBottom: 4 },
  calendarioInput: { padding: '7px 10px', borderRadius: 8, border: '1px solid #d1d5db', fontSize: 13 },
  calendarioBtn: {
    padding: '8px 16px', borderRadius: 8, border: 'none', background: NAVY, color: '#fff',
    fontSize: 13, fontWeight: 600, cursor: 'pointer',
  },
  error: { color: '#ef4444', fontSize: 14 },
  percentualCard: {
    background: NAVY, borderRadius: 12, padding: '22px 24px', marginBottom: 24,
    display: 'flex', alignItems: 'baseline', gap: 14, flexWrap: 'wrap',
  },
  percentualNumero: { fontSize: 36, fontWeight: 800, color: '#fff' },
  percentualTexto: { fontSize: 13, color: '#cbd5e1' },
  sectionTitle: { fontSize: 15, color: NAVY, marginBottom: 10, fontWeight: 700 },
  lista: { display: 'flex', flexDirection: 'column', gap: 8 },
  hint: { color: '#6b7280', fontSize: 14 },
  card: {
    display: 'flex', alignItems: 'center', gap: 12, background: '#fff', border: '1px solid #e5e7eb',
    borderRadius: 10, padding: '12px 16px',
  },
  posicao: { fontSize: 18, width: 32, textAlign: 'center', flexShrink: 0 },
  avatar: {
    width: 34, height: 34, borderRadius: '50%', background: NAVY, color: '#fff', fontSize: 12, fontWeight: 700,
    display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, overflow: 'hidden',
  },
  nome: { fontSize: 14, fontWeight: 600, color: '#111827' },
  detalhe: { fontSize: 12, color: '#6b7280', marginTop: 2 },
  percentual: { fontSize: 18, fontWeight: 700, color: NAVY, flexShrink: 0 },
};
