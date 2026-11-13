import { useCallback, useEffect, useMemo, useState } from "react";
import { CalendarRange, ChevronLeft, ChevronRight, Plus, X, Trash2 } from "lucide-react";
import { api } from "../api";
import PageHeader from "../gestao/PageHeader";

const P = "#7C3AED";
const CANAIS = {
  whatsapp: { nome: "WhatsApp", cor: "#16A34A" },
  discador: { nome: "Discador", cor: "#2563EB" },
  sms: { nome: "SMS", cor: "#D97706" },
  email: { nome: "E-mail", cor: "#DB2777" },
  fila: { nome: "Fila", cor: "#7C3AED" },
};
const STATUS = {
  planejada: { nome: "Planejada", bg: "rgba(124,58,237,.14)", cor: "#7C3AED", icone: "○" },
  andamento: { nome: "Em andamento", bg: "rgba(217,119,6,.16)", cor: "#D97706", icone: "●" },
  feita: { nome: "Feita", bg: "rgba(22,163,74,.16)", cor: "#16A34A", icone: "✔" },
  atrasada: { nome: "Atrasada", bg: "rgba(220,38,38,.16)", cor: "#DC2626", icone: "!" },
};
const INDICADORES = [
  { k: "acionamentos", nome: "Acionamentos", moeda: false },
  { k: "cpc", nome: "CPC (contatos)", moeda: false },
  { k: "acordos", nome: "Acordos", moeda: false },
  { k: "recebimento", nome: "Recebimento", moeda: true },
];
const DIAS = ["Seg", "Ter", "Qua", "Qui", "Sex"];
const inp = { background: "var(--pagina-fundo)", border: "1px solid var(--pagina-borda)", color: "var(--pagina-texto-1)" };
const card = { background: "var(--pagina-cartao)", border: "1px solid var(--pagina-borda-suave)" };

const pad = (n) => String(n).padStart(2, "0");
const chave = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
function segundaDe(d) { const x = new Date(d.getFullYear(), d.getMonth(), d.getDate()); x.setDate(x.getDate() - ((x.getDay() + 6) % 7)); return x; }
const fmtNum = (v, moeda) => (moeda ? "R$ " : "") + Number(v || 0).toLocaleString("pt-BR");

