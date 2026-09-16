// client/src/gestao/pages/Reuniao.jsx
import { useEffect, useState } from 'react';
import { Video, ChevronLeft, ChevronRight, Plus } from 'lucide-react';
import PageHeader from '../PageHeader';
import { api } from '../../api';
import ReuniaoFormModal from '../components/ReuniaoFormModal';
import ReuniaoDetalheModal from '../components/ReuniaoDetalheModal';

const NAVY = '#2563EB';
const DIAS_SEMANA = ['dom', 'seg', 'ter', 'qua', 'qui', 'sex', 'sáb'];
const MESES = ['Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho', 'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'];

function mesmoDia(a, b) {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
}

// Monta a grade do mês, começando no domingo da primeira semana e indo até
// o sábado da última — é o que dá aquele formato de calendário certinho.
function gerarGradeDoMes(ano, mes) {
  const primeiro = new Date(ano, mes, 1);
  const inicio = new Date(primeiro);
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

export default function Reuniao() {
  const hoje = new Date();
  const [mesAtual, setMesAtual] = useState(new Date(hoje.getFullYear(), hoje.getMonth(), 1));
  const [reunioes, setReunioes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [diaForm, setDiaForm] = useState(null);     // usado só quando o botão "Nova reunião" é clicado
  const [diaAberto, setDiaAberto] = useState(null);  // dia clicado no calendário — mostra a lista do dia
  const [reuniaoAberta, setReuniaoAberta] = useState(null); // id

  const load = () => {
    setLoading(true);
    const primeiroDia = new Date(mesAtual.getFullYear(), mesAtual.getMonth(), 1);
    const ultimoDia = new Date(mesAtual.getFullYear(), mesAtual.getMonth() + 1, 0);
    // Pega uma margem de uma semana pra cada lado, por causa dos dias de outros
    // meses que aparecem na primeira e última linha da grade
    const de = new Date(primeiroDia); de.setDate(de.getDate() - 7);
    const ate = new Date(ultimoDia); ate.setDate(ate.getDate() + 7);
    api.get('/reunioes', { params: { de: de.toISOString().slice(0, 10), ate: ate.toISOString().slice(0, 10) } })
      .then(({ data }) => { setReunioes(data.reunioes); setLoading(false); })
      .catch(() => setLoading(false));
  };

  useEffect(() => { load(); }, [mesAtual]); // eslint-disable-line react-hooks/exhaustive-deps

  const dias = gerarGradeDoMes(mesAtual.getFullYear(), mesAtual.getMonth());
  const reunioesDoDia = (dia) => reunioes.filter((r) => mesmoDia(new Date(r.inicio), dia));

  const trocarMes = (delta) => {
    setMesAtual(new Date(mesAtual.getFullYear(), mesAtual.getMonth() + delta, 1));
  };

  return (
    <div className="flex-1 flex flex-col overflow-hidden">
      <PageHeader icon={Video} title="Reuniões" subtitle="Agenda, lembretes e atas das reuniões" />

      <div className="px-6 py-3 bg-white border-b flex items-center gap-3" style={{ borderColor: 'var(--pagina-borda)' }}>
        <button onClick={() => trocarMes(-1)} className="text-slate-500 hover:text-slate-700"><ChevronLeft size={18} /></button>
        <span className="text-[13.5px] font-semibold text-slate-800 min-w-[140px] text-center">
          {MESES[mesAtual.getMonth()]} {mesAtual.getFullYear()}
        </span>
        <button onClick={() => trocarMes(1)} className="text-slate-500 hover:text-slate-700"><ChevronRight size={18} /></button>
        <button
          onClick={() => setMesAtual(new Date(hoje.getFullYear(), hoje.getMonth(), 1))}
          className="text-[12px] font-medium border rounded-lg px-2.5 py-1"
          style={{ borderColor: 'var(--pagina-borda)', color: 'var(--pagina-texto-2)' }}
        >
          Hoje
        </button>
        <div className="flex-1" />
        <div className="flex items-center gap-3 mr-2">
          <span className="flex items-center gap-1.5 text-[11.5px]" style={{ color: 'var(--pagina-texto-2)' }}>
            <span className="w-2.5 h-2.5 rounded-sm" style={{ background: '#85B7EB' }} /> Interna
          </span>
          <span className="flex items-center gap-1.5 text-[11.5px]" style={{ color: 'var(--pagina-texto-2)' }}>
            <span className="w-2.5 h-2.5 rounded-sm" style={{ background: '#EF9F27' }} /> Externa
          </span>
        </div>
        <button
          onClick={() => setDiaForm(new Date())}
          className="flex items-center gap-1.5 text-white text-[13px] font-medium px-3 py-2 rounded-lg"
          style={{ background: NAVY }}
        >
          <Plus size={15} /> Nova reunião
        </button>
      </div>

      <div className="flex-1 overflow-y-auto p-6" style={{ background: 'var(--pagina-fundo)' }}>
        <div className="bg-white rounded-xl border p-3" style={{ borderColor: 'var(--pagina-borda)' }}>
          <div className="grid grid-cols-7 gap-1 mb-1.5">
            {DIAS_SEMANA.map((d) => (
              <div key={d} className="text-[11px] text-center" style={{ color: 'var(--pagina-texto-2)' }}>{d}</div>
            ))}
          </div>
          <div className="grid grid-cols-7 gap-1">
            {dias.map((dia, i) => {
              const doMes = dia.getMonth() === mesAtual.getMonth();
              const ehHoje = mesmoDia(dia, hoje);
              const doDia = reunioesDoDia(dia);
              return (
                <button
                  key={i}
                  onClick={() => doDia.length > 0 && setDiaAberto(dia)}
                  className="min-h-[78px] rounded-md p-1.5 text-left border transition-colors hover:border-[#2563EB]"
                  style={{
                    borderColor: ehHoje ? NAVY : 'var(--pagina-borda)',
                    borderWidth: ehHoje ? 2 : 1,
                    opacity: doMes ? 1 : 0.4,
                    background: ehHoje ? '#EFF4FF' : 'transparent',
                    cursor: doDia.length > 0 ? 'pointer' : 'default',
                  }}
                >
                  <span className="text-[11px] font-medium" style={{ color: ehHoje ? NAVY : 'var(--pagina-texto-2)' }}>
                    {dia.getDate()}{ehHoje ? ' hoje' : ''}
                  </span>
                  <div className="flex flex-col gap-0.5 mt-1">
                    {doDia.slice(0, 3).map((r) => (
                      <span
                        key={r.id}
                        onClick={(e) => { e.stopPropagation(); setReuniaoAberta(r.id); }}
                        className="text-[10px] rounded px-1 py-0.5 truncate block"
                        style={r.tipo === 'externa'
                          ? { background: '#FAEEDA', color: '#633806' }
                          : { background: '#E6F1FB', color: '#0C447C' }}
                      >
                        {new Date(r.inicio).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })} {r.titulo}
                      </span>
                    ))}
                    {doDia.length > 3 && (
                      <span
                        onClick={(e) => { e.stopPropagation(); setDiaAberto(dia); }}
                        className="text-[10px] font-medium hover:underline"
                        style={{ color: NAVY }}
                      >
                        +{doDia.length - 3} mais
                      </span>
                    )}
                  </div>
                </button>
              );
            })}
          </div>
          {loading && <p className="text-[12px] mt-3" style={{ color: 'var(--pagina-texto-2)' }}>Carregando reuniões...</p>}
        </div>
      </div>

      {diaAberto && (
        <div className="fixed inset-0 bg-black/40 flex items-start justify-center z-50 overflow-y-auto py-[4vh] px-4" onClick={() => setDiaAberto(null)}>
          <div className="bg-white rounded-xl w-[440px] max-w-full p-5" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-slate-800 font-semibold text-base">
                Reuniões — {diaAberto.toLocaleDateString('pt-BR')}
              </h3>
              <button onClick={() => setDiaAberto(null)} className="text-slate-400 hover:text-slate-600 text-xl leading-none">×</button>
            </div>
            <div className="flex flex-col gap-2 max-h-[60vh] overflow-y-auto">
              {reunioesDoDia(diaAberto)
                .sort((a, b) => new Date(a.inicio) - new Date(b.inicio))
                .map((r) => (
                  <button
                    key={r.id}
                    onClick={() => { setDiaAberto(null); setReuniaoAberta(r.id); }}
                    className="text-left border rounded-lg p-3 hover:border-[#2563EB] transition-colors"
                    style={{ borderColor: 'var(--pagina-borda)' }}
                  >
                    <div className="flex items-center gap-2">
                      <span className="text-[13px] font-semibold text-slate-800">{r.titulo}</span>
                      <span
                        className="text-[9.5px] rounded-full px-1.5 py-0.5 shrink-0"
                        style={r.tipo === 'externa' ? { background: '#FAEEDA', color: '#633806' } : { background: '#E6F1FB', color: '#0C447C' }}
                      >
                        {r.tipo === 'externa' ? 'Externa' : 'Interna'}
                      </span>
                    </div>
                    <div className="text-[12px] text-slate-500 mt-0.5">
                      {new Date(r.inicio).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })} às {new Date(r.fim).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
                      {r.local ? ` · ${r.local}` : ''}
                    </div>
                  </button>
                ))}
            </div>
          </div>
        </div>
      )}

      {diaForm && (
        <ReuniaoFormModal
          dataInicial={diaForm}
          onClose={() => setDiaForm(null)}
          onSaved={() => { setDiaForm(null); load(); }}
        />
      )}
      {reuniaoAberta && (
        <ReuniaoDetalheModal
          reuniaoId={reuniaoAberta}
          onClose={() => setReuniaoAberta(null)}
          onChanged={load}
        />
      )}
    </div>
  );
}
