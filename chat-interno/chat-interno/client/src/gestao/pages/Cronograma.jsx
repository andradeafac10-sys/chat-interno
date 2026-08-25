// client/src/gestao/pages/Cronograma.jsx
import { useEffect, useMemo, useState } from 'react';
import PageHeader from '../PageHeader';
import { gestaoApi } from '../gestaoApi';
import TaskDetailModal from '../components/TaskDetailModal';
import TaskFormModal from '../components/TaskFormModal';

const NAVY = '#0f2a4a';
const PRIORITY_COLORS = { low: '#6b7280', medium: '#d97706', high: '#dc2626' };
const DIAS_SEMANA = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];
const MESES = [
  'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
  'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro',
];

// ---------- Helpers de data (sem depender de nenhuma biblioteca externa) ----------
function chaveDia(date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}
function mesmodia(a, b) {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
}
function somarDias(date, n) {
  const d = new Date(date);
  d.setDate(d.getDate() + n);
  return d;
}
function somarMeses(date, n) {
  const d = new Date(date);
  d.setMonth(d.getMonth() + n);
  return d;
}
function inicioDaSemana(date) {
  const d = new Date(date);
  d.setDate(d.getDate() - d.getDay());
  d.setHours(0, 0, 0, 0);
  return d;
}
function gradeDoMes(date) {
  const primeiroDiaMes = new Date(date.getFullYear(), date.getMonth(), 1);
  const inicioGrade = inicioDaSemana(primeiroDiaMes);
  const dias = [];
  for (let i = 0; i < 42; i++) dias.push(somarDias(inicioGrade, i));
  return dias;
}
function horaCurta(dataStr) {
  return new Date(dataStr).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
}

