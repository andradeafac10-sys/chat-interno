// client/src/gestao/pages/Dashboard.jsx
import { useEffect, useState } from 'react';
import {
  LayoutDashboard, User, Users, Repeat, ClipboardCheck, Plus,
  List, Kanban as KanbanIcon, Calendar, Eye, Pencil, Trash2, AlertCircle,
  Clock, Activity, CheckCircle2, Trophy,
} from 'lucide-react';
import PageHeader from '../PageHeader';
import { gestaoApi } from '../gestaoApi';
import TaskFormModal from '../components/TaskFormModal';
import TaskDetailModal from '../components/TaskDetailModal';
import RecurrenceFormModal from '../components/RecurrenceFormModal';

const NAVY = '#2563EB';
const STATUS_LABELS = { pending: 'Pendente', in_progress: 'Em andamento', done: 'Concluída', canceled: 'Cancelada' };
const STATUS_CORES = {
  pending: { bg: '#F1F5F9', cor: '#475569' },
  in_progress: { bg: '#EFF4FF', cor: NAVY },
  done: { bg: '#ECFDF3', cor: '#16A34A' },
  canceled: { bg: '#F1F5F9', cor: '#94A3B8' },
};
const PRIORIDADE_LABELS = { low: 'Baixa', medium: 'Média', high: 'Alta' };
const PRIORIDADE_CORES = {
  low: { bg: '#ECFDF3', cor: '#16A34A' },
  medium: { bg: '#FEF3C7', cor: '#CA8A04' },
  high: { bg: '#FEE2E2', cor: '#DC2626' },
};
const DIAS_SEMANA = ['dom', 'seg', 'ter', 'qua', 'qui', 'sex', 'sáb'];
const MESES = ['Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho', 'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'];

function mesmoDia(a, b) {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
}
function gerarGradeDoMes(ano, mes) {
  const inicio = new Date(ano, mes, 1);
  inicio.setDate(inicio.getDate() - inicio.getDay());
  const dias = [];
  for (let i = 0; i < 42; i++) {
    const d = new Date(inicio);
    d.setDate(inicio.getDate() + i);
    dias.push(d);
    if (i >= 34 && d.getMonth() !== mes && d.getDay() === 6) break;
  }
  return dias;
}
function iniciais(nome) {
  return (nome || '').split(' ').map((p) => p[0]).slice(0, 2).join('').toUpperCase();
}

