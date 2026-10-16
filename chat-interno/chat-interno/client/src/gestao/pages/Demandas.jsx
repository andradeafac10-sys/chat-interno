import { useEffect, useMemo, useState, useCallback } from "react";
import { ListChecks, Plus, Star, Trash2, ClipboardPaste, Search, X } from "lucide-react";
import PageHeader from "../PageHeader";
import { api } from "../../api";
import { getSocket } from "../../socket";

const P = "#7C3AED";
const hoje = () => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`; };
const fmt = (d) => (d ? d.split("-").reverse().join("/") : "—");
const card = { background: "var(--pagina-cartao)" };

function Modal({ titulo, onClose, children }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: "rgba(20,10,40,.55)" }} onMouseDown={onClose}>
      <div className="w-full max-w-lg rounded-2xl p-5 shadow-2xl" style={{ background: "var(--pagina-cartao)", color: "var(--pagina-texto-1)" }} onMouseDown={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-3">
          <h3 className="font-semibold">{titulo}</h3>
          <button onClick={onClose}><X size={18} /></button>
        </div>
        {children}
      </div>
    </div>
  );
}

const inp = { background: "var(--pagina-fundo)", border: "1px solid var(--pagina-borda)", color: "var(--pagina-texto-1)" };

function PessoasPicker({ pessoas, value, onChange }) {
  return (
    <div className="flex flex-wrap gap-1.5">
      {pessoas.map((p) => {
        const on = value.includes(p.id);
        return (
          <button type="button" key={p.id} onClick={() => onChange(on ? value.filter((x) => x !== p.id) : [...value, p.id])}
            className="px-2.5 py-1 rounded-full text-xs font-medium"
            style={on ? { background: P, color: "#fff" } : { background: "transparent", color: "var(--pagina-texto-2)", border: "1px solid var(--pagina-borda)" }}>
            {p.name}
          </button>
        );
      })}
    </div>
  );
}

function Form({ inicial, pessoas, onSalvar, onClose }) {
  const [f, setF] = useState(inicial || { demanda: "", obs: "", prazo: "", destaque: false, responsaveis: [] });
  const [erro, setErro] = useState("");
  const [salvando, setSalvando] = useState(false);
  async function salvar() {
    if (!f.demanda.trim()) return setErro("Informe a demanda.");
    setSalvando(true);
    try { await onSalvar(f); onClose(); } catch (e) { setErro(e?.response?.data?.error || "Não foi possível salvar."); setSalvando(false); }
  }
  return (
    <Modal titulo={inicial ? "Editar demanda" : "Nova demanda"} onClose={onClose}>
      <div className="space-y-3 text-sm">
        <div><label className="text-xs opacity-70">Responsável(eis)</label><div className="mt-1"><PessoasPicker pessoas={pessoas} value={f.responsaveis} onChange={(v) => setF({ ...f, responsaveis: v })} /></div></div>
        <div><label className="text-xs opacity-70">Demanda</label><textarea rows={2} className="w-full rounded-lg px-3 py-2 mt-1" style={inp} value={f.demanda} onChange={(e) => setF({ ...f, demanda: e.target.value })} /></div>
        <div><label className="text-xs opacity-70">Observação</label><textarea rows={2} className="w-full rounded-lg px-3 py-2 mt-1" style={inp} value={f.obs} onChange={(e) => setF({ ...f, obs: e.target.value })} /></div>
        <div className="flex items-center gap-4">
          <div><label className="text-xs opacity-70">Prazo</label><input type="date" className="block rounded-lg px-3 py-2 mt-1" style={inp} value={f.prazo || ""} onChange={(e) => setF({ ...f, prazo: e.target.value })} /></div>
          <label className="flex items-center gap-2 mt-5"><input type="checkbox" checked={f.destaque} onChange={(e) => setF({ ...f, destaque: e.target.checked })} /> Destacar</label>
        </div>
        {erro && <p className="text-red-500 text-xs">{erro}</p>}
        <div className="flex justify-end gap-2 pt-1">
          <button onClick={onClose} className="px-4 py-2 rounded-lg" style={{ border: "1px solid var(--pagina-borda)" }}>Cancelar</button>
          <button onClick={salvar} disabled={salvando} className="px-4 py-2 rounded-lg text-white font-medium" style={{ background: P }}>{salvando ? "Salvando…" : "Salvar"}</button>
        </div>
      </div>
    </Modal>
  );
}

function Importar({ onClose, onFeito }) {
  const [texto, setTexto] = useState("");
  const [res, setRes] = useState(null);
  const [erro, setErro] = useState("");
  async function ir() {
    try { const { data } = await api.post("/demandas/importar", { texto }); setRes(data); onFeito(); } catch (e) { setErro(e?.response?.data?.error || "Falha ao importar."); }
  }
  return (
    <Modal titulo="Colar da planilha" onClose={onClose}>
      <p className="text-xs opacity-70 mb-2">Copie as linhas da planilha na ordem: Responsável, Demanda, Obs, Prazo, Concluído — e cole abaixo.</p>
      <textarea rows={8} className="w-full rounded-lg px-3 py-2 text-sm" style={inp} value={texto} onChange={(e) => setTexto(e.target.value)} />
      {erro && <p className="text-red-500 text-xs mt-1">{erro}</p>}
      {res && <p className="text-xs mt-2">{res.criadas} demanda(s) importada(s).{res.semMatch.length > 0 && ` Responsáveis não encontrados: ${res.semMatch.join(", ")}.`}</p>}
      <div className="flex justify-end gap-2 mt-3">
        <button onClick={onClose} className="px-4 py-2 rounded-lg text-sm" style={{ border: "1px solid var(--pagina-borda)" }}>Fechar</button>
        <button onClick={ir} className="px-4 py-2 rounded-lg text-sm text-white font-medium" style={{ background: P }}>Importar</button>
      </div>
    </Modal>
  );
}

export default function Demandas() {
  const [lista, setLista] = useState([]);
  const [pessoas, setPessoas] = useState([]);
  const [podeEditar, setPodeEditar] = useState(false);
  const [busca, setBusca] = useState("");
  const [quem, setQuem] = useState("");
  const [concl, setConcl] = useState(false);
  const [modal, setModal] = useState(null);
  const [erro, setErro] = useState("");

  const carregar = useCallback(async () => {
    try { const { data } = await api.get("/demandas"); setLista(data.demandas); setPodeEditar(data.podeEditar); setErro(""); }
    catch { setErro("Não foi possível carregar as demandas."); }
  }, []);
  useEffect(() => {
    carregar();
    api.get("/demandas/pessoas").then((r) => setPessoas(r.data)).catch(() => {});
    const t = setInterval(carregar, 30000);
    let s; try { s = getSocket(); s?.on("demandas:updated", carregar); } catch {}
    return () => { clearInterval(t); try { s?.off("demandas:updated", carregar); } catch {} };
  }, [carregar]);

  const patch = async (id, body) => { const { data } = await api.patch(`/demandas/${id}`, body); setLista((l) => l.map((d) => (d.id === id ? data : d))); };
  const criar = async (f) => { await api.post("/demandas", f); carregar(); };
  const editar = (id) => async (f) => { await patch(id, f); };
  const remover = async (d) => { if (!window.confirm("Excluir esta demanda?")) return; await api.delete(`/demandas/${d.id}`); carregar(); };

  const vis = useMemo(() => {
    const q = busca.toLowerCase();
    return lista.filter((d) => (concl || !d.concluida) &&
      (!quem || d.responsaveis.some((r) => String(r.id) === quem)) &&
      (!q || `${d.demanda} ${d.obs} ${d.responsaveis.map((r) => r.name).join(" ")}`.toLowerCase().includes(q)));
  }, [lista, busca, quem, concl]);

  const abertas = lista.filter((d) => !d.concluida).length;
  const atrasadas = lista.filter((d) => !d.concluida && d.prazo && d.prazo < hoje()).length;

  return (
    <div className="flex flex-col h-full min-h-0">
      <PageHeader icon={ListChecks} title="Demandas" subtitle={`${abertas} em aberto${atrasadas ? ` · ${atrasadas} atrasada(s)` : ""}${podeEditar ? "" : " · somente acompanhamento"}`} />
      <div className="flex-1 overflow-auto p-5">
        <div className="flex flex-wrap items-center gap-2 mb-4">
          <div className="relative">
            <Search size={14} className="absolute left-2.5 top-2.5 opacity-50" />
            <input value={busca} onChange={(e) => setBusca(e.target.value)} placeholder="Buscar…" className="pl-8 pr-3 py-2 rounded-lg text-sm" style={inp} />
          </div>
          <select value={quem} onChange={(e) => setQuem(e.target.value)} className="px-3 py-2 rounded-lg text-sm" style={inp}>
            <option value="">Todos os responsáveis</option>
            {pessoas.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
          </select>
          <label className="flex items-center gap-1.5 text-sm" style={{ color: "var(--pagina-texto-2)" }}>
            <input type="checkbox" checked={concl} onChange={(e) => setConcl(e.target.checked)} /> Mostrar concluídas
          </label>
          <div className="flex-1" />
          {podeEditar && (
            <>
              <button onClick={() => setModal({ t: "imp" })} className="px-3 py-2 rounded-lg text-sm flex items-center gap-1.5" style={{ border: "1px solid var(--pagina-borda)", color: "var(--pagina-texto-1)" }}><ClipboardPaste size={14} /> Colar da planilha</button>
              <button onClick={() => setModal({ t: "novo" })} className="px-3 py-2 rounded-lg text-sm text-white font-medium flex items-center gap-1.5" style={{ background: P }}><Plus size={14} /> Nova demanda</button>
            </>
          )}
        </div>
        {erro && <p className="text-red-500 text-sm mb-3">{erro}</p>}
        <div className="rounded-2xl overflow-hidden" style={{ ...card, border: "1px solid var(--pagina-borda-suave)" }}>
          <table className="w-full text-sm" style={{ color: "var(--pagina-texto-1)" }}>
            <thead>
              <tr className="text-left text-xs uppercase tracking-wide" style={{ background: "#5B21B6", color: "#fff" }}>
                <th className="px-3 py-2.5 w-44">Responsável</th><th className="px-3 py-2.5">Demanda</th><th className="px-3 py-2.5">Obs</th>
                <th className="px-3 py-2.5 w-28">Prazo</th><th className="px-3 py-2.5 w-24 text-center">Concluído</th>{podeEditar && <th className="w-16" />}
              </tr>
            </thead>
            <tbody>
              {vis.map((d) => {
                const atras = !d.concluida && d.prazo && d.prazo < hoje();
                return (
                  <tr key={d.id} style={{ borderTop: "1px solid var(--pagina-borda-suave)", background: d.destaque && !d.concluida ? "rgba(124,58,237,.10)" : undefined, opacity: d.concluida ? 0.55 : 1 }}>
                    <td className="px-3 py-2.5 font-medium">{d.responsaveis.length ? d.responsaveis.map((r) => r.name).join(" / ") : <span className="opacity-40">—</span>}</td>
                    <td className="px-3 py-2.5"><span className={d.concluida ? "line-through" : ""}>{d.destaque && <Star size={12} className="inline mr-1 -mt-0.5" fill={P} color={P} />}{d.demanda}</span></td>
                    <td className="px-3 py-2.5" style={{ color: "var(--pagina-texto-2)" }}>{d.obs}</td>
                    <td className="px-3 py-2.5" style={{ color: atras ? "#dc2626" : undefined, fontWeight: atras ? 600 : undefined }}>{fmt(d.prazo)}</td>
                    <td className="px-3 py-2.5 text-center"><input type="checkbox" checked={d.concluida} disabled={!podeEditar} onChange={(e) => patch(d.id, { concluida: e.target.checked })} style={{ accentColor: P }} /></td>
                    {podeEditar && (
                      <td className="px-2 py-2.5 text-right whitespace-nowrap">
                        <button className="text-xs mr-2 underline" style={{ color: P }} onClick={() => setModal({ t: "edit", d })}>Editar</button>
                        <button onClick={() => remover(d)} title="Excluir"><Trash2 size={14} className="opacity-60" /></button>
                      </td>
                    )}
                  </tr>
                );
              })}
              {!vis.length && <tr><td colSpan={6} className="px-3 py-10 text-center opacity-50">Nenhuma demanda por aqui.</td></tr>}
            </tbody>
          </table>
        </div>
      </div>
      {modal?.t === "novo" && <Form pessoas={pessoas} onSalvar={criar} onClose={() => setModal(null)} />}
      {modal?.t === "edit" && <Form pessoas={pessoas} inicial={{ ...modal.d, responsaveis: modal.d.responsaveis.map((r) => r.id) }} onSalvar={editar(modal.d.id)} onClose={() => setModal(null)} />}
      {modal?.t === "imp" && <Importar onClose={() => setModal(null)} onFeito={carregar} />}
    </div>
  );
}