export default function Cronograma() {
  const [view, setView] = useState('month'); // day | week | month
  const [anchor, setAnchor] = useState(new Date());
  const [tasks, setTasks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [openTaskId, setOpenTaskId] = useState(null);
  const [showForm, setShowForm] = useState(false);
  const [novaDataPreenchida, setNovaDataPreenchida] = useState(null);
  const [editingTask, setEditingTask] = useState(null);

  async function load() {
    setLoading(true);
    setError('');
    try {
      const data = await gestaoApi.listTasks({});
      setTasks(data.tasks || []);
    } catch (err) {
      setError(err.message || 'Não consegui carregar as tarefas.');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); }, []);

  // Agrupa as tarefas que têm prazo definido, por dia
  const tarefasPorDia = useMemo(() => {
    const mapa = {};
    for (const t of tasks) {
      if (!t.due_date) continue;
      const chave = chaveDia(new Date(t.due_date));
      (mapa[chave] ||= []).push(t);
    }
    Object.values(mapa).forEach((lista) =>
      lista.sort((a, b) => new Date(a.due_date) - new Date(b.due_date))
    );
    return mapa;
  }, [tasks]);

  const semData = useMemo(() => tasks.filter((t) => !t.due_date), [tasks]);

  function irPara(delta) {
    if (view === 'day') setAnchor((d) => somarDias(d, delta));
    else if (view === 'week') setAnchor((d) => somarDias(d, delta * 7));
    else setAnchor((d) => somarMeses(d, delta));
  }

  function tituloPeriodo() {
    if (view === 'day') {
      return `${DIAS_SEMANA[anchor.getDay()]}, ${anchor.getDate()} de ${MESES[anchor.getMonth()]}`;
    }
    if (view === 'week') {
      const inicio = inicioDaSemana(anchor);
      const fim = somarDias(inicio, 6);
      const mesmoMes = inicio.getMonth() === fim.getMonth();
      return mesmoMes
        ? `${inicio.getDate()} – ${fim.getDate()} de ${MESES[inicio.getMonth()]}`
        : `${inicio.getDate()} ${MESES[inicio.getMonth()].slice(0, 3)} – ${fim.getDate()} ${MESES[fim.getMonth()].slice(0, 3)}`;
    }
    return `${MESES[anchor.getMonth()]} de ${anchor.getFullYear()}`;
  }

  function abrirNovaTarefaNoDia(date) {
    setNovaDataPreenchida(date);
    setShowForm(true);
  }

  function CardTarefa({ task, compacto }) {
    return (
      <div
        onClick={(e) => { e.stopPropagation(); setOpenTaskId(task.id); }}
        style={compacto ? styles.chipTarefa : styles.linhaTarefa}
        title={task.title}
      >
        <span style={{ ...styles.bolinha, background: PRIORITY_COLORS[task.priority] || '#6b7280' }} />
        {task.due_date && <span style={styles.horaChip}>{horaCurta(task.due_date)}</span>}
        <span style={compacto ? styles.chipTexto : styles.linhaTexto}>{task.title}</span>
        {task.is_overdue && !compacto && <span style={styles.badgeAtraso}>Atrasada</span>}
      </div>
    );
  }

  return (
    <div>
      <PageHeader title="Cronograma" subtitle="Tarefas organizadas por dia, semana e mês" />

      <div style={{ padding: '0 24px 32px' }}>
        {/* Barra de navegação e troca de visão */}
        <div style={styles.topRow}>
          <div style={styles.navGroup}>
            <button style={styles.navBtn} onClick={() => irPara(-1)}>‹</button>
            <button style={styles.hojeBtn} onClick={() => setAnchor(new Date())}>Hoje</button>
            <button style={styles.navBtn} onClick={() => irPara(1)}>›</button>
            <span style={styles.periodo}>{tituloPeriodo()}</span>
          </div>

          <div style={styles.viewGroup}>
            {[{ k: 'day', l: 'Dia' }, { k: 'week', l: 'Semana' }, { k: 'month', l: 'Mês' }].map((v) => (
              <button
                key={v.k}
                style={view === v.k ? styles.viewBtnActive : styles.viewBtn}
                onClick={() => setView(v.k)}
              >
                {v.l}
              </button>
            ))}
            <button style={styles.newBtn} onClick={() => abrirNovaTarefaNoDia(anchor)}>+ Nova tarefa</button>
          </div>
        </div>

        {loading && <p style={styles.hint}>Carregando cronograma...</p>}
        {error && <p style={styles.error}>{error}</p>}

        {!loading && !error && view === 'month' && (
          <VisaoMes
            anchor={anchor}
            tarefasPorDia={tarefasPorDia}
            onDiaClick={(date) => { setAnchor(date); setView('day'); }}
            CardTarefa={CardTarefa}
          />
        )}

        {!loading && !error && view === 'week' && (
          <VisaoSemana
            anchor={anchor}
            tarefasPorDia={tarefasPorDia}
            onNovaTarefa={abrirNovaTarefaNoDia}
            CardTarefa={CardTarefa}
          />
        )}

        {!loading && !error && view === 'day' && (
          <VisaoDia
            anchor={anchor}
            tarefas={tarefasPorDia[chaveDia(anchor)] || []}
            onNovaTarefa={abrirNovaTarefaNoDia}
            CardTarefa={CardTarefa}
          />
        )}

        {!loading && !error && semData.length > 0 && (
          <div style={styles.semDataBox}>
            <div style={styles.semDataTitulo}>Sem prazo definido ({semData.length})</div>
            <div style={styles.semDataLista}>
              {semData.map((t) => <CardTarefa key={t.id} task={t} compacto={false} />)}
            </div>
          </div>
        )}
      </div>

      {openTaskId && (
        <TaskDetailModal
          taskId={openTaskId}
          onClose={() => setOpenTaskId(null)}
          onChanged={load}
          onEdit={(task) => { setOpenTaskId(null); setEditingTask(task); setShowForm(true); }}
        />
      )}

      {showForm && (
        <TaskFormModal
          task={editingTask}
          initialDueDate={!editingTask ? novaDataPreenchida : null}
          onClose={() => { setShowForm(false); setNovaDataPreenchida(null); setEditingTask(null); }}
          onSaved={() => { setShowForm(false); setNovaDataPreenchida(null); setEditingTask(null); load(); }}
        />
      )}
    </div>
  );
}

