// client/src/gestao/pages/MinhaRotina.jsx
import { useEffect, useMemo, useRef, useState } from 'react';
import PageHeader from '../PageHeader';
import { gestaoApi } from '../gestaoApi';

const NAVY = '#2563EB';
const DIAS_SEMANA_CURTO = ['D', 'S', 'T', 'Q', 'Q', 'S', 'S'];
const CORES_PRIORIDADE = { high: '#dc2626', medium: '#f59e0b', low: '#16a34a' };
const LABEL_PRIORIDADE = { high: 'Alta', medium: 'Média', low: 'Baixa' };

function agoraMenorQue(horaStr) {
  if (!horaStr) return false;
  const [h, m] = horaStr.split(':').map(Number);
  const agora = new Date();
  const limite = new Date();
  limite.setHours(h, m, 0, 0);
  return agora > limite;
}

export default function MinhaRotina() {
  const [hoje, setHoje] = useState([]);
  const [resumoSemana, setResumoSemana] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [detalheItem, setDetalheItem] = useState(null); // item aberto na tela de detalhe
  const [aba, setAba] = useState('ativas'); // 'ativas' | 'concluidas' — esconde o que já foi feito por padrão

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

  // Mantém a tela de detalhe sincronizada com a lista (ex: depois de marcar feito)
  useEffect(() => {
    if (!detalheItem) return;
    const atualizado = hoje.find((i) => i.id === detalheItem.id);
    if (atualizado) setDetalheItem(atualizado);
  }, [hoje]); // eslint-disable-line

  const stats = useMemo(() => {
    const total = hoje.length;
    const feitas = hoje.filter((i) => i.done).length;
    const atrasadas = hoje.filter((i) => !i.done && agoraMenorQue(i.start_time)).length;
    const pendentes = total - feitas - atrasadas;
    const percentual = total > 0 ? Math.round((feitas / total) * 100) : 0;
    return { total, feitas, atrasadas, pendentes, percentual };
  }, [hoje]);

  async function marcarFeito(item, done) {
    setHoje((prev) => prev.map((i) => (i.id === item.id ? { ...i, done } : i)));
    try {
      await gestaoApi.marcarRotina(item.id, { done });
      // Avisa a tarja do topo (que mora no Chat.jsx, fora dessa tela) que uma
      // rotina mudou de status, pra ela recalcular o número na hora.
      window.dispatchEvent(new Event('rotina:atualizada'));
    } catch (err) {
      alert(err.message || 'Não consegui marcar essa rotina.');
      setHoje((prev) => prev.map((i) => (i.id === item.id ? { ...i, done: !done } : i)));
    }
  }

  return (
    <div>
      <PageHeader title="Minha rotina" subtitle="O que você precisa fazer hoje" />

      <div style={{ padding: '0 24px 32px' }}>
        {loading && <p style={styles.hint}>Carregando...</p>}
        {error && <p style={styles.error}>{error}</p>}

        {!loading && !error && (
          <>
            {stats.total > 0 && <PainelEstatisticas stats={stats} />}

            {stats.total > 0 && (
              <div style={styles.abasRow}>
                <button
                  onClick={() => setAba('ativas')}
                  style={{ ...styles.aba, ...(aba === 'ativas' ? styles.abaAtiva : styles.abaInativa) }}
                >
                  Ativas ({stats.total - stats.feitas})
                </button>
                <button
                  onClick={() => setAba('concluidas')}
                  style={{ ...styles.aba, ...(aba === 'concluidas' ? styles.abaAtiva : styles.abaInativa) }}
                >
                  Concluídas ({stats.feitas})
                </button>
              </div>
            )}

            <div style={styles.lista}>
              {hoje.length === 0 && <p style={styles.hint}>Nenhuma rotina pra hoje. 🎉</p>}
              {hoje.length > 0 && hoje.filter((i) => (aba === 'ativas' ? !i.done : i.done)).length === 0 && (
                <p style={styles.hint}>
                  {aba === 'ativas' ? 'Nenhuma pendente — tudo feito! 🎉' : 'Nada concluído ainda hoje.'}
                </p>
              )}
              {hoje.filter((item) => (aba === 'ativas' ? !item.done : item.done)).map((item) => {
                const atrasada = !item.done && agoraMenorQue(item.start_time);
                return (
                  <button
                    key={item.id}
                    onClick={() => setDetalheItem(item)}
                    style={{
                      ...styles.item,
                      opacity: item.done ? 0.65 : 1,
                      borderLeft: `4px solid ${atrasada ? '#dc2626' : CORES_PRIORIDADE[item.priority] || '#d1d5db'}`,
                    }}
                  >
                    <div
                      style={{
                        ...styles.checkVisual,
                        background: item.done ? '#16a34a' : 'var(--pagina-cartao)',
                        borderColor: item.done ? '#16a34a' : '#d1d5db',
                      }}
                    >
                      {item.done && <span style={{ color: 'var(--pagina-cartao)', fontSize: 13 }}>✓</span>}
                    </div>
                    <div style={{ flex: 1, minWidth: 0, textAlign: 'left' }}>
                      <div style={{ ...styles.itemTexto, textDecoration: item.done ? 'line-through' : 'none' }}>
                        {item.title}
                      </div>
                      <div style={styles.itemMeta}>
                        {item.start_time && <span>{item.start_time.slice(0, 5)}</span>}
                        {atrasada && <span style={{ color: '#dc2626', fontWeight: 700 }}>Atrasada</span>}
                        {item.nota && <span>💬 tem relato</span>}
                      </div>
                    </div>
                  </button>
                );
              })}
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
                            background: pct === null ? 'var(--pagina-borda)' : pct === 100 ? '#16a34a' : pct > 0 ? '#f59e0b' : '#dc2626',
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

      {detalheItem && (
        <DetalheRotinaModal
          item={detalheItem}
          onClose={() => setDetalheItem(null)}
          onMarcarFeito={(done) => marcarFeito(detalheItem, done)}
          onAtualizado={(campos) => {
            setHoje((prev) => prev.map((i) => (i.id === detalheItem.id ? { ...i, ...campos } : i)));
          }}
        />
      )}
    </div>
  );
}

function PainelEstatisticas({ stats }) {
  const raio = 30;
  const circunferencia = 2 * Math.PI * raio;
  const preenchido = (stats.percentual / 100) * circunferencia;

  return (
    <div style={styles.painelEstat}>
      <svg width="76" height="76" viewBox="0 0 76 76" style={{ flexShrink: 0 }}>
        <circle cx="38" cy="38" r={raio} fill="none" stroke="#E4E8EE" strokeWidth="7" />
        <circle
          cx="38" cy="38" r={raio} fill="none" stroke={NAVY} strokeWidth="7" strokeLinecap="round"
          strokeDasharray={`${preenchido} ${circunferencia}`}
          transform="rotate(-90 38 38)"
        />
        <text x="38" y="43" textAnchor="middle" fontSize="16" fontWeight="700" fill={NAVY}>
          {stats.percentual}%
        </text>
      </svg>
      <div style={styles.estatGrid}>
        <div>
          <div style={styles.estatNumero}>{stats.total}</div>
          <div style={styles.estatLabel}>Total</div>
        </div>
        <div>
          <div style={{ ...styles.estatNumero, color: '#16a34a' }}>{stats.feitas}</div>
          <div style={styles.estatLabel}>Feitas</div>
        </div>
        <div>
          <div style={{ ...styles.estatNumero, color: '#f59e0b' }}>{stats.pendentes}</div>
          <div style={styles.estatLabel}>Pendentes</div>
        </div>
        <div>
          <div style={{ ...styles.estatNumero, color: '#dc2626' }}>{stats.atrasadas}</div>
          <div style={styles.estatLabel}>Atrasadas</div>
        </div>
      </div>
    </div>
  );
}

function DetalheRotinaModal({ item, onClose, onMarcarFeito, onAtualizado }) {
  const [nota, setNota] = useState(item.nota || '');
  const [salvandoNota, setSalvandoNota] = useState(false);
  const [enviandoArquivo, setEnviandoArquivo] = useState(false);
  const fileInputRef = useRef(null);

  async function salvarNota() {
    setSalvandoNota(true);
    try {
      await gestaoApi.marcarRotina(item.id, { done: item.done, nota });
      onAtualizado({ nota });
    } catch (err) {
      alert(err.message || 'Não consegui salvar o relato.');
    } finally {
      setSalvandoNota(false);
    }
  }

  async function escolherArquivo(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    setEnviandoArquivo(true);
    try {
      const { url, name } = await gestaoApi.uploadRoutineFile(file);
      await gestaoApi.marcarRotina(item.id, { done: item.done, anexo_url: url, anexo_nome: name });
      onAtualizado({ anexo_url: url, anexo_nome: name });
    } catch (err) {
      alert(err.message || 'Não consegui enviar o arquivo.');
    } finally {
      setEnviandoArquivo(false);
      e.target.value = '';
    }
  }

  return (
    <div style={styles.overlay} onClick={onClose}>
      <div style={styles.modal} onClick={(e) => e.stopPropagation()}>
        <div style={styles.modalHeader}>
          <span style={{ ...styles.prioridadeBadge, background: `${CORES_PRIORIDADE[item.priority]}15`, color: CORES_PRIORIDADE[item.priority] }}>
            ● Prioridade {LABEL_PRIORIDADE[item.priority] || 'Média'}
          </span>
        </div>

        <div style={{ padding: '4px 24px 24px' }}>
          <h2 style={styles.modalTitulo}>{item.title}</h2>
          {item.description && <p style={styles.modalDescricao}>{item.description}</p>}
          {item.start_time && <p style={styles.modalHorario}>🕐 {item.start_time.slice(0, 5)}</p>}

          <label style={styles.modalLabel}>Relato (opcional)</label>
          <textarea
            value={nota}
            onChange={(e) => setNota(e.target.value)}
            onBlur={salvarNota}
            placeholder="Escreva algo sobre essa rotina hoje..."
            style={styles.modalTextarea}
            rows={3}
          />
          {salvandoNota && <div style={styles.hintPequeno}>Salvando...</div>}

          <label style={styles.modalLabel}>Anexo (opcional)</label>
          {item.anexo_url ? (
            <a href={item.anexo_url} target="_blank" rel="noreferrer" style={styles.anexoLink}>
              📎 {item.anexo_nome || 'Ver arquivo'}
            </a>
          ) : (
            <button type="button" onClick={() => fileInputRef.current?.click()} disabled={enviandoArquivo} style={styles.anexoBtn}>
              {enviandoArquivo ? 'Enviando...' : '+ Anexar arquivo'}
            </button>
          )}
          <input ref={fileInputRef} type="file" onChange={escolherArquivo} style={{ display: 'none' }} />

          <button
            onClick={() => {
              const marcandoComoFeito = !item.done;
              onMarcarFeito(marcandoComoFeito);
              // Só fecha quando está MARCANDO como concluído — desmarcar continua
              // na tela, pra pessoa poder corrigir/rever sem precisar abrir de novo.
              if (marcandoComoFeito) onClose();
            }}
            style={{ ...styles.botaoFinalizar, background: item.done ? 'var(--pagina-texto-2)' : '#16a34a' }}
          >
            {item.done ? 'Desmarcar' : '✓ Marcar como finalizado'}
          </button>
          <button onClick={onClose} style={styles.fecharBtn}>Fechar</button>
        </div>
      </div>
    </div>
  );
}

const styles = {
  hint: { color: 'var(--pagina-texto-2)', fontSize: 14, marginTop: 20 },
  hintPequeno: { color: '#9ca3af', fontSize: 11, marginTop: 2 },
  error: { color: '#ef4444', fontSize: 14, marginTop: 20 },
  abasRow: { display: 'flex', gap: 8, marginTop: 20, marginBottom: 4 },
  aba: { border: 'none', borderRadius: 16, padding: '6px 14px', fontSize: 12, fontWeight: 500, cursor: 'pointer' },
  abaAtiva: { background: NAVY, color: 'var(--pagina-cartao)' },
  abaInativa: { background: 'var(--pagina-cartao)', color: 'var(--pagina-texto-2)', border: '1px solid #E4E8EE' },
  painelEstat: {
    marginTop: 20, background: 'var(--pagina-cartao)', border: '1px solid #E4E8EE', borderRadius: 12, padding: 18,
    display: 'flex', alignItems: 'center', gap: 20,
  },
  estatGrid: { display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 16, flex: 1 },
  estatNumero: { fontSize: 22, fontWeight: 700, color: 'var(--pagina-texto-1)' },
  estatLabel: { fontSize: 11, color: 'var(--pagina-texto-2)', marginTop: 2 },
  lista: { display: 'flex', flexDirection: 'column', gap: 8, marginTop: 20 },
  item: {
    display: 'flex', alignItems: 'center', gap: 12, background: 'var(--pagina-cartao)', border: '1px solid #E4E8EE',
    borderRadius: 10, padding: '12px 14px', cursor: 'pointer', width: '100%', textAlign: 'left',
  },
  checkVisual: {
    width: 24, height: 24, borderRadius: '50%', border: '2px solid #d1d5db', flexShrink: 0,
    display: 'flex', alignItems: 'center', justifyContent: 'center',
  },
  itemTexto: { fontSize: 14, color: 'var(--pagina-texto-1)', fontWeight: 500 },
  itemMeta: { display: 'flex', gap: 10, fontSize: 12, color: 'var(--pagina-texto-2)', marginTop: 3 },
  semanaTitulo: { fontSize: 13, fontWeight: 600, color: '#374151', marginBottom: 10 },
  semanaRow: { display: 'flex', gap: 8 },
  semanaDia: { display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 },
  semanaLetra: { fontSize: 11, color: '#9ca3af' },
  semanaBolinha: {
    width: 40, height: 40, borderRadius: '50%', color: 'var(--pagina-cartao)', fontSize: 10, fontWeight: 700,
    display: 'flex', alignItems: 'center', justifyContent: 'center',
  },
  overlay: {
    position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)',
    display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: 16,
  },
  modal: {
    background: 'var(--pagina-cartao)', borderRadius: 14, width: '100%', maxWidth: 420,
    maxHeight: '88vh', overflowY: 'auto', boxShadow: '0 10px 40px rgba(0,0,0,0.3)',
  },
  modalHeader: { padding: '18px 24px 0' },
  prioridadeBadge: { fontSize: 11, fontWeight: 700, padding: '4px 10px', borderRadius: 999 },
  modalTitulo: { fontSize: 19, fontWeight: 700, color: 'var(--pagina-texto-1)', margin: '10px 0 6px' },
  modalDescricao: { fontSize: 13.5, color: '#4b5563', lineHeight: 1.5, margin: '0 0 8px' },
  modalHorario: { fontSize: 13, color: 'var(--pagina-texto-2)', margin: '0 0 16px' },
  modalLabel: { fontSize: 12, fontWeight: 600, color: 'var(--pagina-texto-2)', display: 'block', marginBottom: 6, marginTop: 14 },
  modalTextarea: {
    width: '100%', border: '1px solid #E4E8EE', borderRadius: 8, padding: '8px 10px',
    fontSize: 13, fontFamily: 'inherit', resize: 'vertical', boxSizing: 'border-box',
  },
  anexoBtn: {
    background: '#f3f4f6', border: '1px dashed #d1d5db', borderRadius: 8, padding: '9px 14px',
    fontSize: 13, color: '#374151', cursor: 'pointer', width: '100%',
  },
  anexoLink: {
    display: 'block', background: '#eef2f7', borderRadius: 8, padding: '9px 14px',
    fontSize: 13, color: NAVY, fontWeight: 600, textDecoration: 'none',
  },
  botaoFinalizar: {
    width: '100%', border: 'none', borderRadius: 10, padding: '13px', color: 'var(--pagina-cartao)',
    fontSize: 14.5, fontWeight: 700, cursor: 'pointer', marginTop: 22,
  },
  fecharBtn: {
    width: '100%', border: 'none', background: 'none', color: 'var(--pagina-texto-2)',
    fontSize: 13, cursor: 'pointer', marginTop: 10, padding: 8,
  },
};
