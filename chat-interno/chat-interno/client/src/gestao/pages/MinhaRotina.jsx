// client/src/gestao/pages/MinhaRotina.jsx
import { useEffect, useState } from 'react';
import PageHeader from '../PageHeader';
import { gestaoApi } from '../gestaoApi';

const NAVY = '#0f2a4a';
const DIAS_SEMANA_CURTO = ['D', 'S', 'T', 'Q', 'Q', 'S', 'S'];

export default function MinhaRotina() {
  const [hoje, setHoje] = useState([]);
  const [resumoSemana, setResumoSemana] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  async function load() {
    setLoading(true);
    setError('');
    try {
      const data = await gestaoApi.minhasRotinas();
      setHoje(data.hoje || []);
      setResumoSemana(data.resumoSemana || []);
    } catch (err) {
      setError(err.message || 'Não consegui carregar sua rotina.');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); }, []);

  async function marcar(item, done) {
    // Atualiza a tela na hora, sem esperar o servidor responder — sensação de lista instantânea
    setHoje((prev) => prev.map((i) => (i.id === item.id ? { ...i, done } : i)));
    try {
      await gestaoApi.marcarRotina(item.id, done);
    } catch (err) {
      alert(err.message || 'Não consegui marcar essa rotina.');
      setHoje((prev) => prev.map((i) => (i.id === item.id ? { ...i, done: !done } : i)));
    }
  }

  const feitas = hoje.filter((i) => i.done).length;
  const total = hoje.length;
  const percentual = total > 0 ? Math.round((feitas / total) * 100) : 0;

  return (
    <div>
      <PageHeader title="Minha rotina" subtitle="O que você precisa fazer hoje" />

      <div style={{ padding: '0 24px 32px' }}>
        {loading && <p style={styles.hint}>Carregando...</p>}
        {error && <p style={styles.error}>{error}</p>}

        {!loading && !error && (
          <>
            {total > 0 && (
              <div style={styles.resumoCard}>
                <div style={styles.resumoTexto}>{feitas} de {total} feitas hoje</div>
                <div style={styles.progressOuter}>
                  <div style={{ ...styles.progressInner, width: `${percentual}%` }} />
                </div>
              </div>
            )}

            <div style={styles.lista}>
              {hoje.length === 0 && (
                <p style={styles.hint}>Nenhuma rotina pra hoje. 🎉</p>
              )}
              {hoje.map((item) => (
                <label key={item.id} style={{ ...styles.item, opacity: item.done ? 0.6 : 1 }}>
                  <input
                    type="checkbox"
                    checked={item.done}
                    onChange={(e) => marcar(item, e.target.checked)}
                    style={styles.checkbox}
                  />
                  <span style={{ ...styles.itemTexto, textDecoration: item.done ? 'line-through' : 'none' }}>
                    {item.title}
                  </span>
                  {item.start_time && <span style={styles.itemHora}>{item.start_time.slice(0, 5)}</span>}
                </label>
              ))}
            </div>

            {resumoSemana.length > 0 && (
              <div style={{ marginTop: 28 }}>
                <div style={styles.semanaTitulo}>Últimos dias</div>
                <div style={styles.semanaRow}>
                  {resumoSemana.map((d) => {
                    const dia = new Date(d.occurrence_date + 'T00:00:00');
                    const pct = d.total > 0 ? Math.round((d.feitas / d.total) * 100) : null;
                    return (
                      <div key={d.occurrence_date} style={styles.semanaDia}>
                        <div style={styles.semanaLetra}>{DIAS_SEMANA_CURTO[dia.getDay()]}</div>
                        <div
                          style={{
                            ...styles.semanaBolinha,
                            background: pct === null ? '#e5e7eb' : pct === 100 ? '#16a34a' : pct > 0 ? '#f59e0b' : '#dc2626',
                          }}
                        >
                          {pct === null ? '' : `${pct}%`}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}

const styles = {
  hint: { color: '#6b7280', fontSize: 14, marginTop: 20 },
  error: { color: '#ef4444', fontSize: 14, marginTop: 20 },
  resumoCard: {
    marginTop: 20, background: '#fff', border: '1px solid #e5e7eb', borderRadius: 10, padding: 14,
  },
  resumoTexto: { fontSize: 13, fontWeight: 600, color: '#111827', marginBottom: 8 },
  progressOuter: { height: 8, background: '#e5e7eb', borderRadius: 999, overflow: 'hidden' },
  progressInner: { height: '100%', background: NAVY, transition: 'width 0.2s' },
  lista: { display: 'flex', flexDirection: 'column', gap: 8, marginTop: 16 },
  item: {
    display: 'flex', alignItems: 'center', gap: 10, background: '#fff', border: '1px solid #e5e7eb',
    borderRadius: 10, padding: '12px 14px', cursor: 'pointer',
  },
  checkbox: { width: 18, height: 18, cursor: 'pointer', accentColor: NAVY, flexShrink: 0 },
  itemTexto: { fontSize: 14, color: '#111827', flex: 1 },
  itemHora: { fontSize: 12, color: '#6b7280' },
  semanaTitulo: { fontSize: 13, fontWeight: 600, color: '#374151', marginBottom: 10 },
  semanaRow: { display: 'flex', gap: 8 },
  semanaDia: { display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 },
  semanaLetra: { fontSize: 11, color: '#9ca3af' },
  semanaBolinha: {
    width: 40, height: 40, borderRadius: '50%', color: '#fff', fontSize: 10, fontWeight: 700,
    display: 'flex', alignItems: 'center', justifyContent: 'center',
  },
};
