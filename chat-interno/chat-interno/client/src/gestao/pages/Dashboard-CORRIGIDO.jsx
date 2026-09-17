import { useEffect, useState } from 'react';
import { Download, Filter, List, LayoutGrid, Calendar } from 'lucide-react';
import PageHeader from '../PageHeader';
import { gestaoApi } from '../gestaoApi';

const CORES_FREQ = { 'daily': '#E6F1FB', 'weekly': '#EAF3DE', 'monthly': '#E1F5EE' };
const CORES_FREQ_TEXTO = { 'daily': '#185FA5', 'weekly': '#3B6D11', 'monthly': '#0F6E56' };
const LABEL_FREQ = { 'daily': 'Diária', 'weekly': 'Semanal', 'monthly': 'Mensal' };

const CORES_STATUS = {
  completada: '#639922',
  em_andamento: '#185FA5',
  atrasada: '#E24B4A',
  pendente: '#F7F9FB'
};

export default function Dashboard() {
  const [rotinas, setRotinas] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  
  // Filtros
  const [filtroSetor, setFiltroSetor] = useState('todos');
  const [filtroSupervisor, setFiltroSupervisor] = useState('todos');
  const [filtroResponsavel, setFiltroResponsavel] = useState('todos');
  const [filtroStatus, setFiltroStatus] = useState('todos');
  const [filtroFreq, setFiltroFreq] = useState('todos');
  
  const [view, setView] = useState('lista');

  async function load() {
    setLoading(true);
    setError('');
    try {
      console.log('📊 Dashboard: Tentando carregar rotinas...');
      
      // Verificar se gestaoApi.listRecurrences existe
      if (!gestaoApi || !gestaoApi.listRecurrences) {
        console.warn('⚠️ gestaoApi.listRecurrences não existe! Usando dados mock.');
        // Dados mock para teste
        const mockData = [
          {
            id: 1,
            name: 'Backup de base de dados',
            description: 'Mantém integridade dos dados',
            setor: 'Operacional',
            supervisor: 'Ana Silva',
            responsavel: 'Sabrina',
            recurrence_type: 'daily',
            proxima_execucao: new Date(Date.now() + 86400000).toISOString(),
            status: 'completada',
            active: true
          },
          {
            id: 2,
            name: 'Relatório de acionamentos',
            description: 'Consolidar dados da semana',
            setor: 'Comercial',
            supervisor: 'Carlos Santos',
            responsavel: 'Gabriel',
            recurrence_type: 'weekly',
            proxima_execucao: new Date(Date.now() + 172800000).toISOString(),
            status: 'em_andamento',
            active: true
          },
          {
            id: 3,
            name: 'Verificar acordos Hapvida',
            description: 'Revisão mensal',
            setor: 'RH',
            supervisor: 'Cássia',
            responsavel: 'Aline',
            recurrence_type: 'monthly',
            proxima_execucao: new Date(Date.now() + 2592000000).toISOString(),
            status: 'atrasada',
            active: true
          },
        ];
        setRotinas(mockData);
        console.log('✅ Dashboard: Usando dados mock', mockData);
        setLoading(false);
        return;
      }

      const data = await gestaoApi.listRecurrences();
      console.log('✅ Dashboard: Dados carregados', data);
      
      if (data && data.recurrences) {
        setRotinas(data.recurrences);
      } else if (Array.isArray(data)) {
        setRotinas(data);
      } else {
        console.warn('⚠️ Formato inesperado:', data);
        setRotinas([]);
      }
    } catch (err) {
      console.error('❌ Erro ao carregar rotinas:', err);
      setError(`Erro: ${err.message || 'Não foi possível carregar as rotinas'}`);
      setRotinas([]);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); }, []);

  // Aplicar filtros
  const rotinasFiltradas = rotinas.filter(r => {
    if (filtroSetor !== 'todos' && r.setor !== filtroSetor) return false;
    if (filtroSupervisor !== 'todos' && r.supervisor !== filtroSupervisor) return false;
    if (filtroResponsavel !== 'todos' && r.responsavel !== filtroResponsavel) return false;
    if (filtroStatus !== 'todos' && r.status !== filtroStatus) return false;
    if (filtroFreq !== 'todos' && r.recurrence_type !== filtroFreq) return false;
    return true;
  });

  // Métricas
  const totalRotinas = rotinasFiltradas.length;
  const rotinasCompletadas = rotinasFiltradas.filter(r => r.status === 'completada').length;
  const rotinasEmAndamento = rotinasFiltradas.filter(r => r.status === 'em_andamento').length;
  const rotinasAtrasadas = rotinasFiltradas.filter(r => r.status === 'atrasada').length;
  
  // Visão por responsável
  const porResponsavel = {};
  rotinasFiltradas.forEach(r => {
    if (!porResponsavel[r.responsavel]) {
      porResponsavel[r.responsavel] = { total: 0, completadas: 0, nome: r.responsavel };
    }
    porResponsavel[r.responsavel].total += 1;
    if (r.status === 'completada') porResponsavel[r.responsavel].completadas += 1;
  });

  const responsaveis = Object.values(porResponsavel).sort((a, b) => b.total - a.total);
  const coresAvatar = ['#2563EB', '#7F77DD', '#D85A30', '#E24B4A', '#0F6E56'];
  const getCorAvatar = (idx) => coresAvatar[idx % coresAvatar.length];

  // Frequências
  const porFrequencia = {
    daily: rotinasFiltradas.filter(r => r.recurrence_type === 'daily').length,
    weekly: rotinasFiltradas.filter(r => r.recurrence_type === 'weekly').length,
    monthly: rotinasFiltradas.filter(r => r.recurrence_type === 'monthly').length,
  };

  // Próximos prazos
  const proximosPrazos = rotinasFiltradas
    .filter(r => r.proxima_execucao)
    .sort((a, b) => new Date(a.proxima_execucao) - new Date(b.proxima_execucao))
    .slice(0, 4);

  const setores = [...new Set(rotinas.map(r => r.setor).filter(Boolean))];
  const supervisores = [...new Set(rotinas.map(r => r.supervisor).filter(Boolean))];
  const responsavelsList = [...new Set(rotinas.map(r => r.responsavel).filter(Boolean))];

  // Se está carregando
  if (loading) {
    return (
      <div className="flex flex-col h-full overflow-hidden" style={{ background: 'var(--pagina-fundo)' }}>
        <PageHeader 
          title="Controle de rotinas" 
          subtitle="Acompanhamento das rotinas recorrentes por equipe e responsável."
        />
        <div className="flex-1 flex items-center justify-center">
          <div className="text-center">
            <div className="text-[18px] font-semibold mb-2" style={{ color: '#101828' }}>Carregando dados...</div>
            <p style={{ color: '#667085' }}>Aguarde um momento</p>
          </div>
        </div>
      </div>
    );
  }

  // Se tem erro
  if (error) {
    return (
      <div className="flex flex-col h-full overflow-hidden" style={{ background: 'var(--pagina-fundo)' }}>
        <PageHeader 
          title="Controle de rotinas" 
          subtitle="Acompanhamento das rotinas recorrentes por equipe e responsável."
        />
        <div className="flex-1 flex items-center justify-center">
          <div className="text-center p-8 rounded-lg" style={{ background: '#FCEBEB', border: '1px solid #F4A0A0', maxWidth: '400px' }}>
            <div className="text-[18px] font-semibold mb-2" style={{ color: '#A32D2D' }}>⚠️ Erro ao carregar</div>
            <p style={{ color: '#A32D2D', marginBottom: '16px' }}>{error}</p>
            <button 
              onClick={load}
              className="px-4 py-2 rounded font-semibold"
              style={{ background: '#2563EB', color: 'white' }}
            >
              Tentar novamente
            </button>
            <p style={{ color: '#667085', marginTop: '16px', fontSize: '12px' }}>
              Verifique o console (F12) para mais detalhes
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full overflow-hidden" style={{ background: 'var(--pagina-fundo)' }}>
      <PageHeader 
        title="Controle de rotinas" 
        subtitle="Acompanhamento das rotinas recorrentes por equipe e responsável."
      />

      <div className="flex flex-1 overflow-hidden">
        {/* Sidebar com filtros */}
        <div className="w-48 shrink-0 border-r overflow-y-auto p-4" style={{ borderColor: '#E4E8EE', background: 'var(--surface-1)' }}>
          <div className="mb-6">
            <h3 className="text-[12px] font-semibold uppercase mb-3" style={{ color: '#667085' }}>Filtros</h3>
            
            <div className="mb-4">
              <label className="text-[12px] font-semibold mb-1.5 block" style={{ color: '#667085' }}>Setor</label>
              <select 
                value={filtroSetor} 
                onChange={e => setFiltroSetor(e.target.value)}
                className="w-full px-2 py-1.5 text-[12px] border rounded"
                style={{ borderColor: '#E4E8EE', color: '#101828' }}
              >
                <option value="todos">Todos</option>
                {setores.map(s => <option key={s} value={s}>{s}</option>)}
              </select>
            </div>

            <div className="mb-4">
              <label className="text-[12px] font-semibold mb-1.5 block" style={{ color: '#667085' }}>Supervisor</label>
              <select 
                value={filtroSupervisor} 
                onChange={e => setFiltroSupervisor(e.target.value)}
                className="w-full px-2 py-1.5 text-[12px] border rounded"
                style={{ borderColor: '#E4E8EE', color: '#101828' }}
              >
                <option value="todos">Todos</option>
                {supervisores.map(s => <option key={s} value={s}>{s}</option>)}
              </select>
            </div>

            <div className="mb-4">
              <label className="text-[12px] font-semibold mb-1.5 block" style={{ color: '#667085' }}>Responsável</label>
              <select 
                value={filtroResponsavel} 
                onChange={e => setFiltroResponsavel(e.target.value)}
                className="w-full px-2 py-1.5 text-[12px] border rounded"
                style={{ borderColor: '#E4E8EE', color: '#101828' }}
              >
                <option value="todos">Todos</option>
                {responsavelsList.map(r => <option key={r} value={r}>{r}</option>)}
              </select>
            </div>

            <div className="mb-4">
              <label className="text-[12px] font-semibold mb-1.5 block" style={{ color: '#667085' }}>Status</label>
              <select 
                value={filtroStatus} 
                onChange={e => setFiltroStatus(e.target.value)}
                className="w-full px-2 py-1.5 text-[12px] border rounded"
                style={{ borderColor: '#E4E8EE', color: '#101828' }}
              >
                <option value="todos">Todos</option>
                <option value="completada">Completada</option>
                <option value="em_andamento">Em andamento</option>
                <option value="atrasada">Atrasada</option>
              </select>
            </div>

            <div className="mb-6">
              <label className="text-[12px] font-semibold mb-1.5 block" style={{ color: '#667085' }}>Frequência</label>
              <select 
                value={filtroFreq} 
                onChange={e => setFiltroFreq(e.target.value)}
                className="w-full px-2 py-1.5 text-[12px] border rounded"
                style={{ borderColor: '#E4E8EE', color: '#101828' }}
              >
                <option value="todos">Todos</option>
                <option value="daily">Diária</option>
                <option value="weekly">Semanal</option>
                <option value="monthly">Mensal</option>
              </select>
            </div>

            <button className="w-full py-2 rounded font-semibold text-white text-[13px] flex items-center justify-center gap-2" style={{ background: '#2563EB' }}>
              <Filter size={14} />
              Aplicar filtros
            </button>
          </div>

          {/* Links rápidos */}
          <div className="border-t pt-4" style={{ borderColor: '#E4E8EE' }}>
            <p className="text-[12px] font-semibold uppercase mb-3" style={{ color: '#667085' }}>Links rápidos</p>
            <div className="space-y-2 text-[13px]">
              <a href="#" style={{ color: '#2563EB' }} className="flex items-center gap-2 hover:opacity-80">
                <span className="w-4 h-4 rounded-full" style={{ background: '#639922' }} />
                Minhas rotinas
              </a>
              <a href="#" style={{ color: '#101828' }} className="flex items-center gap-2 hover:opacity-80">
                <span className="w-4 h-4 rounded-full" style={{ background: '#D3D1C7' }} />
                Rotinas da equipe
              </a>
              <a href="#" style={{ color: '#101828' }} className="flex items-center gap-2 hover:opacity-80">
                <span className="w-4 h-4 rounded-full" style={{ background: '#E24B4A' }} />
                Atrasadas
              </a>
            </div>
          </div>
        </div>

        {/* Conteúdo principal */}
        <div className="flex-1 overflow-y-auto p-6">
          {/* Header */}
          <div className="flex justify-between items-start mb-6">
            <div>
              <h1 className="text-[24px] font-medium mb-1">Controle de rotinas</h1>
              <p className="text-[13px]" style={{ color: '#667085' }}>Total de {totalRotinas} rotina(s) encontrada(s)</p>
            </div>
            <button className="px-3 py-2 border rounded text-[13px] flex items-center gap-2" style={{ borderColor: '#E4E8EE', color: '#101828' }}>
              <Download size={14} />
              Exportar
            </button>
          </div>

          {/* Cards de métricas */}
          <div className="grid grid-cols-5 gap-3 mb-6">
            <div className="p-4 rounded-lg" style={{ background: 'var(--surface-1)', border: '0.5px solid #E4E8EE' }}>
              <p className="text-[12px] font-semibold uppercase mb-2" style={{ color: '#667085' }}>Total</p>
              <p className="text-[28px] font-semibold" style={{ color: '#101828' }}>{totalRotinas}</p>
            </div>

            <div className="p-4 rounded-lg" style={{ background: '#EAF3DE', border: '0.5px solid #B8D77D' }}>
              <p className="text-[12px] font-semibold uppercase mb-2" style={{ color: '#3B6D11' }}>Completadas</p>
              <p className="text-[28px] font-semibold" style={{ color: '#639922' }}>{rotinasCompletadas}</p>
              <p className="text-[11px] mt-1" style={{ color: '#3B6D11' }}>{totalRotinas > 0 ? Math.round((rotinasCompletadas / totalRotinas) * 100) : 0}%</p>
            </div>

            <div className="p-4 rounded-lg" style={{ background: '#E6F1FB', border: '0.5px solid #8AB9E8' }}>
              <p className="text-[12px] font-semibold uppercase mb-2" style={{ color: '#185FA5' }}>Em andamento</p>
              <p className="text-[28px] font-semibold" style={{ color: '#185FA5' }}>{rotinasEmAndamento}</p>
              <p className="text-[11px] mt-1" style={{ color: '#185FA5' }}>{totalRotinas > 0 ? Math.round((rotinasEmAndamento / totalRotinas) * 100) : 0}%</p>
            </div>

            <div className="p-4 rounded-lg" style={{ background: '#FCEBEB', border: '0.5px solid #F4A0A0' }}>
              <p className="text-[12px] font-semibold uppercase mb-2" style={{ color: '#A32D2D' }}>Atrasadas</p>
              <p className="text-[28px] font-semibold" style={{ color: '#E24B4A' }}>{rotinasAtrasadas}</p>
              <p className="text-[11px] mt-1" style={{ color: '#A32D2D' }}>{totalRotinas > 0 ? Math.round((rotinasAtrasadas / totalRotinas) * 100) : 0}%</p>
            </div>

            <div className="p-4 rounded-lg" style={{ background: 'var(--surface-1)', border: '0.5px solid #E4E8EE' }}>
              <p className="text-[12px] font-semibold uppercase mb-2" style={{ color: '#667085' }}>Próximos</p>
              <p className="text-[28px] font-semibold" style={{ color: '#101828' }}>{proximosPrazos.length}</p>
              <p className="text-[11px] mt-1" style={{ color: '#667085' }}>prazos</p>
            </div>
          </div>

          {/* Visão por responsável */}
          {responsaveis.length > 0 && (
            <div className="mb-6">
              <h3 className="text-[14px] font-semibold mb-3" style={{ color: '#101828' }}>Visão por responsável</h3>
              <div className="grid grid-cols-5 gap-3">
                {responsaveis.slice(0, 5).map((resp, idx) => (
                  <div key={resp.nome} className="p-3 rounded-lg text-center" style={{ background: 'var(--surface-1)', border: '0.5px solid #E4E8EE' }}>
                    <div 
                      className="w-10 h-10 rounded-full flex items-center justify-center text-white font-semibold text-[14px] mx-auto mb-2"
                      style={{ background: getCorAvatar(idx) }}
                    >
                      {resp.nome.charAt(0).toUpperCase()}
                    </div>
                    <p className="text-[13px] font-semibold" style={{ color: '#101828' }}>{resp.nome}</p>
                    <p className="text-[12px] mb-2" style={{ color: '#667085' }}>{resp.completadas}/{resp.total}</p>
                    <div className="w-full h-1 bg-[#E4E8EE] rounded-full overflow-hidden">
                      <div 
                        className="h-full" 
                        style={{ width: `${resp.total > 0 ? (resp.completadas / resp.total) * 100 : 0}%`, background: '#639922' }}
                      />
                    </div>
                    <p className="text-[11px] mt-1" style={{ color: '#667085' }}>{resp.total > 0 ? Math.round((resp.completadas / resp.total) * 100) : 0}%</p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Tabela */}
          {rotinasFiltradas.length > 0 ? (
            <div className="rounded-lg border mb-6 overflow-hidden" style={{ borderColor: '#E4E8EE', background: 'var(--surface-1)' }}>
              <table className="w-full text-[13px]">
                <thead>
                  <tr style={{ borderBottom: '0.5px solid #E4E8EE', background: 'var(--pagina-fundo)' }}>
                    <th className="px-4 py-3 text-left font-semibold" style={{ color: '#667085' }}>Setor</th>
                    <th className="px-4 py-3 text-left font-semibold" style={{ color: '#667085' }}>Responsável</th>
                    <th className="px-4 py-3 text-left font-semibold" style={{ color: '#667085' }}>Rotina</th>
                    <th className="px-4 py-3 text-left font-semibold" style={{ color: '#667085' }}>Próxima</th>
                    <th className="px-4 py-3 text-left font-semibold" style={{ color: '#667085' }}>Freq</th>
                    <th className="px-4 py-3 text-center font-semibold" style={{ color: '#667085' }}>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {rotinasFiltradas.slice(0, 15).map((rotina) => (
                    <tr key={rotina.id} style={{ borderBottom: '0.5px solid #E4E8EE' }}>
                      <td className="px-4 py-3" style={{ color: '#101828' }}>{rotina.setor || '-'}</td>
                      <td className="px-4 py-3" style={{ color: '#101828' }}>{rotina.responsavel || '-'}</td>
                      <td className="px-4 py-3 font-semibold" style={{ color: '#101828' }}>{rotina.name}</td>
                      <td className="px-4 py-3" style={{ color: '#101828' }}>
                        {rotina.proxima_execucao ? new Date(rotina.proxima_execucao).toLocaleDateString('pt-BR', { month: 'numeric', day: 'numeric' }) : '-'}
                      </td>
                      <td className="px-4 py-3">
                        <span className="px-2 py-1 rounded text-[11px] font-semibold" style={{ background: CORES_FREQ[rotina.recurrence_type], color: CORES_FREQ_TEXTO[rotina.recurrence_type] }}>
                          {LABEL_FREQ[rotina.recurrence_type] || '?'}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-center">
                        <span 
                          className="inline-block w-3 h-3 rounded-full" 
                          style={{ background: CORES_STATUS[rotina.status] || '#999' }}
                          title={rotina.status}
                        />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="text-center p-8" style={{ background: 'var(--surface-1)', borderRadius: '12px', border: '0.5px solid #E4E8EE', marginBottom: '24px' }}>
              <p style={{ color: '#667085' }}>Nenhuma rotina encontrada com os filtros selecionados</p>
            </div>
          )}

          {/* Gráficos simples */}
          <div className="grid grid-cols-3 gap-6">
            <div className="p-5 rounded-lg" style={{ background: 'var(--surface-1)', border: '0.5px solid #E4E8EE' }}>
              <h3 className="text-[14px] font-semibold mb-4" style={{ color: '#101828' }}>Status</h3>
              <div className="space-y-3">
                <div className="flex justify-between">
                  <div className="flex items-center gap-2">
                    <div className="w-2.5 h-2.5 rounded-full" style={{ background: '#639922' }} />
                    <span className="text-[13px]" style={{ color: '#667085' }}>Completada</span>
                  </div>
                  <span className="font-semibold" style={{ color: '#101828' }}>{rotinasCompletadas}</span>
                </div>
                <div className="flex justify-between">
                  <div className="flex items-center gap-2">
                    <div className="w-2.5 h-2.5 rounded-full" style={{ background: '#185FA5' }} />
                    <span className="text-[13px]" style={{ color: '#667085' }}>Em andamento</span>
                  </div>
                  <span className="font-semibold" style={{ color: '#101828' }}>{rotinasEmAndamento}</span>
                </div>
                <div className="flex justify-between">
                  <div className="flex items-center gap-2">
                    <div className="w-2.5 h-2.5 rounded-full" style={{ background: '#E24B4A' }} />
                    <span className="text-[13px]" style={{ color: '#667085' }}>Atrasada</span>
                  </div>
                  <span className="font-semibold" style={{ color: '#101828' }}>{rotinasAtrasadas}</span>
                </div>
              </div>
            </div>

            <div className="p-5 rounded-lg" style={{ background: 'var(--surface-1)', border: '0.5px solid #E4E8EE' }}>
              <h3 className="text-[14px] font-semibold mb-4" style={{ color: '#101828' }}>Frequência</h3>
              <div className="space-y-3">
                <div className="flex justify-between">
                  <div className="flex items-center gap-2">
                    <div className="w-2.5 h-2.5 rounded-full" style={{ background: '#E6F1FB' }} />
                    <span className="text-[13px]" style={{ color: '#667085' }}>Diária</span>
                  </div>
                  <span className="font-semibold" style={{ color: '#101828' }}>{porFrequencia.daily}</span>
                </div>
                <div className="flex justify-between">
                  <div className="flex items-center gap-2">
                    <div className="w-2.5 h-2.5 rounded-full" style={{ background: '#EAF3DE' }} />
                    <span className="text-[13px]" style={{ color: '#667085' }}>Semanal</span>
                  </div>
                  <span className="font-semibold" style={{ color: '#101828' }}>{porFrequencia.weekly}</span>
                </div>
                <div className="flex justify-between">
                  <div className="flex items-center gap-2">
                    <div className="w-2.5 h-2.5 rounded-full" style={{ background: '#E1F5EE' }} />
                    <span className="text-[13px]" style={{ color: '#667085' }}>Mensal</span>
                  </div>
                  <span className="font-semibold" style={{ color: '#101828' }}>{porFrequencia.monthly}</span>
                </div>
              </div>
            </div>

            <div className="p-5 rounded-lg" style={{ background: 'var(--surface-1)', border: '0.5px solid #E4E8EE' }}>
              <h3 className="text-[14px] font-semibold mb-4" style={{ color: '#101828' }}>Próximos prazos</h3>
              <div className="space-y-2 text-[12px]">
                {proximosPrazos.map((r, idx) => (
                  <div key={idx} className="flex justify-between pb-2" style={{ borderBottom: '0.5px solid #E4E8EE' }}>
                    <span style={{ color: '#101828' }}>{new Date(r.proxima_execucao).toLocaleDateString('pt-BR')}</span>
                    <span style={{ color: '#667085' }}>{r.name.substring(0, 15)}</span>
                  </div>
                ))}
                {proximosPrazos.length === 0 && (
                  <p style={{ color: '#667085' }}>Sem prazos próximos</p>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
