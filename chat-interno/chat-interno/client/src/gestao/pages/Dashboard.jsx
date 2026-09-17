import { useState } from 'react';

export default function Dashboard() {
  const [filtroStatus, setFiltroStatus] = useState('todos');
  const [filtroSetor, setFiltroSetor] = useState('todos');

  const rotinas = [
    { id: 1, name: 'Backup banco de dados', setor: 'Operacional', supervisor: 'Ana Silva', responsavel: 'Sabrina', status: 'completada', freq: 'daily', proxima: '2026-09-18' },
    { id: 2, name: 'Relatório de acionamentos', setor: 'Comercial', supervisor: 'Carlos Santos', responsavel: 'Gabriel', status: 'em_andamento', freq: 'weekly', proxima: '2026-09-19' },
    { id: 3, name: 'Verificar acordos Hapvida', setor: 'RH', supervisor: 'Cássia', responsavel: 'Aline', status: 'atrasada', freq: 'monthly', proxima: '2026-09-20' },
    { id: 4, name: 'Auditoria de acesso', setor: 'TI', supervisor: 'Roberto', responsavel: 'Marcus', status: 'completada', freq: 'weekly', proxima: '2026-09-21' },
    { id: 5, name: 'Limpeza de arquivos', setor: 'Operacional', supervisor: 'Ana Silva', responsavel: 'Sabrina', status: 'em_andamento', freq: 'daily', proxima: '2026-09-22' },
  ];

  const filtradas = rotinas.filter(r => {
    if (filtroStatus !== 'todos' && r.status !== filtroStatus) return false;
    if (filtroSetor !== 'todos' && r.setor !== filtroSetor) return false;
    return true;
  });

  const total = filtradas.length;
  const completadas = filtradas.filter(r => r.status === 'completada').length;
  const emAndamento = filtradas.filter(r => r.status === 'em_andamento').length;
  const atrasadas = filtradas.filter(r => r.status === 'atrasada').length;

  const corStatus = {
    completada: '#639922',
    em_andamento: '#185FA5',
    atrasada: '#E24B4A'
  };

  const corFreq = {
    daily: '#E6F1FB',
    weekly: '#EAF3DE',
    monthly: '#E1F5EE'
  };

  const labelFreq = {
    daily: 'Diária',
    weekly: 'Semanal',
    monthly: 'Mensal'
  };

  return (
    <div style={{ width: '100%', minHeight: '100vh', background: '#F7F9FB', padding: '24px' }}>
      <div style={{ marginBottom: '32px' }}>
        <h1 style={{ fontSize: '24px', fontWeight: '500', color: '#101828', margin: '0 0 8px 0' }}>Controle de rotinas</h1>
        <p style={{ fontSize: '13px', color: '#667085', margin: '0' }}>Acompanhamento das rotinas recorrentes por equipe e responsável</p>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: '12px', marginBottom: '24px' }}>
        <div style={{ background: 'white', padding: '16px', borderRadius: '8px', border: '0.5px solid #E4E8EE' }}>
          <p style={{ fontSize: '11px', fontWeight: '600', color: '#667085', margin: '0 0 8px 0', textTransform: 'uppercase' }}>Total</p>
          <p style={{ fontSize: '28px', fontWeight: '600', color: '#101828', margin: '0' }}>{total}</p>
        </div>

        <div style={{ background: '#EAF3DE', padding: '16px', borderRadius: '8px', border: '0.5px solid #B8D77D' }}>
          <p style={{ fontSize: '11px', fontWeight: '600', color: '#3B6D11', margin: '0 0 8px 0', textTransform: 'uppercase' }}>Completadas</p>
          <p style={{ fontSize: '28px', fontWeight: '600', color: '#639922', margin: '0' }}>{completadas}</p>
          <p style={{ fontSize: '11px', color: '#3B6D11', margin: '4px 0 0 0' }}>{total > 0 ? Math.round((completadas / total) * 100) : 0}%</p>
        </div>

        <div style={{ background: '#E6F1FB', padding: '16px', borderRadius: '8px', border: '0.5px solid #8AB9E8' }}>
          <p style={{ fontSize: '11px', fontWeight: '600', color: '#185FA5', margin: '0 0 8px 0', textTransform: 'uppercase' }}>Em andamento</p>
          <p style={{ fontSize: '28px', fontWeight: '600', color: '#185FA5', margin: '0' }}>{emAndamento}</p>
          <p style={{ fontSize: '11px', color: '#185FA5', margin: '4px 0 0 0' }}>{total > 0 ? Math.round((emAndamento / total) * 100) : 0}%</p>
        </div>

        <div style={{ background: '#FCEBEB', padding: '16px', borderRadius: '8px', border: '0.5px solid #F4A0A0' }}>
          <p style={{ fontSize: '11px', fontWeight: '600', color: '#A32D2D', margin: '0 0 8px 0', textTransform: 'uppercase' }}>Atrasadas</p>
          <p style={{ fontSize: '28px', fontWeight: '600', color: '#E24B4A', margin: '0' }}>{atrasadas}</p>
          <p style={{ fontSize: '11px', color: '#A32D2D', margin: '4px 0 0 0' }}>{total > 0 ? Math.round((atrasadas / total) * 100) : 0}%</p>
        </div>

        <div style={{ background: 'white', padding: '16px', borderRadius: '8px', border: '0.5px solid #E4E8EE' }}>
          <p style={{ fontSize: '11px', fontWeight: '600', color: '#667085', margin: '0 0 8px 0', textTransform: 'uppercase' }}>Próximos</p>
          <p style={{ fontSize: '28px', fontWeight: '600', color: '#101828', margin: '0' }}>7</p>
          <p style={{ fontSize: '11px', color: '#667085', margin: '4px 0 0 0' }}>dias</p>
        </div>
      </div>

      <div style={{ background: 'white', padding: '16px', borderRadius: '8px', border: '0.5px solid #E4E8EE', marginBottom: '24px', display: 'flex', gap: '16px', alignItems: 'flex-end' }}>
        <div>
          <label style={{ fontSize: '12px', fontWeight: '600', color: '#667085', display: 'block', marginBottom: '6px' }}>Setor</label>
          <select value={filtroSetor} onChange={(e) => setFiltroSetor(e.target.value)} style={{ padding: '6px 8px', fontSize: '13px', borderRadius: '4px', border: '0.5px solid #E4E8EE', background: 'white', color: '#101828', cursor: 'pointer' }}>
            <option value="todos">Todos</option>
            <option value="Operacional">Operacional</option>
            <option value="Comercial">Comercial</option>
            <option value="RH">RH</option>
            <option value="TI">TI</option>
          </select>
        </div>

        <div>
          <label style={{ fontSize: '12px', fontWeight: '600', color: '#667085', display: 'block', marginBottom: '6px' }}>Status</label>
          <select value={filtroStatus} onChange={(e) => setFiltroStatus(e.target.value)} style={{ padding: '6px 8px', fontSize: '13px', borderRadius: '4px', border: '0.5px solid #E4E8EE', background: 'white', color: '#101828', cursor: 'pointer' }}>
            <option value="todos">Todos</option>
            <option value="completada">Completada</option>
            <option value="em_andamento">Em andamento</option>
            <option value="atrasada">Atrasada</option>
          </select>
        </div>

        <div style={{ marginLeft: 'auto' }}>
          <button style={{ padding: '8px 16px', fontSize: '13px', fontWeight: '600', background: '#2563EB', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer' }}>Exportar</button>
        </div>
      </div>

      <div style={{ background: 'white', borderRadius: '8px', border: '0.5px solid #E4E8EE', overflow: 'hidden' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr style={{ borderBottom: '0.5px solid #E4E8EE', background: '#F7F9FB' }}>
              <th style={{ padding: '12px 16px', textAlign: 'left', fontSize: '12px', fontWeight: '600', color: '#667085' }}>Setor</th>
              <th style={{ padding: '12px 16px', textAlign: 'left', fontSize: '12px', fontWeight: '600', color: '#667085' }}>Supervisor</th>
              <th style={{ padding: '12px 16px', textAlign: 'left', fontSize: '12px', fontWeight: '600', color: '#667085' }}>Responsável</th>
              <th style={{ padding: '12px 16px', textAlign: 'left', fontSize: '12px', fontWeight: '600', color: '#667085' }}>Rotina</th>
              <th style={{ padding: '12px 16px', textAlign: 'left', fontSize: '12px', fontWeight: '600', color: '#667085' }}>Próxima</th>
              <th style={{ padding: '12px 16px', textAlign: 'left', fontSize: '12px', fontWeight: '600', color: '#667085' }}>Frequência</th>
              <th style={{ padding: '12px 16px', textAlign: 'center', fontSize: '12px', fontWeight: '600', color: '#667085' }}>Status</th>
            </tr>
          </thead>
          <tbody>
            {filtradas.map((rotina) => (
              <tr key={rotina.id} style={{ borderBottom: '0.5px solid #E4E8EE' }}>
                <td style={{ padding: '12px 16px', fontSize: '13px', color: '#101828' }}>{rotina.setor}</td>
                <td style={{ padding: '12px 16px', fontSize: '13px', color: '#101828' }}>{rotina.supervisor}</td>
                <td style={{ padding: '12px 16px', fontSize: '13px', color: '#101828' }}>{rotina.responsavel}</td>
                <td style={{ padding: '12px 16px', fontSize: '13px', fontWeight: '600', color: '#101828' }}>{rotina.name}</td>
                <td style={{ padding: '12px 16px', fontSize: '13px', color: '#101828' }}>{new Date(rotina.proxima).toLocaleDateString('pt-BR')}</td>
                <td style={{ padding: '12px 16px', fontSize: '11px' }}>
                  <span style={{ background: corFreq[rotina.freq], color: rotina.freq === 'daily' ? '#185FA5' : rotina.freq === 'weekly' ? '#3B6D11' : '#0F6E56', padding: '4px 8px', borderRadius: '4px', fontWeight: '600' }}>
                    {labelFreq[rotina.freq]}
                  </span>
                </td>
                <td style={{ padding: '12px 16px', textAlign: 'center' }}>
                  <div style={{ width: '12px', height: '12px', borderRadius: '50%', background: corStatus[rotina.status], margin: '0 auto' }} title={rotina.status} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {filtradas.length === 0 && (
        <div style={{ textAlign: 'center', padding: '32px', color: '#667085', fontSize: '13px' }}>
          Nenhuma rotina encontrada com os filtros selecionados
        </div>
      )}
    </div>
  );
}