// Dashboard: junta rotinas e tarefas numa tela só. Abre em "Minhas" (o que é
// seu vem primeiro) e alterna pra "Toda a equipe" quando quer analisar o time.
// Não substitui nenhuma tela existente — convive com elas.
export default function Dashboard() {
  const [visao, setVisao] = useState('minhas'); // minhas | equipe
  const [loading, setLoading] = useState(true);

  // minhas
  const [minhasRotinas, setMinhasRotinas] = useState([]);
  const [minhasTarefas, setMinhasTarefas] = useState([]);

  // equipe
  const [overview, setOverview] = useState(null);
  const [rotinasEquipe, setRotinasEquipe] = useState(null);
  const [visaoHoje, setVisaoHoje] = useState(null);   // progresso, próximas, atividade recente
  const [ranking, setRanking] = useState([]);          // desempenho da equipe
  const [tarefas, setTarefas] = useState([]);

  const [filtroResponsavel, setFiltroResponsavel] = useState('');
  const [filtroStatus, setFiltroStatus] = useState('');
  const [filtroPrioridade, setFiltroPrioridade] = useState('');
  const [modoTabela, setModoTabela] = useState('lista'); // lista | kanban | calendario

  const [showTaskForm, setShowTaskForm] = useState(false);
  const [showRotinaForm, setShowRotinaForm] = useState(false);
  const [editingTask, setEditingTask] = useState(null);
  const [openTaskId, setOpenTaskId] = useState(null);

  const hoje = new Date();
  const [mesAtual, setMesAtual] = useState(new Date(hoje.getFullYear(), hoje.getMonth(), 1));

  const load = async () => {
    setLoading(true);
    try {
      if (visao === 'minhas') {
        const [rot, tar] = await Promise.all([
          gestaoApi.minhasRotinas(),
          gestaoApi.listTasks({ assignee_id: 'me' }),
        ]);
        setMinhasRotinas(rot.hoje || []);
        setMinhasTarefas(tar.tasks || []);
      } else {
        const params = {};
        if (filtroResponsavel) params.assignee_id = filtroResponsavel;
        if (filtroStatus) params.status = filtroStatus;
        const [ov, rotEq, tar, vh, rk] = await Promise.all([
          gestaoApi.overview(),
          gestaoApi.rotinasEquipeHoje(),
          gestaoApi.listTasks(params),
          gestaoApi.visaoGeralHoje(filtroResponsavel || undefined),
          gestaoApi.rankingComParams(new URLSearchParams({ periodo: 'hoje' }).toString()),
        ]);
        setOverview(ov);
        setRotinasEquipe(rotEq);
        setTarefas(tar.tasks || []);
        setVisaoHoje(vh);
        setRanking(rk.ranking || []);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, [visao, filtroResponsavel, filtroStatus]); // eslint-disable-line react-hooks/exhaustive-deps

  const apagarTarefa = async (id) => {
    if (!confirm('Apagar essa tarefa? Essa ação não tem volta.')) return;
    await gestaoApi.deleteTask(id);
    load();
  };

  // ---------- números ----------
  const tarefasFiltradas = tarefas.filter((t) => !filtroPrioridade || t.priority === filtroPrioridade);
  const totais = overview?.totals || {};
  const totalTarefas = Number(totais.total || 0);
  const pct = (n) => (totalTarefas > 0 ? Math.round((Number(n) / totalTarefas) * 100) : 0);

  const rotinasAtrasadasMinhas = minhasRotinas.filter((r) => !r.done && r.start_time && r.start_time.slice(0, 5) < hoje.toTimeString().slice(0, 5));
  const tarefasAtrasadasMinhas = minhasTarefas.filter((t) => t.is_overdue);

  const dias = gerarGradeDoMes(mesAtual.getFullYear(), mesAtual.getMonth());
  const tarefasNoDia = (dia) => tarefasFiltradas.filter((t) => t.due_date && mesmoDia(new Date(t.due_date), dia));

  // Próximos prazos: 7 dias pra frente, os mais urgentes primeiro
  const proximosPrazos = tarefasFiltradas
    .filter((t) => {
      if (!t.due_date || t.status === 'done' || t.status === 'canceled') return false;
      const d = new Date(t.due_date);
      const limite = new Date(); limite.setDate(limite.getDate() + 7);
      return d <= limite;
    })
    .sort((a, b) => new Date(a.due_date) - new Date(b.due_date))
    .slice(0, 5);

  return (
    <div className="flex-1 flex flex-col overflow-hidden">
      <PageHeader icon={LayoutDashboard} title="Dashboard" subtitle="Rotinas e tarefas num só lugar" />

      <div className="flex-1 overflow-y-auto p-6" style={{ background: 'var(--pagina-fundo)' }}>

        {/* Alternador + botões de criar */}
        <div className="flex items-center gap-2 mb-4 flex-wrap">
          <div className="flex rounded-full p-1" style={{ background: 'var(--pagina-borda-suave)' }}>
            <button
              onClick={() => setVisao('minhas')}
              className="flex items-center gap-1.5 text-[12px] font-semibold rounded-full px-4 py-1.5"
              style={visao === 'minhas' ? { background: NAVY, color: '#fff' } : { color: 'var(--pagina-texto-2)' }}
            >
              <User size={13} /> Minhas
            </button>
            <button
              onClick={() => setVisao('equipe')}
              className="flex items-center gap-1.5 text-[12px] font-semibold rounded-full px-4 py-1.5"
              style={visao === 'equipe' ? { background: NAVY, color: '#fff' } : { color: 'var(--pagina-texto-2)' }}
            >
              <Users size={13} /> Toda a equipe
            </button>
          </div>
          <div className="flex-1" />
          <button onClick={() => setShowTaskForm(true)}
            className="flex items-center gap-1.5 text-white text-[12.5px] font-medium px-3 py-2 rounded-lg" style={{ background: NAVY }}>
            <Plus size={14} /> Nova tarefa
          </button>
          <button onClick={() => setShowRotinaForm(true)}
            className="flex items-center gap-1.5 text-white text-[12.5px] font-medium px-3 py-2 rounded-lg" style={{ background: '#0B1F3A' }}>
            <Plus size={14} /> Nova rotina
          </button>
        </div>

        {loading && <p className="text-[12px]" style={{ color: 'var(--pagina-texto-2)' }}>Carregando...</p>}

        {/* ---------------- MINHAS ---------------- */}
        {!loading && visao === 'minhas' && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
            <div className="bg-white rounded-xl border p-4" style={{ borderColor: 'var(--pagina-borda)' }}>
              <div className="flex items-center gap-2 mb-3">
                <Repeat size={15} style={{ color: NAVY }} />
                <span className="text-[13px] font-semibold text-slate-800">Minhas rotinas de hoje</span>
                {rotinasAtrasadasMinhas.length > 0 && (
                  <span className="ml-auto text-[10px] font-bold rounded-full px-2 py-0.5" style={{ background: '#FEE2E2', color: '#DC2626' }}>
                    {rotinasAtrasadasMinhas.length} atrasada{rotinasAtrasadasMinhas.length > 1 ? 's' : ''}
                  </span>
                )}
              </div>
              <div className="flex gap-6 mb-3">
                <div><div className="text-[17px] font-bold text-slate-800">{minhasRotinas.length}</div><div className="text-[9.5px]" style={{ color: 'var(--pagina-texto-2)' }}>Total</div></div>
                <div><div className="text-[17px] font-bold" style={{ color: '#16A34A' }}>{minhasRotinas.filter((r) => r.done).length}</div><div className="text-[9.5px]" style={{ color: 'var(--pagina-texto-2)' }}>Feitas</div></div>
                <div><div className="text-[17px] font-bold" style={{ color: '#EAB308' }}>{minhasRotinas.filter((r) => !r.done).length}</div><div className="text-[9.5px]" style={{ color: 'var(--pagina-texto-2)' }}>Pendentes</div></div>
              </div>
              <div className="flex flex-col gap-1.5 max-h-[280px] overflow-y-auto">
                {minhasRotinas.length === 0 && <p className="text-[12px]" style={{ color: 'var(--pagina-texto-2)' }}>Nenhuma rotina pra hoje.</p>}
                {minhasRotinas.slice(0, 12).map((r) => {
                  const atrasada = !r.done && r.start_time && r.start_time.slice(0, 5) < hoje.toTimeString().slice(0, 5);
                  return (
                    <div key={r.id} className="border rounded-lg px-3 py-2"
                      style={{ borderColor: 'var(--pagina-borda)', borderLeft: `3px solid ${r.done ? '#16A34A' : atrasada ? '#DC2626' : 'var(--pagina-borda)'}` }}>
                      <div className="text-[12px] text-slate-800">{r.title}</div>
                      <div className="text-[10px] mt-0.5" style={{ color: atrasada ? '#DC2626' : 'var(--pagina-texto-2)' }}>
                        {r.start_time ? r.start_time.slice(0, 5) : 'sem horário'} · {r.done ? 'Concluída' : atrasada ? 'Atrasada' : 'Pendente'}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            <div className="bg-white rounded-xl border p-4" style={{ borderColor: 'var(--pagina-borda)' }}>
              <div className="flex items-center gap-2 mb-3">
                <ClipboardCheck size={15} style={{ color: '#7C3AED' }} />
                <span className="text-[13px] font-semibold text-slate-800">Minhas tarefas</span>
                {tarefasAtrasadasMinhas.length > 0 && (
                  <span className="ml-auto text-[10px] font-bold rounded-full px-2 py-0.5" style={{ background: '#FEE2E2', color: '#DC2626' }}>
                    {tarefasAtrasadasMinhas.length} atrasada{tarefasAtrasadasMinhas.length > 1 ? 's' : ''}
                  </span>
                )}
              </div>
              <div className="flex gap-6 mb-3">
                <div><div className="text-[17px] font-bold text-slate-800">{minhasTarefas.filter((t) => t.status !== 'done' && t.status !== 'canceled').length}</div><div className="text-[9.5px]" style={{ color: 'var(--pagina-texto-2)' }}>Em aberto</div></div>
                <div><div className="text-[17px] font-bold" style={{ color: NAVY }}>{minhasTarefas.filter((t) => t.status === 'in_progress').length}</div><div className="text-[9.5px]" style={{ color: 'var(--pagina-texto-2)' }}>Andamento</div></div>
                <div><div className="text-[17px] font-bold" style={{ color: '#16A34A' }}>{minhasTarefas.filter((t) => t.status === 'done').length}</div><div className="text-[9.5px]" style={{ color: 'var(--pagina-texto-2)' }}>Concluídas</div></div>
              </div>
              <div className="flex flex-col gap-1.5 max-h-[280px] overflow-y-auto">
                {minhasTarefas.length === 0 && <p className="text-[12px]" style={{ color: 'var(--pagina-texto-2)' }}>Nenhuma tarefa atribuída a você.</p>}
                {minhasTarefas.filter((t) => t.status !== 'done' && t.status !== 'canceled').slice(0, 12).map((t) => (
                  <button key={t.id} onClick={() => setOpenTaskId(t.id)}
                    className="text-left border rounded-lg px-3 py-2 hover:border-[#2563EB] transition-colors"
                    style={{ borderColor: 'var(--pagina-borda)', borderLeft: `3px solid ${t.is_overdue ? '#DC2626' : t.status === 'in_progress' ? NAVY : 'var(--pagina-borda)'}` }}>
                    <div className="text-[12px] text-slate-800">{t.title}</div>
                    <div className="text-[10px] mt-0.5" style={{ color: t.is_overdue ? '#DC2626' : 'var(--pagina-texto-2)' }}>
                      {t.due_date ? new Date(t.due_date).toLocaleDateString('pt-BR') : 'sem prazo'} · {t.is_overdue ? 'Atrasada' : STATUS_LABELS[t.status]} · {PRIORIDADE_LABELS[t.priority]}
                    </div>
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* ---------------- TODA A EQUIPE ---------------- */}
        {!loading && visao === 'equipe' && (
          <>
            {/* Cards de número */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-2 mb-4">
              {[
                { label: `Cumprimento de rotinas · ${visaoHoje?.concluidas || 0} de ${visaoHoje?.planejadas || 0}`, valor: `${visaoHoje?.percentual || 0}%`, cor: NAVY, bg: '#fff', borda: 'var(--pagina-borda)' },
                { label: 'Rotinas atrasadas', valor: visaoHoje?.atrasadas || 0, cor: '#EA4E1B', bg: '#FFF7ED', borda: '#FED7AA' },
                { label: 'Feedbacks pendentes', valor: visaoHoje?.feedbacksPendentes || 0, cor: '#DC2626', bg: '#FEF2F2', borda: '#FECACA' },
                { label: 'Treinamentos pendentes', valor: visaoHoje?.treinamentosPendentes || 0, cor: '#0EA5E9', bg: '#F0F9FF', borda: '#BAE6FD' },
                { label: 'Total de tarefas', valor: totais.total || 0, cor: '#101828', bg: '#fff', borda: 'var(--pagina-borda)' },
                { label: `Concluídas · ${pct(totais.done)}%`, valor: totais.done || 0, cor: '#16A34A', bg: '#F0FDF4', borda: '#BBF7D0' },
                { label: `Em andamento · ${pct(totais.in_progress)}%`, valor: totais.in_progress || 0, cor: '#CA8A04', bg: '#FFFBEB', borda: '#FDE68A' },
                { label: `Tarefas atrasadas · ${pct(totais.overdue)}%`, valor: totais.overdue || 0, cor: '#DC2626', bg: '#FEF2F2', borda: '#FECACA' },
              ].map((c, i) => (
                <div key={i} className="rounded-xl border p-3" style={{ background: c.bg, borderColor: c.borda }}>
                  <div className="text-[19px] font-bold" style={{ color: c.cor }}>{c.valor}</div>
                  <div className="text-[9.5px] mt-0.5" style={{ color: 'var(--pagina-texto-2)' }}>{c.label}</div>
                </div>
              ))}
            </div>

            {/* Progresso do dia — barra de cumprimento das rotinas */}
            {visaoHoje && (
              <div className="bg-white rounded-xl border p-4 mb-4" style={{ borderColor: 'var(--pagina-borda)' }}>
                <div className="flex items-center mb-2">
                  <span className="text-[12.5px] font-semibold text-slate-800">Progresso do dia</span>
                  <span className="ml-auto text-[11.5px]" style={{ color: 'var(--pagina-texto-2)' }}>
                    <b style={{ color: NAVY }}>{visaoHoje.concluidas}</b> de {visaoHoje.planejadas} rotinas concluídas
                  </span>
                </div>
                <div className="h-2.5 rounded-full overflow-hidden" style={{ background: 'var(--pagina-borda-suave)' }}>
                  <div className="h-full rounded-full transition-all" style={{ width: `${visaoHoje.percentual}%`, background: NAVY }} />
                </div>
              </div>
            )}

            {/* Próximas rotinas + Atividade recente */}
            {visaoHoje && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mb-4">
                <div className="bg-white rounded-xl border p-4" style={{ borderColor: 'var(--pagina-borda)' }}>
                  <div className="flex items-center gap-2 mb-2.5">
                    <Clock size={14} style={{ color: NAVY }} />
                    <span className="text-[12.5px] font-semibold text-slate-800">Próximas rotinas</span>
                  </div>
                  {(visaoHoje.proximas || []).length === 0 && (
                    <p className="text-[11.5px]" style={{ color: 'var(--pagina-texto-2)' }}>Nada mais marcado pra hoje.</p>
                  )}
                  {(visaoHoje.proximas || []).map((r) => (
                    <div key={r.id} className="flex items-center gap-2 py-1.5 border-b last:border-0" style={{ borderColor: 'var(--pagina-borda)' }}>
                      <span className="w-1.5 h-1.5 rounded-full shrink-0" style={{ background: NAVY }} />
                      <span className="text-[11.5px] flex-1 truncate" style={{ color: 'var(--pagina-texto-1)' }}>{r.title}</span>
                      <span className="text-[11px] shrink-0" style={{ color: 'var(--pagina-texto-2)' }}>{r.start_time ? r.start_time.slice(0, 5) : '—'}</span>
                    </div>
                  ))}
                </div>

                <div className="bg-white rounded-xl border p-4" style={{ borderColor: 'var(--pagina-borda)' }}>
                  <div className="flex items-center gap-2 mb-2.5">
                    <Activity size={14} style={{ color: '#16A34A' }} />
                    <span className="text-[12.5px] font-semibold text-slate-800">Atividade recente</span>
                  </div>
                  {(visaoHoje.recentes || []).length === 0 && (
                    <p className="text-[11.5px]" style={{ color: 'var(--pagina-texto-2)' }}>Nenhuma rotina concluída ainda hoje.</p>
                  )}
                  {(visaoHoje.recentes || []).map((r) => (
                    <div key={r.id} className="flex items-center gap-2 py-1.5 border-b last:border-0" style={{ borderColor: 'var(--pagina-borda)' }}>
                      <CheckCircle2 size={12} style={{ color: '#16A34A' }} className="shrink-0" />
                      <span className="text-[11.5px] flex-1 truncate" style={{ color: 'var(--pagina-texto-1)' }}>
                        <b>{r.user_name}</b> concluiu "{r.title}"
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Desempenho da equipe (ranking do dia) */}
            {ranking.length > 0 && (
              <div className="bg-white rounded-xl border p-4 mb-4" style={{ borderColor: 'var(--pagina-borda)' }}>
                <div className="flex items-center gap-2 mb-3">
                  <Trophy size={14} style={{ color: '#CA8A04' }} />
                  <span className="text-[12.5px] font-semibold text-slate-800">Desempenho da equipe</span>
                </div>
                {ranking.map((p, i) => (
                  <div key={p.id || i} className="flex items-center gap-2.5 py-1.5 border-b last:border-0" style={{ borderColor: 'var(--pagina-borda)' }}>
                    <span className="w-5 h-5 rounded-full flex items-center justify-center text-[9.5px] font-bold shrink-0"
                      style={{ background: 'var(--pagina-borda-suave)', color: 'var(--pagina-texto-1)' }}>{i + 1}</span>
                    <div className="w-6 h-6 rounded-full flex items-center justify-center text-white text-[9px] font-bold shrink-0" style={{ background: p.color || NAVY }}>
                      {iniciais(p.name)}
                    </div>
                    <span className="text-[11.5px] flex-1 truncate" style={{ color: 'var(--pagina-texto-1)' }}>{p.name}</span>
                    <div className="w-20 h-1.5 rounded-full shrink-0" style={{ background: 'var(--pagina-borda-suave)' }}>
                      <div className="h-full rounded-full" style={{ width: `${p.percentual || 0}%`, background: (p.percentual || 0) === 100 ? '#16A34A' : NAVY }} />
                    </div>
                    <span className="text-[11px] w-9 text-right shrink-0" style={{ color: 'var(--pagina-texto-2)' }}>{p.percentual || 0}%</span>
                  </div>
                ))}
              </div>
            )}

            {/* Rotinas da equipe */}
            <div className="bg-white rounded-xl border p-4 mb-4" style={{ borderColor: 'var(--pagina-borda)' }}>
              <div className="flex items-center gap-2 mb-3">
                <Repeat size={15} style={{ color: NAVY }} />
                <span className="text-[13px] font-semibold text-slate-800">Rotinas de hoje — cumprimento por pessoa</span>
              </div>
              <div className="flex gap-2 overflow-x-auto pb-1 mb-3">
                {(rotinasEquipe?.por_pessoa || []).map((p) => (
                  <div key={p.id} className="shrink-0 rounded-xl border px-3 py-2.5 min-w-[150px]" style={{ borderColor: 'var(--pagina-borda)' }}>
                    <div className="flex items-center gap-2 mb-2">
                      <div className="w-6 h-6 rounded-full flex items-center justify-center text-white text-[9px] font-bold shrink-0" style={{ background: p.color || NAVY }}>
                        {iniciais(p.name)}
                      </div>
                      <span className="text-[11.5px] font-semibold text-slate-800 truncate flex-1">{p.name}</span>
                      <span className="text-[10px] shrink-0" style={{ color: 'var(--pagina-texto-2)' }}>{p.feitas}/{p.total}</span>
                    </div>
                    <div className="h-1.5 rounded-full" style={{ background: 'var(--pagina-borda-suave)' }}>
                      <div className="h-full rounded-full" style={{ width: `${p.percentual}%`, background: p.percentual === 100 ? '#16A34A' : NAVY }} />
                    </div>
                    <div className="text-[9.5px] text-right mt-1" style={{ color: 'var(--pagina-texto-2)' }}>{p.percentual}%</div>
                  </div>
                ))}
                {(rotinasEquipe?.por_pessoa || []).length === 0 && (
                  <p className="text-[12px]" style={{ color: 'var(--pagina-texto-2)' }}>Nenhuma rotina gerada pra hoje.</p>
                )}
              </div>

              <div className="text-[11.5px] font-semibold text-slate-700 mb-1.5">Ainda não feitas</div>
              <div className="flex flex-col gap-1 max-h-[200px] overflow-y-auto">
                {(rotinasEquipe?.pendentes || []).length === 0 && (
                  <p className="text-[12px]" style={{ color: 'var(--pagina-texto-2)' }}>Tudo em dia por aqui. 🎉</p>
                )}
                {(rotinasEquipe?.pendentes || []).map((r) => (
                  <div key={r.id} className="border rounded-lg px-3 py-1.5 flex items-center gap-2"
                    style={{ borderColor: 'var(--pagina-borda)', borderLeft: `3px solid ${r.atrasada ? '#DC2626' : 'var(--pagina-borda)'}` }}>
                    {r.atrasada && <AlertCircle size={12} style={{ color: '#DC2626' }} className="shrink-0" />}
                    <span className="text-[12px] text-slate-800 flex-1 truncate">{r.title}</span>
                    <span className="text-[11px] shrink-0" style={{ color: 'var(--pagina-texto-2)' }}>{r.user_name}</span>
                    <span className="text-[10.5px] shrink-0" style={{ color: r.atrasada ? '#DC2626' : 'var(--pagina-texto-2)' }}>
                      {r.start_time ? r.start_time.slice(0, 5) : '—'}
                    </span>
                  </div>
                ))}
              </div>
            </div>

            {/* Tarefas por responsável */}
            <div className="bg-white rounded-xl border p-4 mb-4" style={{ borderColor: 'var(--pagina-borda)' }}>
              <div className="flex items-center mb-3">
                <span className="text-[13px] font-semibold text-slate-800 flex items-center gap-2">
                  <ClipboardCheck size={15} style={{ color: '#7C3AED' }} /> Tarefas por responsável
                </span>
                <span className="ml-auto text-[10.5px]" style={{ color: NAVY }}>Clique pra filtrar</span>
              </div>
              <div className="flex gap-2 overflow-x-auto pb-1">
                {(overview?.by_assignee || []).map((a) => {
                  const p = a.total > 0 ? Math.round((a.done / a.total) * 100) : 0;
                  const ativo = filtroResponsavel === String(a.id);
                  return (
                    <button key={a.id} onClick={() => setFiltroResponsavel(ativo ? '' : String(a.id))}
                      className="shrink-0 rounded-xl border px-3 py-2.5 text-left min-w-[150px]"
                      style={{ borderColor: ativo ? NAVY : 'var(--pagina-borda)', background: ativo ? '#EFF4FF' : 'transparent' }}>
                      <div className="flex items-center gap-2 mb-2">
                        <div className="w-6 h-6 rounded-full flex items-center justify-center text-white text-[9px] font-bold shrink-0" style={{ background: NAVY }}>
                          {iniciais(a.name)}
                        </div>
                        <span className="text-[11.5px] font-semibold text-slate-800 truncate flex-1">{a.name}</span>
                        <span className="text-[10px] shrink-0" style={{ color: 'var(--pagina-texto-2)' }}>{a.done}/{a.total}</span>
                      </div>
                      <div className="h-1.5 rounded-full" style={{ background: 'var(--pagina-borda-suave)' }}>
                        <div className="h-full rounded-full" style={{ width: `${p}%`, background: p === 100 ? '#16A34A' : NAVY }} />
                      </div>
                      {a.overdue > 0
                        ? <div className="text-[9.5px] mt-1" style={{ color: '#DC2626' }}>{a.overdue} atrasada{a.overdue > 1 ? 's' : ''}</div>
                        : <div className="text-[9.5px] text-right mt-1" style={{ color: 'var(--pagina-texto-2)' }}>{p}%</div>}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Tabela de tarefas */}
            <div className="bg-white rounded-xl border overflow-hidden mb-4" style={{ borderColor: 'var(--pagina-borda)' }}>
              <div className="flex items-center gap-2 px-3 py-2.5 border-b flex-wrap" style={{ borderColor: 'var(--pagina-borda)' }}>
                <span className="text-[12.5px] font-semibold text-slate-800">Tarefas</span>
                <div className="flex-1" />
                <select value={filtroStatus} onChange={(e) => setFiltroStatus(e.target.value)}
                  className="border rounded-lg px-2 py-1 text-[11.5px]" style={{ borderColor: 'var(--pagina-borda)' }}>
                  <option value="">Status: todos</option>
                  {Object.entries(STATUS_LABELS).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
                </select>
                <select value={filtroPrioridade} onChange={(e) => setFiltroPrioridade(e.target.value)}
                  className="border rounded-lg px-2 py-1 text-[11.5px]" style={{ borderColor: 'var(--pagina-borda)' }}>
                  <option value="">Prioridade: todas</option>
                  {Object.entries(PRIORIDADE_LABELS).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
                </select>
                <div className="flex rounded-lg border overflow-hidden" style={{ borderColor: 'var(--pagina-borda)' }}>
                  {[{ k: 'lista', i: List, l: 'Lista' }, { k: 'kanban', i: KanbanIcon, l: 'Kanban' }, { k: 'calendario', i: Calendar, l: 'Calendário' }].map((v) => (
                    <button key={v.k} onClick={() => setModoTabela(v.k)}
                      className="flex items-center gap-1 text-[11.5px] font-medium px-2.5 py-1"
                      style={{ background: modoTabela === v.k ? NAVY : 'transparent', color: modoTabela === v.k ? '#fff' : 'var(--pagina-texto-2)' }}>
                      <v.i size={12} /> {v.l}
                    </button>
                  ))}
                </div>
              </div>

              {modoTabela === 'lista' && (
                <table className="w-full text-[12px]">
                  <thead>
                    <tr className="border-b" style={{ borderColor: 'var(--pagina-borda)', background: '#F8FAFC' }}>
                      {['Responsável', 'Demanda', 'Prazo', 'Prioridade', 'Status', 'Obs', 'Ações'].map((h) => (
                        <th key={h} className="text-left px-3 py-2 font-semibold text-[10px] uppercase tracking-wide" style={{ color: 'var(--pagina-texto-2)' }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {tarefasFiltradas.length === 0 && (
                      <tr><td colSpan={7} className="text-center py-6 text-[12px]" style={{ color: 'var(--pagina-texto-2)' }}>Nenhuma tarefa encontrada.</td></tr>
                    )}
                    {tarefasFiltradas.map((t) => (
                      <tr key={t.id} className="border-b last:border-0" style={{ borderColor: 'var(--pagina-borda)' }}>
                        <td className="px-3 py-2 text-slate-700">{(t.assignees || []).map((a) => a.name).join(', ') || '—'}</td>
                        <td className="px-3 py-2 text-slate-800 font-medium">{t.title}</td>
                        <td className="px-3 py-2" style={{ color: t.is_overdue ? '#DC2626' : 'var(--pagina-texto-2)', fontWeight: t.is_overdue ? 600 : 400 }}>
                          {t.due_date ? new Date(t.due_date).toLocaleDateString('pt-BR') : '—'}
                        </td>
                        <td className="px-3 py-2">
                          <span className="rounded-full px-2 py-0.5 text-[10px] font-semibold" style={{ background: PRIORIDADE_CORES[t.priority]?.bg, color: PRIORIDADE_CORES[t.priority]?.cor }}>
                            {PRIORIDADE_LABELS[t.priority]}
                          </span>
                        </td>
                        <td className="px-3 py-2">
                          <span className="rounded-full px-2 py-0.5 text-[10px] font-semibold"
                            style={t.is_overdue ? { background: '#FEE2E2', color: '#DC2626' } : { background: STATUS_CORES[t.status]?.bg, color: STATUS_CORES[t.status]?.cor }}>
                            {t.is_overdue ? 'Atrasada' : STATUS_LABELS[t.status]}
                          </span>
                        </td>
                        <td className="px-3 py-2 max-w-[160px] truncate" style={{ color: 'var(--pagina-texto-2)' }} title={t.description}>{t.description || '—'}</td>
                        <td className="px-3 py-2">
                          <div className="flex items-center gap-2">
                            <button onClick={() => setOpenTaskId(t.id)} className="text-slate-400 hover:text-[#2563EB]" title="Ver"><Eye size={14} /></button>
                            <button onClick={() => setEditingTask(t)} className="text-slate-400 hover:text-[#2563EB]" title="Editar"><Pencil size={14} /></button>
                            <button onClick={() => apagarTarefa(t.id)} className="text-slate-400 hover:text-red-500" title="Apagar"><Trash2 size={14} /></button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}

              {modoTabela === 'kanban' && (
                <div className="grid grid-cols-3 gap-3 p-3">
                  {['pending', 'in_progress', 'done'].map((st) => (
                    <div key={st} className="rounded-lg border p-2.5" style={{ borderColor: 'var(--pagina-borda)' }}>
                      <div className="text-[11.5px] font-semibold mb-2" style={{ color: STATUS_CORES[st].cor }}>
                        {STATUS_LABELS[st]} ({tarefasFiltradas.filter((t) => t.status === st).length})
                      </div>
                      <div className="flex flex-col gap-1.5">
                        {tarefasFiltradas.filter((t) => t.status === st).map((t) => (
                          <button key={t.id} onClick={() => setOpenTaskId(t.id)}
                            className="text-left border rounded-lg p-2 hover:border-[#2563EB]" style={{ borderColor: 'var(--pagina-borda)' }}>
                            <div className="text-[12px] font-medium text-slate-800">{t.title}</div>
                            <div className="text-[10px] mt-0.5" style={{ color: 'var(--pagina-texto-2)' }}>{(t.assignees || []).map((a) => a.name).join(', ') || 'sem responsável'}</div>
                            {t.due_date && <div className="text-[10px] mt-0.5" style={{ color: t.is_overdue ? '#DC2626' : 'var(--pagina-texto-2)' }}>{new Date(t.due_date).toLocaleDateString('pt-BR')}</div>}
                          </button>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {modoTabela === 'calendario' && (
                <div className="p-3">
                  <div className="flex items-center gap-3 mb-3">
                    <button onClick={() => setMesAtual(new Date(mesAtual.getFullYear(), mesAtual.getMonth() - 1, 1))} style={{ color: 'var(--pagina-texto-2)' }}>‹</button>
                    <span className="text-[12.5px] font-semibold text-slate-800 min-w-[130px] text-center">{MESES[mesAtual.getMonth()]} {mesAtual.getFullYear()}</span>
                    <button onClick={() => setMesAtual(new Date(mesAtual.getFullYear(), mesAtual.getMonth() + 1, 1))} style={{ color: 'var(--pagina-texto-2)' }}>›</button>
                  </div>
                  <div className="grid grid-cols-7 gap-1 mb-1.5">
                    {DIAS_SEMANA.map((d) => <div key={d} className="text-[10.5px] text-center" style={{ color: 'var(--pagina-texto-2)' }}>{d}</div>)}
                  </div>
                  <div className="grid grid-cols-7 gap-1">
                    {dias.map((dia, i) => {
                      const doMes = dia.getMonth() === mesAtual.getMonth();
                      const ehHoje = mesmoDia(dia, hoje);
                      const doDia = tarefasNoDia(dia);
                      return (
                        <div key={i} className="min-h-[70px] rounded-md p-1.5 border"
                          style={{ borderColor: ehHoje ? NAVY : 'var(--pagina-borda)', borderWidth: ehHoje ? 2 : 1, opacity: doMes ? 1 : 0.4 }}>
                          <span className="text-[10.5px] font-medium" style={{ color: ehHoje ? NAVY : 'var(--pagina-texto-2)' }}>{dia.getDate()}</span>
                          <div className="flex flex-col gap-0.5 mt-1">
                            {doDia.slice(0, 2).map((t) => (
                              <button key={t.id} onClick={() => setOpenTaskId(t.id)}
                                className="text-[9.5px] rounded px-1 py-0.5 truncate block text-left"
                                style={{ background: t.is_overdue ? '#FEE2E2' : '#EFF4FF', color: t.is_overdue ? '#DC2626' : '#0C447C' }}>
                                {t.title}
                              </button>
                            ))}
                            {doDia.length > 2 && <span className="text-[9.5px]" style={{ color: 'var(--pagina-texto-2)' }}>+{doDia.length - 2}</span>}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>

            {/* Gráficos */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <div className="bg-white rounded-xl border p-4" style={{ borderColor: 'var(--pagina-borda)' }}>
                <div className="text-[12px] font-semibold text-slate-800 mb-3">Status das tarefas</div>
                {[
                  { l: 'Concluídas', v: totais.done || 0, c: '#16A34A' },
                  { l: 'Em andamento', v: totais.in_progress || 0, c: NAVY },
                  { l: 'Atrasadas', v: totais.overdue || 0, c: '#DC2626' },
                  { l: 'Pendentes', v: totais.pending || 0, c: '#94A3B8' },
                ].map((s) => (
                  <div key={s.l} className="flex items-center gap-2 text-[11.5px] mb-1.5" style={{ color: 'var(--pagina-texto-1)' }}>
                    <span className="w-2 h-2 rounded-full shrink-0" style={{ background: s.c }} />
                    {s.l}
                    <span className="ml-auto font-semibold">{s.v} ({pct(s.v)}%)</span>
                  </div>
                ))}
              </div>

              <div className="bg-white rounded-xl border p-4" style={{ borderColor: 'var(--pagina-borda)' }}>
                <div className="text-[12px] font-semibold text-slate-800 mb-3">Prioridade</div>
                {['high', 'medium', 'low'].map((p) => {
                  const qtd = tarefasFiltradas.filter((t) => t.priority === p).length;
                  const maxQtd = Math.max(1, ...['high', 'medium', 'low'].map((x) => tarefasFiltradas.filter((t) => t.priority === x).length));
                  return (
                    <div key={p} className="flex items-center gap-2 mb-2">
                      <span className="text-[11px] w-10" style={{ color: 'var(--pagina-texto-2)' }}>{PRIORIDADE_LABELS[p]}</span>
                      <div className="flex-1 h-2 rounded-full" style={{ background: 'var(--pagina-borda-suave)' }}>
                        <div className="h-full rounded-full" style={{ width: `${(qtd / maxQtd) * 100}%`, background: PRIORIDADE_CORES[p].cor }} />
                      </div>
                      <span className="text-[11px] font-semibold text-slate-800 w-4 text-right">{qtd}</span>
                    </div>
                  );
                })}
              </div>

              <div className="bg-white rounded-xl border p-4" style={{ borderColor: 'var(--pagina-borda)' }}>
                <div className="text-[12px] font-semibold text-slate-800 mb-3">Próximos prazos (7 dias)</div>
                {proximosPrazos.length === 0 && <p className="text-[11.5px]" style={{ color: 'var(--pagina-texto-2)' }}>Nada nos próximos dias.</p>}
                {proximosPrazos.map((t) => (
                  <button key={t.id} onClick={() => setOpenTaskId(t.id)}
                    className="w-full flex items-center gap-2 py-1 border-b last:border-0 text-left" style={{ borderColor: 'var(--pagina-borda)' }}>
                    <span className="text-[10.5px] w-10 shrink-0" style={{ color: 'var(--pagina-texto-2)' }}>{new Date(t.due_date).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })}</span>
                    <span className="text-[11px] flex-1 truncate" style={{ color: 'var(--pagina-texto-1)' }}>
                      {t.title} {(t.assignees || []).length > 0 && <span style={{ color: 'var(--pagina-texto-2)' }}>({t.assignees[0].name})</span>}
                    </span>
                    <span className="text-[9px] rounded-full px-1.5 py-0.5 font-semibold shrink-0" style={{ background: PRIORIDADE_CORES[t.priority]?.bg, color: PRIORIDADE_CORES[t.priority]?.cor }}>
                      {PRIORIDADE_LABELS[t.priority]}
                    </span>
                  </button>
                ))}
              </div>
            </div>
          </>
        )}
      </div>

      {showTaskForm && <TaskFormModal onClose={() => setShowTaskForm(false)} onSaved={() => { setShowTaskForm(false); load(); }} />}
      {editingTask && <TaskFormModal task={editingTask} onClose={() => setEditingTask(null)} onSaved={() => { setEditingTask(null); load(); }} />}
      {openTaskId && <TaskDetailModal taskId={openTaskId} onClose={() => setOpenTaskId(null)} onChanged={load} />}
      {showRotinaForm && <RecurrenceFormModal onClose={() => setShowRotinaForm(false)} onSaved={() => { setShowRotinaForm(false); load(); }} />}
    </div>
  );
}