// ---------- Visão Mês ----------
function VisaoMes({ anchor, tarefasPorDia, onDiaClick, CardTarefa }) {
  const dias = gradeDoMes(anchor);
  const hoje = new Date();

  return (
    <div style={styles.mesGrid}>
      {DIAS_SEMANA.map((d) => <div key={d} style={styles.mesCabecalho}>{d}</div>)}
      {dias.map((dia) => {
        const chave = chaveDia(dia);
        const lista = tarefasPorDia[chave] || [];
        const foraDoMes = dia.getMonth() !== anchor.getMonth();
        const ehHoje = mesmodia(dia, hoje);
        return (
          <div
            key={chave}
            style={{ ...styles.mesCelula, opacity: foraDoMes ? 0.4 : 1 }}
            onClick={() => onDiaClick(dia)}
          >
            <div style={ehHoje ? styles.mesNumeroHoje : styles.mesNumero}>{dia.getDate()}</div>
            <div style={styles.mesLista}>
              {lista.slice(0, 3).map((t) => <CardTarefa key={t.id} task={t} compacto />)}
              {lista.length > 3 && <div style={styles.maisChip}>+{lista.length - 3} mais</div>}
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ---------- Visão Semana ----------
function VisaoSemana({ anchor, tarefasPorDia, onNovaTarefa, CardTarefa }) {
  const inicio = inicioDaSemana(anchor);
  const dias = Array.from({ length: 7 }, (_, i) => somarDias(inicio, i));
  const hoje = new Date();

  return (
    <div style={styles.semanaGrid}>
      {dias.map((dia) => {
        const chave = chaveDia(dia);
        const lista = tarefasPorDia[chave] || [];
        const ehHoje = mesmodia(dia, hoje);
        return (
          <div key={chave} style={styles.semanaColuna}>
            <div style={ehHoje ? styles.semanaCabecalhoHoje : styles.semanaCabecalho}>
              <div style={styles.semanaDiaSemana}>{DIAS_SEMANA[dia.getDay()]}</div>
              <div style={styles.semanaNumero}>{dia.getDate()}</div>
            </div>
            <div style={styles.semanaLista}>
              {lista.map((t) => <CardTarefa key={t.id} task={t} compacto />)}
              {lista.length === 0 && (
                <button style={styles.addDiaBtn} onClick={() => onNovaTarefa(dia)}>+ tarefa</button>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ---------- Visão Dia ----------
function VisaoDia({ anchor, tarefas, onNovaTarefa, CardTarefa }) {
  return (
    <div style={styles.diaBox}>
      {tarefas.length === 0 && (
        <div style={styles.diaVazio}>
          <p style={styles.hint}>Nenhuma tarefa com prazo para esse dia.</p>
          <button style={styles.newBtn} onClick={() => onNovaTarefa(anchor)}>+ Nova tarefa nesse dia</button>
        </div>
      )}
      {tarefas.map((t) => <CardTarefa key={t.id} task={t} compacto={false} />)}
    </div>
  );
}

const styles = {
  topRow: {
    display: 'flex', justifyContent: 'space-between', alignItems: 'center',
    marginTop: 20, marginBottom: 16, flexWrap: 'wrap', gap: 12,
  },
  navGroup: { display: 'flex', alignItems: 'center', gap: 8 },
  navBtn: {
    width: 30, height: 30, borderRadius: 8, border: '1px solid #d1d5db', background: '#fff',
    fontSize: 16, cursor: 'pointer', color: '#374151', lineHeight: '1',
  },
  hojeBtn: {
    padding: '6px 12px', borderRadius: 8, border: '1px solid #d1d5db', background: '#fff',
    fontSize: 13, cursor: 'pointer', color: '#374151', fontWeight: 600,
  },
  periodo: { fontSize: 15, fontWeight: 700, color: '#111827', marginLeft: 8, textTransform: 'capitalize' },
  viewGroup: { display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' },
  viewBtn: {
    padding: '7px 14px', borderRadius: 999, border: '1px solid #d1d5db', background: '#fff',
    fontSize: 13, cursor: 'pointer', color: '#374151',
  },
  viewBtnActive: {
    padding: '7px 14px', borderRadius: 999, border: `1px solid ${NAVY}`, background: NAVY,
    fontSize: 13, cursor: 'pointer', color: '#fff', fontWeight: 600,
  },
  newBtn: {
    background: NAVY, color: '#fff', border: 'none', borderRadius: 8,
    padding: '9px 16px', fontSize: 14, fontWeight: 600, cursor: 'pointer', flexShrink: 0,
  },
  hint: { color: '#6b7280', fontSize: 14 },
  error: { color: '#ef4444', fontSize: 14 },

  // Mês
  mesGrid: {
    display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 6,
  },
  mesCabecalho: {
    fontSize: 11, fontWeight: 700, color: '#6b7280', textAlign: 'center', padding: '4px 0',
  },
  mesCelula: {
    minHeight: 96, background: '#fff', border: '1px solid #e5e7eb', borderRadius: 8,
    padding: 6, cursor: 'pointer', display: 'flex', flexDirection: 'column', gap: 4,
  },
  mesNumero: { fontSize: 12, color: '#374151', fontWeight: 600 },
  mesNumeroHoje: {
    fontSize: 12, color: '#fff', fontWeight: 700, background: NAVY,
    width: 20, height: 20, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center',
  },
  mesLista: { display: 'flex', flexDirection: 'column', gap: 3 },
  maisChip: { fontSize: 10, color: '#6b7280', fontWeight: 600, paddingLeft: 2 },

  // Semana
  semanaGrid: { display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 8 },
  semanaColuna: { background: '#fff', border: '1px solid #e5e7eb', borderRadius: 8, minHeight: 260, display: 'flex', flexDirection: 'column' },
  semanaCabecalho: { textAlign: 'center', padding: '10px 0', borderBottom: '1px solid #e5e7eb' },
  semanaCabecalhoHoje: { textAlign: 'center', padding: '10px 0', borderBottom: '1px solid #e5e7eb', background: '#eef2f7' },
  semanaDiaSemana: { fontSize: 10, color: '#6b7280', fontWeight: 700, textTransform: 'uppercase' },
  semanaNumero: { fontSize: 15, color: '#111827', fontWeight: 700 },
  semanaLista: { padding: 6, display: 'flex', flexDirection: 'column', gap: 4, flex: 1 },
  addDiaBtn: {
    marginTop: 4, background: 'transparent', border: '1px dashed #d1d5db', borderRadius: 6,
    padding: '6px 0', fontSize: 11, color: '#9ca3af', cursor: 'pointer',
  },

  // Dia
  diaBox: { display: 'flex', flexDirection: 'column', gap: 8, marginTop: 8 },
  diaVazio: { textAlign: 'center', padding: '32px 0', display: 'flex', flexDirection: 'column', gap: 12, alignItems: 'center' },

  // Cartão de tarefa (compacto = chip do mês/semana; não-compacto = linha do dia)
  chipTarefa: {
    display: 'flex', alignItems: 'center', gap: 4, background: '#eef2f7', borderRadius: 5,
    padding: '2px 6px', cursor: 'pointer', overflow: 'hidden',
  },
  chipTexto: { fontSize: 10.5, color: '#1c4270', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' },
  linhaTarefa: {
    display: 'flex', alignItems: 'center', gap: 8, background: '#fff', border: '1px solid #e5e7eb',
    borderRadius: 8, padding: '10px 12px', cursor: 'pointer',
  },
  linhaTexto: { fontSize: 14, color: '#111827', flex: 1 },
  bolinha: { width: 7, height: 7, borderRadius: '50%', flexShrink: 0 },
  horaChip: { fontSize: 10.5, color: '#6b7280', fontWeight: 600, flexShrink: 0 },
  badgeAtraso: {
    background: '#dc2626', color: '#fff', fontSize: 10, fontWeight: 700,
    padding: '2px 8px', borderRadius: 999, flexShrink: 0,
  },

  semDataBox: { marginTop: 24 },
  semDataTitulo: { fontSize: 13, fontWeight: 700, color: '#6b7280', marginBottom: 8 },
  semDataLista: { display: 'flex', flexDirection: 'column', gap: 6 },
};
