// client/src/gestao/pages/VisaoGeral.jsx
import { useEffect, useState } from 'react';
import { Target, Calendar, CheckCircle2, Clock, Users, Activity, ChevronDown } from 'lucide-react';
import { gestaoApi } from '../gestaoApi';
import { fileUrl } from '../../api';

const MEDALHAS = [
  { bg: '#FEF3C7', fg: '#B45309' },
  { bg: 'var(--pagina-borda-suave)', fg: '#64748B' },
  { bg: '#FFEDD5', fg: '#C2410C' },
];

function hojeISO() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function fmtHora(h) {
  return h ? h.slice(0, 5) : '';
}

function fmtRelativo(iso) {
  const diffMin = Math.round((Date.now() - new Date(iso).getTime()) / 60000);
  if (diffMin < 1) return 'agora';
  if (diffMin < 60) return `${diffMin} min atrás`;
  const diffH = Math.round(diffMin / 60);
  if (diffH < 24) return `${diffH}h atrás`;
  return new Date(iso).toLocaleDateString('pt-BR');
}

export default function VisaoGeral() {
  const [periodo, setPeriodo] = useState('day');
  const [dataDe, setDataDe] = useState(hojeISO());
  const [dataAte, setDataAte] = useState(hojeISO());
  const [mostrarCalendario, setMostrarCalendario] = useState(false);
  const [pessoaSelecionada, setPessoaSelecionada] = useState(null); // { id, name, avatar_url, color }
  const [admFiltro, setAdmFiltro] = useState('');
  const [adms, setAdms] = useState([]);

  const [hoje, setHoje] = useState(null);
  const [ranking, setRanking] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    gestaoApi.assignableUsers().then((data) => setAdms(data.users || [])).catch(() => {});
  }, []);

  useEffect(() => {
    setLoading(true);
    setError('');

    const paramsRanking = new URLSearchParams();
    if (periodo === 'custom') { paramsRanking.set('de', dataDe); paramsRanking.set('ate', dataAte); }
    else paramsRanking.set('periodo', periodo);
    if (admFiltro) paramsRanking.set('assignee_id', admFiltro);

    Promise.all([
      gestaoApi.visaoGeralHoje(admFiltro || undefined),
      gestaoApi.rankingComParams(paramsRanking.toString()),
    ])
      .then(([dadosHoje, dadosRanking]) => {
        setHoje(dadosHoje);
        setRanking(dadosRanking.ranking || []);
      })
      .catch((err) => setError(err.message || 'Não consegui carregar os dados.'))
      .finally(() => setLoading(false));
  }, [periodo, dataDe, dataAte, admFiltro]);

  const kpis = hoje ? [
    {
      label: 'Cumprimento', valor: `${hoje.percentual}%`, sub: `${hoje.concluidas} de ${hoje.planejadas} rotinas concluídas`,
      icon: Target, corIcone: '#2563EB', corFundo: '#EEF4FF', corNumero: '#2563EB',
    },
    {
      label: 'Rotinas planejadas', valor: hoje.planejadas, sub: 'Total de rotinas para hoje',
      icon: Calendar, corIcone: '#2563EB', corFundo: '#EEF4FF', corNumero: '#2563EB',
    },
    {
      label: 'Concluídas', valor: hoje.concluidas, sub: `${hoje.percentual}% do total planejado`,
      icon: CheckCircle2, corIcone: '#16A34A', corFundo: '#ECFDF3', corNumero: '#16A34A',
    },
    {
      label: 'Atrasadas', valor: hoje.atrasadas, sub: 'Precisam de atenção',
      icon: Clock, corIcone: '#EA4E1B', corFundo: '#FFF4ED', corNumero: '#EA4E1B',
    },
  ] : [];

  return (
    <div style={{ background: 'var(--pagina-fundo)', minHeight: '100%', padding: '24px 28px 30px' }}>
      <div style={{ marginBottom: 18 }}>
        <div style={{ fontSize: 22, fontWeight: 700, color: 'var(--pagina-texto-1)' }}>Visão Geral</div>
        <div style={{ fontSize: 14, color: 'var(--pagina-texto-2)', marginTop: 2 }}>Cumprimento de rotinas da equipe</div>
      </div>

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12, marginBottom: 16 }}>
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
          {[
            { value: 'day', label: 'Hoje' },
            { value: 'week', label: 'Essa semana' },
            { value: 'month', label: 'Esse mês' },
          ].map((p) => (
            <button
              key={p.value}
              onClick={() => { setPeriodo(p.value); setMostrarCalendario(false); }}
              style={periodo === p.value ? styles.filtroAtivo : styles.filtro}
            >
              {p.label}
            </button>
          ))}
          <button onClick={() => setMostrarCalendario((v) => !v)} style={periodo === 'custom' ? styles.filtroAtivo : styles.filtro}>
            <Calendar size={14} style={{ marginRight: 6, verticalAlign: -2 }} /> Escolher datas
          </button>
        </div>

        <div style={{ position: 'relative' }}>
          <select value={admFiltro} onChange={(e) => setAdmFiltro(e.target.value)} style={styles.selectAdm}>
            <option value="">Todos os ADMs</option>
            {adms.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
          </select>
        </div>
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
          <button onClick={() => { setPeriodo('custom'); setMostrarCalendario(false); }} style={styles.calendarioBtn}>Aplicar</button>
        </div>
      )}

      {error && <p style={{ color: '#E5484D', fontSize: 14 }}>{error}</p>}

      {!loading && !error && hoje && (
        <>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, minmax(0, 1fr))', gap: 16, marginBottom: 16 }}>
            {kpis.map((k) => (
              <div key={k.label} style={styles.kpiCard}>
                <div style={{ width: 72, height: 72, borderRadius: '50%', background: k.corFundo, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                  <k.icon size={28} color={k.corIcone} />
                </div>
                <div style={{ minWidth: 0 }}>
                  <div style={{ fontSize: 13, color: 'var(--pagina-texto-2)', marginBottom: 4 }}>{k.label}</div>
                  <div style={{ fontSize: 34, fontWeight: 700, color: k.corNumero, lineHeight: 1 }}>{k.valor}</div>
                  <div style={{ fontSize: 12, color: 'var(--pagina-texto-2)', marginTop: 4 }}>{k.sub}</div>
                </div>
              </div>
            ))}
          </div>

          <div style={styles.progressCard}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
              <span style={{ fontSize: 14, fontWeight: 600, color: 'var(--pagina-texto-1)' }}>Progresso do dia</span>
              <span style={{ fontSize: 13, color: 'var(--pagina-texto-2)' }}>
                <b style={{ color: '#2563EB' }}>{hoje.concluidas}</b> de {hoje.planejadas} rotinas concluídas
              </span>
            </div>
            <div style={{ height: 12, borderRadius: 999, background: '#EEF1F5', overflow: 'hidden' }}>
              <div style={{ height: '100%', width: `${hoje.percentual}%`, background: '#2563EB', borderRadius: 999, transition: 'width .2s' }} />
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: 16, marginBottom: 16 }}>
            <div style={styles.listCard}>
              <div style={styles.listCardHeader}>
                <Clock size={15} color="#EA4E1B" />
                <span style={styles.listCardTitulo}>Rotinas que precisam de atenção</span>
              </div>
              <div style={{ borderTop: '1px solid #EEF1F4' }}>
                {hoje.atencao.length === 0 && <div style={styles.listaVazia}>Nada atrasado agora. 🎉</div>}
                {hoje.atencao.map((r) => (
                  <div key={r.id} style={styles.listItem}>
                    <span style={{ width: 7, height: 7, borderRadius: '50%', background: '#EA4E1B', flexShrink: 0 }} />
                    <span style={styles.listItemNome}>{r.title}</span>
                    <span style={{ ...styles.listItemHora, color: '#EA4E1B', fontWeight: 700 }}>{fmtHora(r.start_time)}</span>
                  </div>
                ))}
              </div>
            </div>

            <div style={styles.listCard}>
              <div style={styles.listCardHeader}>
                <Clock size={15} color="#2563EB" />
                <span style={styles.listCardTitulo}>Próximas rotinas</span>
              </div>
              <div style={{ borderTop: '1px solid #EEF1F4' }}>
                {hoje.proximas.length === 0 && <div style={styles.listaVazia}>Nada agendado depois de agora.</div>}
                {hoje.proximas.map((r) => (
                  <div key={r.id} style={styles.listItem}>
                    <span style={{ width: 7, height: 7, borderRadius: '50%', background: '#2563EB', flexShrink: 0 }} />
                    <span style={styles.listItemNome}>{r.title}</span>
                    <span style={styles.listItemHora}>{fmtHora(r.start_time)}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: 16 }}>
            <div style={styles.listCard}>
              <div style={styles.listCardHeader}>
                <Users size={15} color="#2563EB" />
                <span style={styles.listCardTitulo}>Desempenho da equipe</span>
              </div>
              <div style={{ borderTop: '1px solid #EEF1F4', padding: '4px 18px' }}>
                {ranking.length === 0 && <div style={styles.listaVazia}>Ninguém com rotina nesse período.</div>}
                {ranking.slice(0, 6).map((r, i) => (
                  <button
                    key={r.id}
                    onClick={() => setPessoaSelecionada(r)}
                    style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '9px 0', width: '100%', background: 'none', border: 'none', cursor: 'pointer', textAlign: 'left' }}
                    onMouseEnter={(e) => (e.currentTarget.style.background = '#F8FAFC')}
                    onMouseLeave={(e) => (e.currentTarget.style.background = 'none')}
                  >
                    <span style={{
                      width: 20, height: 20, borderRadius: '50%', fontSize: 10, fontWeight: 700, flexShrink: 0,
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      background: MEDALHAS[i]?.bg || 'var(--pagina-borda-suave)', color: MEDALHAS[i]?.fg || 'var(--pagina-texto-2)',
                    }}>{i + 1}</span>
                    <div style={{ width: 28, height: 28, borderRadius: '50%', overflow: 'hidden', flexShrink: 0, background: r.color || '#2563EB' }}>
                      {r.avatar_url && <img src={fileUrl(r.avatar_url)} alt={r.name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />}
                    </div>
                    <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--pagina-texto-1)', flex: 1, minWidth: 0 }}>{r.name}</span>
                    <div style={{ width: 70, height: 6, borderRadius: 999, background: '#EEF1F5', overflow: 'hidden', flexShrink: 0 }}>
                      <div style={{ width: `${r.percentual}%`, height: '100%', background: '#2563EB' }} />
                    </div>
                    <span style={{ fontSize: 13, fontWeight: 600, color: '#2563EB', width: 34, textAlign: 'right', flexShrink: 0 }}>{r.percentual}%</span>
                  </button>
                ))}
              </div>
            </div>

            <div style={styles.listCard}>
              <div style={styles.listCardHeader}>
                <Activity size={15} color="#2563EB" />
                <span style={styles.listCardTitulo}>Atividade recente</span>
              </div>
              <div style={{ borderTop: '1px solid #EEF1F4' }}>
                {hoje.recentes.length === 0 && <div style={styles.listaVazia}>Nenhuma rotina concluída ainda hoje.</div>}
                {hoje.recentes.map((r) => (
                  <div key={r.id} style={styles.listItem}>
                    <span style={{ width: 22, height: 22, borderRadius: '50%', background: '#ECFDF3', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                      <CheckCircle2 size={13} color="#16A34A" />
                    </span>
                    <span style={styles.listItemNome}>
                      <b>{r.user_name}</b> concluiu "{r.title}"
                    </span>
                    <span style={styles.listItemHora}>{fmtRelativo(r.done_at)}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </>
      )}

      {pessoaSelecionada && (
        <ResumoPessoaModal
          pessoa={pessoaSelecionada}
          periodo={periodo}
          dataDe={dataDe}
          dataAte={dataAte}
          onClose={() => setPessoaSelecionada(null)}
        />
      )}
    </div>
  );
}

const PRIORIDADE_LABEL = { high: 'Alta', medium: 'Média', low: 'Baixa' };
const PRIORIDADE_COR = { high: '#dc2626', medium: '#f59e0b', low: '#16a34a' };

/** Resumo das atividades (feitas e pendentes) de uma pessoa específica, no
 * mesmo período que já está sendo mostrado na Visão Geral. Qualquer ADM pode
 * abrir o resumo de qualquer outro clicando no "Desempenho da equipe". */
function ResumoPessoaModal({ pessoa, periodo, dataDe, dataAte, onClose }) {
  const [dados, setDados] = useState(null);
  const [erro, setErro] = useState('');

  useEffect(() => {
    const params = new URLSearchParams();
    params.set('assignee_id', pessoa.id);
    if (periodo === 'custom') { params.set('de', dataDe); params.set('ate', dataAte); }
    else params.set('periodo', periodo);
    gestaoApi.pessoaResumo(params.toString())
      .then(setDados)
      .catch((err) => setErro(err.message || 'Não deu pra carregar o resumo dessa pessoa.'));
  }, [pessoa.id, periodo, dataDe, dataAte]);

  return (
    <div style={modalStyles.overlay} onClick={onClose}>
      <div style={modalStyles.modal} onClick={(e) => e.stopPropagation()}>
        <div style={modalStyles.header}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div style={{ width: 34, height: 34, borderRadius: '50%', overflow: 'hidden', background: pessoa.color || '#2563EB', flexShrink: 0 }}>
              {pessoa.avatar_url && <img src={fileUrl(pessoa.avatar_url)} alt={pessoa.name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />}
            </div>
            <div>
              <div style={{ fontSize: 15, fontWeight: 600, color: 'var(--pagina-texto-1)' }}>{pessoa.name}</div>
              <div style={{ fontSize: 11, color: 'var(--pagina-texto-2)' }}>Resumo de atividades</div>
            </div>
          </div>
          <button onClick={onClose} style={modalStyles.fechar}>✕</button>
        </div>

        <div style={modalStyles.body}>
          {erro && <p style={{ color: '#dc2626', fontSize: 13 }}>{erro}</p>}
          {!erro && !dados && <p style={{ color: 'var(--pagina-texto-2)', fontSize: 13 }}>Carregando...</p>}
          {dados && (
            <>
              <div style={{ display: 'flex', gap: 12, marginBottom: 18 }}>
                <div style={modalStyles.kpi}>
                  <div style={{ fontSize: 20, fontWeight: 700, color: 'var(--pagina-texto-1)' }}>{dados.total}</div>
                  <div style={{ fontSize: 11, color: 'var(--pagina-texto-2)' }}>Total</div>
                </div>
                <div style={modalStyles.kpi}>
                  <div style={{ fontSize: 20, fontWeight: 700, color: '#16a34a' }}>{dados.feitas.length}</div>
                  <div style={{ fontSize: 11, color: 'var(--pagina-texto-2)' }}>Feitas</div>
                </div>
                <div style={modalStyles.kpi}>
                  <div style={{ fontSize: 20, fontWeight: 700, color: '#dc2626' }}>{dados.pendentes.length}</div>
                  <div style={{ fontSize: 11, color: 'var(--pagina-texto-2)' }}>Pendentes</div>
                </div>
                <div style={modalStyles.kpi}>
                  <div style={{ fontSize: 20, fontWeight: 700, color: '#2563EB' }}>{dados.percentual}%</div>
                  <div style={{ fontSize: 11, color: 'var(--pagina-texto-2)' }}>Cumprimento</div>
                </div>
              </div>

              <div style={{ fontSize: 12.5, fontWeight: 600, color: 'var(--pagina-texto-1)', marginBottom: 8 }}>
                Pendentes ({dados.pendentes.length})
              </div>
              {dados.pendentes.length === 0 && <p style={{ fontSize: 12.5, color: 'var(--pagina-texto-2)', marginBottom: 16 }}>Nada pendente nesse período. 🎉</p>}
              {dados.pendentes.map((item) => (
                <div key={item.id} style={modalStyles.item}>
                  <span style={{ width: 6, height: 6, borderRadius: '50%', background: PRIORIDADE_COR[item.priority] || 'var(--pagina-texto-2)', flexShrink: 0 }} />
                  <span style={{ fontSize: 12.5, color: '#344054', flex: 1, minWidth: 0 }}>{item.title}</span>
                  <span style={{ fontSize: 11, color: 'var(--pagina-texto-2)', flexShrink: 0 }}>
                    {new Date(item.occurrence_date + 'T00:00:00').toLocaleDateString('pt-BR')} {fmtHora(item.start_time)}
                  </span>
                </div>
              ))}

              <div style={{ fontSize: 12.5, fontWeight: 600, color: 'var(--pagina-texto-1)', margin: '16px 0 8px' }}>
                Feitas ({dados.feitas.length})
              </div>
              {dados.feitas.length === 0 && <p style={{ fontSize: 12.5, color: 'var(--pagina-texto-2)' }}>Nada concluído nesse período ainda.</p>}
              {dados.feitas.map((item) => (
                <div key={item.id} style={modalStyles.item}>
                  <CheckCircle2 size={12} color="#16A34A" style={{ flexShrink: 0 }} />
                  <span style={{ fontSize: 12.5, color: '#344054', flex: 1, minWidth: 0 }}>{item.title}</span>
                  <span style={{ fontSize: 11, color: 'var(--pagina-texto-2)', flexShrink: 0 }}>
                    {new Date(item.occurrence_date + 'T00:00:00').toLocaleDateString('pt-BR')}
                  </span>
                </div>
              ))}
            </>
          )}
        </div>
      </div>
    </div>
  );
}

const modalStyles = {
  overlay: { position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 },
  modal: { background: 'var(--pagina-cartao)', borderRadius: 12, width: 440, maxHeight: '82vh', overflowY: 'auto', boxShadow: '0 10px 40px rgba(0,0,0,0.25)' },
  header: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '16px 20px', borderBottom: '1px solid #E4E8EE' },
  fechar: { background: 'none', border: 'none', color: 'var(--pagina-texto-2)', fontSize: 15, cursor: 'pointer' },
  body: { padding: 20 },
  kpi: { flex: 1, background: 'var(--pagina-fundo)', borderRadius: 8, padding: '10px 8px', textAlign: 'center' },
  item: { display: 'flex', alignItems: 'center', gap: 8, padding: '7px 4px', borderBottom: '1px solid var(--pagina-borda)' },
};

const styles = {
  filtro: {
    height: 38, padding: '0 18px', borderRadius: 7, border: '1px solid #E1E6ED', background: 'var(--pagina-cartao)',
    fontSize: 13, color: '#344054', cursor: 'pointer', display: 'flex', alignItems: 'center',
  },
  filtroAtivo: {
    height: 38, padding: '0 18px', borderRadius: 7, border: 'none', background: '#2563EB',
    fontSize: 13, color: 'var(--pagina-cartao)', fontWeight: 600, cursor: 'pointer', display: 'flex', alignItems: 'center',
  },
  selectAdm: {
    height: 38, width: 185, padding: '0 12px', borderRadius: 7, border: '1px solid #DDE3EA',
    background: 'var(--pagina-cartao)', fontSize: 13, color: '#344054', cursor: 'pointer',
  },
  calendarioBox: {
    display: 'flex', gap: 12, alignItems: 'flex-end', background: 'var(--pagina-cartao)', border: '1px solid #E4E8EE',
    borderRadius: 10, padding: 14, marginBottom: 16,
  },
  calendarioLabel: { fontSize: 11, fontWeight: 600, color: 'var(--pagina-texto-2)', display: 'block', marginBottom: 4 },
  calendarioInput: { padding: '7px 10px', borderRadius: 7, border: '1px solid #DDE3EA', fontSize: 13 },
  calendarioBtn: { padding: '8px 16px', borderRadius: 7, border: 'none', background: '#2563EB', color: 'var(--pagina-cartao)', fontSize: 13, fontWeight: 600, cursor: 'pointer' },
  kpiCard: {
    minHeight: 140, background: 'var(--pagina-cartao)', border: '1px solid #E4E8EE', borderRadius: 12,
    boxShadow: '0 1px 3px rgba(16,24,40,0.06)', padding: 20, display: 'flex', alignItems: 'center', gap: 16,
    transition: 'box-shadow 150ms ease, transform 150ms ease',
  },
  progressCard: {
    minHeight: 84, background: 'var(--pagina-cartao)', border: '1px solid #E4E8EE', borderRadius: 10,
    boxShadow: '0 1px 3px rgba(16,24,40,0.06)', padding: '18px 22px', marginBottom: 16,
  },
  listCard: {
    minHeight: 200, background: 'var(--pagina-cartao)', border: '1px solid #E4E8EE', borderRadius: 12,
    boxShadow: '0 1px 3px rgba(16,24,40,0.06)', overflow: 'hidden', display: 'flex', flexDirection: 'column',
  },
  listCardHeader: { display: 'flex', alignItems: 'center', gap: 8, padding: '16px 18px 12px' },
  listCardTitulo: { fontSize: 14, fontWeight: 600, color: 'var(--pagina-texto-1)' },
  listItem: { display: 'flex', alignItems: 'center', gap: 10, padding: '11px 18px', borderBottom: '1px solid var(--pagina-borda)' },
  listItemNome: { fontSize: 13, color: '#344054', flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' },
  listItemHora: { fontSize: 12, color: '#475467', fontWeight: 500, flexShrink: 0 },
  listaVazia: { padding: '18px', fontSize: 13, color: 'var(--pagina-texto-2)', textAlign: 'center' },
};
