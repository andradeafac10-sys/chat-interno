// client/src/gestao/components/ReuniaoDetalheModal.jsx
import { useEffect, useState } from 'react';
import { X, Trash2, Pencil, CheckCircle2, History } from 'lucide-react';
import { api } from '../../api';
import ReuniaoFormModal from './ReuniaoFormModal';

const NAVY = '#2563EB';

export default function ReuniaoDetalheModal({ reuniaoId, onClose, onChanged }) {
  const [reuniao, setReuniao] = useState(null);
  const [ataHoje, setAtaHoje] = useState('');
  const [presencas, setPresencas] = useState({});
  const [salvando, setSalvando] = useState(false);
  const [editando, setEditando] = useState(false);
  const [historicoAberto, setHistoricoAberto] = useState(false); // fechado por padrão — clica pra ver
  const [erro, setErro] = useState('');

  const load = () => {
    api.get(`/reunioes/${reuniaoId}`)
      .then(({ data }) => {
        setReuniao(data.reuniao);
        const p = {};
        data.reuniao.participantes.forEach((x) => { if (x.presente != null) p[x.userId] = x.presente; });
        setPresencas(p);
      })
      .catch((err) => setErro(err.response?.data?.error || 'Não deu pra abrir essa reunião.'));
  };

  useEffect(() => { load(); }, [reuniaoId]); // eslint-disable-line react-hooks/exhaustive-deps

  // Salva como uma NOVA entrada do histórico — não apaga o que já tinha sido
  // escrito antes (nas reuniões anteriores da série, por exemplo).
  const salvarAta = async () => {
    if (!ataHoje.trim()) return;
    setSalvando(true);
    try {
      await api.post(`/reunioes/${reuniaoId}/ata-entradas`, { texto: ataHoje });
      setAtaHoje('');
      onChanged?.();
      load();
    } catch (err) {
      alert(err.response?.data?.error || 'Não deu pra salvar a ata.');
    } finally {
      setSalvando(false);
    }
  };

  const salvarPresencas = async () => {
    try {
      await api.put(`/reunioes/${reuniaoId}/ata`, { ata: reuniao?.ata || '', presencas });
      onChanged?.();
    } catch (err) {
      alert(err.response?.data?.error || 'Não deu pra salvar a presença.');
    }
  };

  const alternarConcluida = async () => {
    try {
      await api.patch(`/reunioes/${reuniaoId}/concluir`, { concluida: !reuniao.concluida });
      onChanged?.();
      load();
    } catch (err) {
      alert(err.response?.data?.error || 'Não deu pra atualizar.');
    }
  };

  const apagarReuniao = async () => {
    let apagarSerie = false;
    if (reuniao?.serie_id) {
      const escolha = confirm(
        'Essa reunião se repete.\n\nOK = apagar TODAS as próximas da série (as que já aconteceram ficam, com a ata preservada).\nCancelar = apagar só essa data.'
      );
      apagarSerie = escolha;
      if (!escolha && !confirm('Apagar só essa data então?')) return;
    } else if (!confirm('Apagar essa reunião? Essa ação não tem volta.')) {
      return;
    }
    try {
      await api.delete(`/reunioes/${reuniaoId}${apagarSerie ? '?serie=1' : ''}`);
      onChanged?.();
      onClose();
    } catch (err) {
      alert(err.response?.data?.error || 'Não deu pra apagar.');
    }
  };

  if (erro) {
    return (
      <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50" onClick={onClose}>
        <div className="bg-white rounded-xl p-5 w-[360px]" onClick={(e) => e.stopPropagation()}>
          <p className="text-[13px] text-red-500 mb-3">{erro}</p>
          <button onClick={onClose} className="text-[13px] font-medium" style={{ color: NAVY }}>Fechar</button>
        </div>
      </div>
    );
  }
  if (!reuniao) return null;

  if (editando) {
    return (
      <ReuniaoFormModal
        reuniaoParaEditar={reuniao}
        onClose={() => setEditando(false)}
        onSaved={() => { setEditando(false); load(); onChanged?.(); }}
      />
    );
  }

  const inicio = new Date(reuniao.inicio);
  const fim = new Date(reuniao.fim);
  const jaPassou = fim < new Date();
  const souDono = reuniao.souDono;
  const souParticipante = reuniao.souParticipante ?? souDono;

  return (
    <div className="fixed inset-0 bg-black/40 flex items-start justify-center z-50 overflow-y-auto py-[4vh] px-4">
      <div className="bg-white rounded-xl w-[480px] max-w-full p-5 my-auto" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-start justify-between gap-3 mb-3 pb-3 border-b" style={{ borderColor: 'var(--pagina-borda)' }}>
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-[15.5px] font-semibold text-slate-800 truncate">{reuniao.titulo}</span>
              <span className="text-[10px] rounded-full px-2 py-0.5 shrink-0"
                style={reuniao.tipo === 'externa' ? { background: '#FAEEDA', color: '#633806' } : { background: '#E6F1FB', color: '#0C447C' }}>
                {reuniao.tipo === 'externa' ? 'Externa' : 'Interna'}
              </span>
              {reuniao.concluida && (
                <span className="text-[10px] rounded-full px-2 py-0.5 shrink-0" style={{ background: '#E1F5EE', color: '#085041' }}>
                  Concluída
                </span>
              )}
            </div>
            <div className="text-[12px] text-slate-500 mt-0.5">
              {inicio.toLocaleDateString('pt-BR')} · {inicio.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })} às {fim.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
              {reuniao.local ? ` · ${reuniao.local}` : ''}
            </div>
            <div className="text-[11px] text-slate-400 mt-0.5">
              Criada por {reuniao.criado_por_nome}
              {reuniao.serie_id ? ' · reunião que se repete (ata única pra série toda)' : ''}
            </div>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            {souParticipante && (
              <button onClick={alternarConcluida} className="hover:opacity-70" style={{ color: reuniao.concluida ? '#16A34A' : '#94A3B8' }} title={reuniao.concluida ? 'Desmarcar como concluída' : 'Marcar como concluída'}>
                <CheckCircle2 size={17} />
              </button>
            )}
            {souDono && (
              <button onClick={() => setEditando(true)} className="text-slate-400 hover:text-[#2563EB]" title="Editar reunião">
                <Pencil size={15} />
              </button>
            )}
            {souDono && <button onClick={apagarReuniao} className="text-slate-400 hover:text-red-500" title="Apagar reunião"><Trash2 size={15} /></button>}
            <button onClick={onClose} className="text-slate-400 hover:text-slate-600"><X size={18} /></button>
          </div>
        </div>

        {reuniao.descricao && (
          <div className="mb-3">
            <div className="text-[11px] font-medium text-slate-500 mb-1">Pauta</div>
            <div className="text-[12.5px] text-slate-600 whitespace-pre-wrap">{reuniao.descricao}</div>
          </div>
        )}

        <div className="text-[11px] font-medium text-slate-500 mb-1.5">
          Participantes {jaPassou && souParticipante ? '— marque quem esteve presente' : ''}
        </div>
        <div className="flex flex-wrap gap-1.5 mb-4">
          {reuniao.participantes.map((p) => {
            const presente = presencas[p.userId];
            return (
              <button
                key={p.userId}
                type="button"
                disabled={!souParticipante || !jaPassou}
                onClick={() => setPresencas((prev) => ({ ...prev, [p.userId]: !prev[p.userId] }))}
                onBlur={salvarPresencas}
                className="text-[11.5px] font-medium rounded-full px-2.5 py-1 border disabled:cursor-default"
                style={presente === true
                  ? { background: '#E1F5EE', borderColor: '#5DCAA5', color: '#085041' }
                  : presente === false
                    ? { background: 'transparent', borderColor: 'var(--pagina-borda)', color: 'var(--pagina-texto-2)' }
                    : { background: '#EFF4FF', borderColor: '#BFD6F6', color: NAVY }}
              >
                {p.name}{presente === true ? ' ✓' : presente === false ? ' — ausente' : ''}
              </button>
            );
          })}
        </div>

        <div className="text-[13px] font-semibold text-slate-800 mb-1.5">
          Ata de hoje {reuniao.serie_id ? '(compartilhada por toda a série)' : ''}
        </div>
        {souParticipante ? (
          <>
            <textarea
              value={ataHoje}
              onChange={(e) => setAtaHoje(e.target.value)}
              rows={4}
              placeholder="Escreva o que foi conversado hoje..."
              className="w-full border border-slate-200 rounded-lg px-3 py-2 text-[12.5px] resize-none focus:outline-none focus:ring-2 focus:ring-[#2563EB] mb-2"
            />
            <button onClick={salvarAta} disabled={salvando || !ataHoje.trim()}
              className="w-full rounded-lg py-2.5 text-sm font-medium text-white disabled:opacity-40 mb-4" style={{ background: NAVY }}>
              {salvando ? 'Salvando...' : 'Salvar ata de hoje'}
            </button>
          </>
        ) : (
          <div className="text-[10.5px] text-slate-400 mb-4">Só participantes dessa reunião podem escrever a ata.</div>
        )}

        <button
          onClick={() => setHistoricoAberto((v) => !v)}
          className="w-full flex items-center gap-1.5 text-[13px] font-semibold text-slate-800 mb-2"
        >
          <History size={14} style={{ color: 'var(--pagina-texto-2)' }} />
          Histórico da série
          {(reuniao.historicoAta || []).length > 0 && (
            <span className="text-[10.5px] font-normal" style={{ color: 'var(--pagina-texto-2)' }}>
              ({reuniao.historicoAta.length})
            </span>
          )}
          <span className="ml-auto text-[11px]" style={{ color: 'var(--pagina-texto-2)' }}>
            {historicoAberto ? '▲ esconder' : '▼ mostrar'}
          </span>
        </button>
        {historicoAberto && (
          <>
            {(!reuniao.historicoAta || reuniao.historicoAta.length === 0) && (
              <p className="text-[12px] text-slate-400">Nenhuma ata registrada ainda.</p>
            )}
            <div className="flex flex-col gap-3 pl-3 max-h-[220px] overflow-y-auto" style={{ borderLeft: '2px solid var(--pagina-borda)' }}>
              {(reuniao.historicoAta || []).map((h) => (
                <div key={h.id}>
                  <div className="text-[10.5px] font-bold" style={{ color: NAVY }}>
                    {new Date(h.criado_em).toLocaleDateString('pt-BR')} · {h.autor_nome}
                  </div>
                  <div className="text-[12px] text-slate-600 whitespace-pre-wrap mt-0.5">{h.texto}</div>
                </div>
              ))}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
