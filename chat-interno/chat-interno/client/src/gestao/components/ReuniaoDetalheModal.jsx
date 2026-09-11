// client/src/gestao/components/ReuniaoDetalheModal.jsx
import { useEffect, useState } from 'react';
import { X, Trash2, User, Plus } from 'lucide-react';
import { api } from '../../api';

const NAVY = '#2563EB';

export default function ReuniaoDetalheModal({ reuniaoId, onClose, onChanged }) {
  const [reuniao, setReuniao] = useState(null);
  const [ata, setAta] = useState('');
  const [presencas, setPresencas] = useState({});
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState('');
  const [users, setUsers] = useState([]);

  // form de encaminhamento novo
  const [novoTexto, setNovoTexto] = useState('');
  const [novoResp, setNovoResp] = useState('');
  const [novoPrazo, setNovoPrazo] = useState('');

  const load = () => {
    api.get(`/reunioes/${reuniaoId}`)
      .then(({ data }) => {
        setReuniao(data.reuniao);
        setAta(data.reuniao.ata || '');
        const p = {};
        data.reuniao.participantes.forEach((x) => { if (x.presente != null) p[x.userId] = x.presente; });
        setPresencas(p);
      })
      .catch((err) => setErro(err.response?.data?.error || 'Não deu pra abrir essa reunião.'));
  };

  useEffect(() => {
    load();
    api.get('/users/manage').then(({ data }) => setUsers(data.users.filter((u) => u.role === 'admin')));
  }, [reuniaoId]); // eslint-disable-line react-hooks/exhaustive-deps

  const salvarAta = async () => {
    setSalvando(true);
    try {
      await api.put(`/reunioes/${reuniaoId}/ata`, { ata, presencas });
      onChanged?.();
      onClose();
    } catch (err) {
      alert(err.response?.data?.error || 'Não deu pra salvar a ata.');
    } finally {
      setSalvando(false);
    }
  };

  const adicionarEncaminhamento = async () => {
    if (!novoTexto.trim() || !novoResp || !novoPrazo) {
      alert('Preencha a ação, o responsável e o prazo.');
      return;
    }
    try {
      await api.post(`/reunioes/${reuniaoId}/encaminhamentos`, {
        descricao: novoTexto, responsavelId: Number(novoResp), prazo: novoPrazo,
      });
      setNovoTexto(''); setNovoResp(''); setNovoPrazo('');
      load();
    } catch (err) {
      alert(err.response?.data?.error || 'Não deu pra adicionar.');
    }
  };

  const removerEncaminhamento = async (id) => {
    if (!confirm('Remover esse encaminhamento? A rotina criada pro responsável também sai.')) return;
    await api.delete(`/reunioes/encaminhamentos/${id}`);
    load();
  };

  const apagarReuniao = async () => {
    if (!confirm('Apagar essa reunião? Essa ação não tem volta.')) return;
    try {
      await api.delete(`/reunioes/${reuniaoId}`);
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

  const inicio = new Date(reuniao.inicio);
  const fim = new Date(reuniao.fim);
  const jaPassou = fim < new Date();
  const souDono = reuniao.souDono;

  return (
    <div className="fixed inset-0 bg-black/40 flex items-start justify-center z-50 overflow-y-auto py-[4vh] px-4">
      <div className="bg-white rounded-xl w-[480px] max-w-full p-5 my-auto" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-start justify-between gap-3 mb-3 pb-3 border-b" style={{ borderColor: 'var(--pagina-borda)' }}>
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              <span className="text-[15.5px] font-semibold text-slate-800 truncate">{reuniao.titulo}</span>
              <span className="text-[10px] rounded-full px-2 py-0.5 shrink-0"
                style={reuniao.tipo === 'externa' ? { background: '#FAEEDA', color: '#633806' } : { background: '#E6F1FB', color: '#0C447C' }}>
                {reuniao.tipo === 'externa' ? 'Externa' : 'Interna'}
              </span>
            </div>
            <div className="text-[12px] text-slate-500 mt-0.5">
              {inicio.toLocaleDateString('pt-BR')} · {inicio.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })} às {fim.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
              {reuniao.local ? ` · ${reuniao.local}` : ''}
            </div>
            <div className="text-[11px] text-slate-400 mt-0.5">Criada por {reuniao.criado_por_nome}</div>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            {souDono && <button onClick={apagarReuniao} className="text-slate-400 hover:text-red-500"><Trash2 size={15} /></button>}
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
          Participantes {jaPassou && souDono ? '— marque quem esteve presente' : ''}
        </div>
        <div className="flex flex-wrap gap-1.5 mb-4">
          {reuniao.participantes.map((p) => {
            const presente = presencas[p.userId];
            return (
              <button
                key={p.userId}
                type="button"
                disabled={!souDono || !jaPassou}
                onClick={() => setPresencas((prev) => ({ ...prev, [p.userId]: !prev[p.userId] }))}
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

        <div className="text-[13px] font-semibold text-slate-800 mb-1.5">Ata da reunião</div>
        {souDono ? (
          <textarea
            value={ata}
            onChange={(e) => setAta(e.target.value)}
            rows={6}
            placeholder="O que foi conversado, o que ficou decidido..."
            className="w-full border border-slate-200 rounded-lg px-3 py-2 text-[12.5px] resize-none focus:outline-none focus:ring-2 focus:ring-[#2563EB] mb-1"
          />
        ) : (
          <div className="border rounded-lg px-3 py-2 text-[12.5px] text-slate-600 whitespace-pre-wrap mb-1 min-h-[80px]" style={{ borderColor: 'var(--pagina-borda)' }}>
            {ata || <span className="text-slate-400">A ata ainda não foi escrita.</span>}
          </div>
        )}
        {reuniao.ata_atualizada_em && (
          <div className="text-[10.5px] text-slate-400 mb-3">
            Atualizada em {new Date(reuniao.ata_atualizada_em).toLocaleString('pt-BR')}
          </div>
        )}
        {!souDono && <div className="text-[10.5px] text-slate-400 mb-3">Só quem criou a reunião pode escrever a ata.</div>}

        <div className="text-[13px] font-semibold text-slate-800 mb-1.5 mt-3">Encaminhamentos</div>
        <div className="flex flex-col gap-1.5 mb-2">
          {reuniao.encaminhamentos.length === 0 && (
            <p className="text-[12px] text-slate-400">Nada combinado ainda.</p>
          )}
          {reuniao.encaminhamentos.map((e) => (
            <div key={e.id} className="border rounded-lg px-3 py-2 flex items-start gap-2" style={{ borderColor: 'var(--pagina-borda)' }}>
              <div className="flex-1 min-w-0">
                <div className="text-[12.5px] text-slate-700">{e.descricao}</div>
                <div className="text-[11px] text-slate-500 mt-0.5 flex items-center gap-1">
                  <User size={11} /> {e.responsavel_nome} · prazo {new Date(e.prazo).toLocaleDateString('pt-BR')} · vira rotina
                </div>
              </div>
              {souDono && (
                <button onClick={() => removerEncaminhamento(e.id)} className="text-slate-400 hover:text-red-500 shrink-0"><Trash2 size={13} /></button>
              )}
            </div>
          ))}
        </div>

        {souDono && (
          <div className="border border-dashed rounded-lg p-2.5 mb-4" style={{ borderColor: 'var(--pagina-borda)' }}>
            <input value={novoTexto} onChange={(e) => setNovoTexto(e.target.value)} placeholder="O que ficou combinado..."
              className="w-full border border-slate-200 rounded-lg px-2.5 py-1.5 text-[12.5px] mb-1.5 focus:outline-none focus:ring-2 focus:ring-[#2563EB]" />
            <div className="flex gap-1.5">
              <select value={novoResp} onChange={(e) => setNovoResp(e.target.value)}
                className="flex-1 border border-slate-200 rounded-lg px-2 py-1.5 text-[12px]">
                <option value="">Responsável...</option>
                {users.map((u) => <option key={u.id} value={u.id}>{u.name}</option>)}
              </select>
              <input type="date" value={novoPrazo} onChange={(e) => setNovoPrazo(e.target.value)}
                className="border border-slate-200 rounded-lg px-2 py-1.5 text-[12px]" />
              <button type="button" onClick={adicionarEncaminhamento}
                className="text-white rounded-lg px-2.5 flex items-center" style={{ background: NAVY }}>
                <Plus size={14} />
              </button>
            </div>
          </div>
        )}

        {souDono && (
          <button onClick={salvarAta} disabled={salvando}
            className="w-full rounded-lg py-2.5 text-sm font-medium text-white disabled:opacity-40" style={{ background: NAVY }}>
            {salvando ? 'Salvando...' : 'Salvar ata'}
          </button>
        )}
      </div>
    </div>
  );
}