export default function EstrategiaSemana() {
  const [inicio, setInicio] = useState(() => segundaDe(new Date()));
  const [dados, setDados] = useState(null);
  const [erro, setErro] = useState("");
  const [modal, setModal] = useState(null); // { acao?, carteira, dia }
  const [novaCarteira, setNovaCarteira] = useState("");
  const [vista, setVista] = useState("semana"); // semana | dia
  const [diaSel, setDiaSel] = useState(() => { const d = (new Date().getDay() + 6) % 7; return d > 4 ? 0 : d; });
  const semana = chave(inicio);

  const carregar = useCallback(async () => {
    try { const { data } = await api.get("/estrategia", { params: { semana } }); setDados(data); setErro(""); }
    catch (e) { setErro(e.response?.data?.error || "Não foi possível carregar a estratégia."); }
  }, [semana]);
  useEffect(() => { setDados(null); carregar(); }, [carregar]);

  const salvarSemana = async (novo) => {
    setDados(novo);
    try { await api.put("/estrategia/semana", { semana, foco: novo.foco, metas: novo.metas, realizados: novo.realizados, carteiras: novo.carteiras }); }
    catch { setErro("Não foi possível salvar."); }
  };

  const datas = useMemo(() => DIAS.map((_, i) => { const d = new Date(inicio); d.setDate(d.getDate() + i); return d; }), [inicio]);
  const hoje = chave(new Date());

  const statusEfetivo = (a) => {
    if (a.status === "feita") return "feita";
    return chave(datas[a.dia]) < hoje ? "atrasada" : a.status;
  };

  const acoes = dados?.acoes || [];
  const feitas = acoes.filter((a) => a.status === "feita").length;
  const atrasadas = acoes.filter((a) => statusEfetivo(a) === "atrasada").length;

  const salvarAcao = async (f) => {
    try {
      if (f.id) {
        const { data } = await api.patch(`/estrategia/acoes/${f.id}`, { carteira: f.carteira, dia: f.dia, canal: f.canal, titulo: f.titulo, responsavel: f.responsavel, status: f.status });
        setDados((d) => ({ ...d, acoes: d.acoes.map((a) => (a.id === f.id ? data.acao : a)) }));
      } else {
        const { data } = await api.post("/estrategia/acoes", { semana, ...f });
        setDados((d) => ({ ...d, acoes: [...d.acoes, data.acao] }));
      }
      setModal(null);
    } catch (e) { throw new Error(e.response?.data?.error || "Não foi possível salvar a ação."); }
  };
  const excluirAcao = async (id) => {
    if (!window.confirm("Excluir esta ação?")) return;
    await api.delete(`/estrategia/acoes/${id}`);
    setDados((d) => ({ ...d, acoes: d.acoes.filter((a) => a.id !== id) }));
    setModal(null);
  };
  const ciclar = async (a) => {
    const prox = { planejada: "feita", andamento: "feita", feita: "planejada" }[a.status];
    const { data } = await api.patch(`/estrategia/acoes/${a.id}`, { status: prox });
    setDados((d) => ({ ...d, acoes: d.acoes.map((x) => (x.id === a.id ? data.acao : x)) }));
  };

  const renderAcao = (a) => {
    const s = STATUS[statusEfetivo(a)], ca = CANAIS[a.canal];
    return (
      <div key={a.id} className="rounded-lg px-2 py-1.5 text-[12.5px] cursor-pointer" onClick={() => setModal({ acao: a })}
        style={{ background: "var(--pagina-cartao)", border: "1px solid var(--pagina-borda-suave)", borderLeft: `4px solid ${ca.cor}`, color: "var(--pagina-texto-1)" }}>
        <div className="font-semibold leading-snug">{a.titulo}</div>
        {(a.loja || a.quantidade || a.valores || a.acionado) && <div className="text-[11px] opacity-70 leading-snug">{[a.loja, a.quantidade && `${a.quantidade} qtd.`, a.valores && `R$ ${a.valores}`, a.acionado && `${a.acionado} acion.`].filter(Boolean).join(" · ")}</div>}
        <button onClick={(e) => { e.stopPropagation(); ciclar(a); }} title="Clique para mudar o status" className="mt-0.5 text-[11px] font-semibold rounded-full px-2 py-0.5" style={{ background: s.bg, color: s.cor }}>{s.icone} {s.nome}</button>
      </div>
    );
  };

  const rotuloSemana = `${pad(datas[0].getDate())}/${pad(datas[0].getMonth() + 1)} a ${pad(datas[4].getDate())}/${pad(datas[4].getMonth() + 1)}`;
  const mover = (n) => setInicio((i) => { const d = new Date(i); d.setDate(d.getDate() + 7 * n); return d; });

  return (
    <div className="flex flex-col h-full min-h-0 flex-1 w-full min-w-0">
      <PageHeader icon={CalendarRange} title="Estratégia da semana" subtitle="Visível para os ADMs · cronograma e acompanhamento da cobrança" />
      <div className="flex-1 overflow-auto p-3 md:p-5">
        {erro && <p className="text-red-500 text-sm mb-3">{erro}</p>}
        <div className="flex flex-wrap items-center gap-2 mb-4">
          <button onClick={() => mover(-1)} className="p-2 rounded-lg" style={inp} aria-label="Semana anterior"><ChevronLeft size={16} /></button>
          <div className="px-3 py-2 rounded-lg text-sm font-semibold" style={{ ...card, color: "var(--pagina-texto-1)" }}>Semana {rotuloSemana}</div>
          <button onClick={() => mover(1)} className="p-2 rounded-lg" style={inp} aria-label="Próxima semana"><ChevronRight size={16} /></button>
          <button onClick={() => setInicio(segundaDe(new Date()))} className="px-3 py-2 rounded-lg text-sm" style={{ ...inp, color: P }}>Esta semana</button>
          <div className="flex rounded-lg overflow-hidden ml-2" style={{ border: "1px solid var(--pagina-borda)" }}>
            {[["semana", "Semana"], ["dia", "Dia"]].map(([k, t]) => (
              <button key={k} onClick={() => setVista(k)} className="px-3 py-2 text-sm font-medium" style={vista === k ? { background: P, color: "#fff" } : { background: "var(--pagina-fundo)", color: P }}>{t}</button>
            ))}
          </div>
          {vista === "dia" && DIAS.map((d, i) => (
            <button key={d} onClick={() => setDiaSel(i)} className="px-2.5 py-2 rounded-lg text-sm font-medium" style={diaSel === i ? { background: "#5B21B6", color: "#fff" } : { ...inp, color: P }}>{d} {pad(datas[i].getDate())}</button>
          ))}
          <div className="flex-1" />
          <span className="text-xs rounded-full px-3 py-1.5 font-semibold" style={{ background: "rgba(22,163,74,.16)", color: "#16A34A" }}>{feitas} de {acoes.length} ações feitas</span>
          <span className="text-xs rounded-full px-3 py-1.5 font-semibold" style={{ background: atrasadas ? "rgba(220,38,38,.16)" : "rgba(124,58,237,.14)", color: atrasadas ? "#DC2626" : P }}>{atrasadas} atrasada(s)</span>
        </div>

        {!dados ? <p className="opacity-60 text-sm">Carregando…</p> : (
          <>
            <div className="rounded-2xl px-4 py-3 mb-4 flex items-center gap-3" style={{ ...card, borderLeft: `6px solid ${P}` }}>
              <b className="text-sm shrink-0" style={{ color: "var(--pagina-texto-1)" }}>Foco da semana:</b>
              <input defaultValue={dados.foco} key={semana + "foco"} placeholder="Ex.: campanha de desconto Nossa Saúde + reativação"
                onBlur={(e) => e.target.value !== dados.foco && salvarSemana({ ...dados, foco: e.target.value })}
                className="flex-1 min-w-0 bg-transparent outline-none text-sm" style={{ color: "var(--pagina-texto-1)" }} />
            </div>

            <div className="rounded-2xl p-2 overflow-x-auto" style={card}>
              {vista === "semana" ? (
              <table className="w-full min-w-[900px]" style={{ borderCollapse: "separate", borderSpacing: 6 }}>
                <thead>
                  <tr>
                    <th />
                    {datas.map((d, i) => (
                      <th key={i} className="text-xs uppercase tracking-wide py-2 rounded-lg text-white" style={{ background: chave(d) === hoje ? P : "#5B21B6" }}>
                        {DIAS[i]} {pad(d.getDate())}/{pad(d.getMonth() + 1)}{chave(d) === hoje ? " · hoje" : ""}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {dados.carteiras.map((c) => {
                    const canaisUsados = Object.keys(CANAIS).filter((k) => acoes.some((a) => a.carteira === c && a.canal === k));
                    return [
                      <tr key={c + "h"}>
                        <td colSpan={6} className="pt-3">
                          <div className="flex items-center gap-2 rounded-lg px-3 py-1.5 text-[13px] font-bold" style={{ background: "rgba(124,58,237,.10)", color: "var(--pagina-texto-1)" }}>
                            <span className="flex-1">{c}</span>
                            <button title="Remover carteira" className="opacity-40 hover:opacity-100" onClick={() => { if (window.confirm(`Remover a carteira "${c}" do quadro?`)) salvarSemana({ ...dados, carteiras: dados.carteiras.filter((x) => x !== c) }); }}><X size={13} /></button>
                          </div>
                        </td>
                      </tr>,
                      ...canaisUsados.map((k) => (
                        <tr key={c + k}>
                          <td className="align-top w-[120px] pt-2 text-[12px] font-semibold whitespace-nowrap" style={{ color: CANAIS[k].cor }}>
                            <i className="inline-block w-2.5 h-2.5 rounded-sm mr-1.5" style={{ background: CANAIS[k].cor }} />{CANAIS[k].nome}
                          </td>
                          {DIAS.map((_, dia) => (
                            <td key={dia} className="align-top" style={chave(datas[dia]) === hoje ? { background: "rgba(124,58,237,.07)", borderRadius: 10 } : undefined}>
                              <div className="flex flex-col gap-1 p-0.5">
                                {acoes.filter((a) => a.carteira === c && a.dia === dia && a.canal === k).map(renderAcao)}
                                <button onClick={() => setModal({ carteira: c, dia, canal: k })} className="rounded-md text-xs opacity-30 hover:opacity-100 flex items-center justify-center" style={{ color: P }}><Plus size={12} /></button>
                              </div>
                            </td>
                          ))}
                        </tr>
                      )),
                      <tr key={c + "+"}>
                        <td className="text-[11.5px] opacity-60 pt-1" style={{ color: P }}>+ nova ação</td>
                        {DIAS.map((_, dia) => (
                          <td key={dia}>
                            <button onClick={() => setModal({ carteira: c, dia })} className="w-full rounded-md py-1 text-xs opacity-40 hover:opacity-100 flex items-center justify-center" style={{ border: "1px dashed var(--pagina-borda)", color: P }}><Plus size={13} /></button>
                          </td>
                        ))}
                      </tr>,
                    ];
                  })}
                </tbody>
              </table>
              ) : (
              <table className="w-full min-w-[900px]" style={{ borderCollapse: "separate", borderSpacing: 6 }}>
                <thead>
                  <tr>
                    <th />
                    {Object.entries(CANAIS).map(([k, v]) => <th key={k} className="text-xs uppercase tracking-wide py-2 rounded-lg text-white" style={{ background: v.cor }}>{v.nome}</th>)}
                  </tr>
                </thead>
                <tbody>
                  {dados.carteiras.map((c) => (
                    <tr key={c}>
                      <td className="align-top w-[140px] pt-2 text-[13px] font-bold" style={{ color: "var(--pagina-texto-1)" }}>{c}</td>
                      {Object.keys(CANAIS).map((k) => (
                        <td key={k} className="align-top">
                          <div className="flex flex-col gap-1 p-0.5">
                            {acoes.filter((a) => a.carteira === c && a.dia === diaSel && a.canal === k).map(renderAcao)}
                            <button onClick={() => setModal({ carteira: c, dia: diaSel, canal: k })} className="rounded-md text-xs opacity-30 hover:opacity-100 flex items-center justify-center" style={{ color: P }}><Plus size={12} /></button>
                          </div>
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
              )}
              <form className="flex gap-2 p-2" onSubmit={(e) => { e.preventDefault(); const n = novaCarteira.trim(); if (n && !dados.carteiras.includes(n)) salvarSemana({ ...dados, carteiras: [...dados.carteiras, n] }); setNovaCarteira(""); }}>
                <input value={novaCarteira} onChange={(e) => setNovaCarteira(e.target.value)} placeholder="Adicionar carteira…" className="px-3 py-1.5 rounded-lg text-sm" style={inp} />
                <button className="px-3 py-1.5 rounded-lg text-sm text-white font-medium" style={{ background: P }}>Adicionar</button>
              </form>
            </div>
            <div className="flex flex-wrap gap-4 text-xs mt-3" style={{ color: "var(--pagina-texto-2)" }}>
              {Object.values(CANAIS).map((c) => <span key={c.nome}><i className="inline-block w-2.5 h-2.5 rounded-sm mr-1.5" style={{ background: c.cor }} />{c.nome}</span>)}
              <span className="ml-auto">Clique no status para avançar · dias passados sem “Feita” ficam como atrasada</span>
            </div>
          </>
        )}
      </div>
      {modal && dados && <FormAcao modal={modal} carteiras={dados.carteiras} onSalvar={salvarAcao} onExcluir={excluirAcao} onClose={() => setModal(null)} />}
    </div>
  );
}

const L = ({ t, children }) => <label className="block text-xs font-medium mb-3" style={{ color: "var(--pagina-texto-2)" }}>{t}<div className="mt-1">{children}</div></label>;

function FormAcao({ modal, carteiras, onSalvar, onExcluir, onClose }) {
  const a = modal.acao;
  const [f, setF] = useState(a ? { ...a } : { carteira: modal.carteira, dia: modal.dia, canal: modal.canal || "whatsapp", titulo: "", responsavel: "", status: "planejada", loja: "", quantidade: "", valores: "", acionado: "", situacoes: "", indicadores: "", observacao: "" });
  const [erro, setErro] = useState("");
  const [salvando, setSalvando] = useState(false);
  const submit = async (e) => {
    e.preventDefault(); setSalvando(true); setErro("");
    try { await onSalvar(f); } catch (err) { setErro(err.message); } finally { setSalvando(false); }
  };
  const cls = "w-full rounded-lg px-3 py-2 text-sm";
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: "rgba(0,0,0,.45)" }} onClick={onClose}>
      <form onSubmit={submit} onClick={(e) => e.stopPropagation()} className="w-full max-w-md rounded-2xl p-5 max-h-[90vh] overflow-auto" style={{ background: "var(--pagina-cartao)", color: "var(--pagina-texto-1)" }}>
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-semibold">{a ? "Editar ação" : "Nova ação"}</h3>
          <button type="button" onClick={onClose}><X size={18} /></button>
        </div>
        <L t="O que será feito"><input autoFocus required value={f.titulo} onChange={(e) => setF({ ...f, titulo: e.target.value })} className={cls} style={inp} placeholder="Ex.: Preventivo WhatsApp" /></L>
        <div className="grid grid-cols-2 gap-3">
          <L t="Canal"><select value={f.canal} onChange={(e) => setF({ ...f, canal: e.target.value })} className={cls} style={inp}>{Object.entries(CANAIS).map(([k, v]) => <option key={k} value={k}>{v.nome}</option>)}</select></L>
          <L t="Status"><select value={f.status} onChange={(e) => setF({ ...f, status: e.target.value })} className={cls} style={inp}><option value="planejada">Planejada</option><option value="feita">Feita</option></select></L>
        </div>
        <L t="Loja"><input value={f.loja || ""} onChange={(e) => setF({ ...f, loja: e.target.value })} className={cls} style={inp} placeholder="Ex.: HAPVIDA NOTREDAME CANCELADO" /></L>
        <div className="grid grid-cols-3 gap-3">
          <L t="Quantidade"><input value={f.quantidade || ""} onChange={(e) => setF({ ...f, quantidade: e.target.value })} className={cls} style={inp} placeholder="Ex.: 500" /></L>
          <L t="Valores (R$)"><input value={f.valores || ""} onChange={(e) => setF({ ...f, valores: e.target.value })} className={cls} style={inp} placeholder="Ex.: 150.000,00" /></L>
          <L t="Acionado"><input value={f.acionado || ""} onChange={(e) => setF({ ...f, acionado: e.target.value })} className={cls} style={inp} placeholder="Ex.: 1.200" /></L>
        </div>
        <L t="Situações"><input value={f.situacoes || ""} onChange={(e) => setF({ ...f, situacoes: e.target.value })} className={cls} style={inp} placeholder="Ex.: Proposta, Promessa, Sem contato" /></L>
        <L t="Indicadores"><input value={f.indicadores || ""} onChange={(e) => setF({ ...f, indicadores: e.target.value })} className={cls} style={inp} placeholder="Ex.: CPC 40%, conversão 8%" /></L>
        <L t="Observação"><textarea rows={3} value={f.observacao || ""} onChange={(e) => setF({ ...f, observacao: e.target.value })} className={cls} style={inp} /></L>
        {erro && <p className="text-red-500 text-sm mb-2">{erro}</p>}
        <div className="flex items-center gap-2">
          {a && <button type="button" onClick={() => onExcluir(a.id)} className="p-2 rounded-lg" style={inp} title="Excluir"><Trash2 size={16} /></button>}
          <div className="flex-1" />
          <button type="button" onClick={onClose} className="px-4 py-2 rounded-lg text-sm" style={inp}>Cancelar</button>
          <button disabled={salvando} className="px-4 py-2 rounded-lg text-sm text-white font-medium" style={{ background: P }}>{salvando ? "Salvando…" : "Salvar"}</button>
        </div>
      </form>
    </div>
  );
}
