import { useEffect, useMemo, useState, useCallback } from "react";
import { LifeBuoy, Plus, Trash2, Search, X } from "lucide-react";
import PageHeader from "../PageHeader";
import { api } from "../../api";
import { getSocket } from "../../socket";

const P = "#7C3AED";
const PRIO = {
  alta: { label: "Alta", bg: "rgba(220,38,38,.15)", cor: "#DC2626", ordem: 0 },
  media: { label: "Média", bg: "rgba(245,158,11,.18)", cor: "#D97706", ordem: 1 },
  baixa: { label: "Baixa", bg: "rgba(22,163,74,.15)", cor: "#16A34A", ordem: 2 },
};
const STATUS = { aberto: "Aberto", andamento: "Em andamento", concluido: "Concluído" };
const inp = { background: "var(--pagina-fundo)", border: "1px solid var(--pagina-borda)", color: "var(--pagina-texto-1)" };

const dia = (d) => `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
// "Hoje · 17:00", "Amanhã · 09:00", "28/10 · 14:00"
function formatarPrazo(iso) {
  if (!iso) return { texto: "—", urgente: false };
  const d = new Date(iso), agora = new Date();
  const hora = d.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
  const amanha = new Date(agora); amanha.setDate(amanha.getDate() + 1);
  let texto;
  if (dia(d) === dia(agora)) texto = `Hoje · ${hora}`;
  else if (dia(d) === dia(amanha)) texto = `Amanhã · ${hora}`;
  else texto = `${d.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" })} · ${hora}`;
  return { texto, urgente: d <= amanha || d < agora, vencido: d < agora };
}
const paraInput = (iso) => {
  if (!iso) return "";
  const d = new Date(iso), p = (n) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}`;
};

function Modal({ titulo, onClose, children }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: "rgba(20,10,40,.55)" }} onMouseDown={onClose}>
      <div className="w-full max-w-lg rounded-2xl p-5 shadow-2xl max-h-[92vh] overflow-y-auto" style={{ background: "var(--pagina-cartao)", color: "var(--pagina-texto-1)" }} onMouseDown={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-3"><h3 className="font-semibold">{titulo}</h3><button onClick={onClose}><X size={18} /></button></div>
        {children}
      </div>
    </div>
  );
}

function Form({ inicial, pessoas, onSalvar, onClose }) {
  const [f, setF] = useState(inicial || { titulo: "", obrigacao: "", prioridade: "media", prazo: "", responsaveis: [] });
  const [erro, setErro] = useState("");
  const [salvando, setSalvando] = useState(false);
  async function salvar() {
    if (!f.titulo.trim()) return setErro("Informe o chamado.");
    if (f.responsaveis.length === 0) return setErro("Escolha ao menos um responsável.");
    setSalvando(true);
    try { await onSalvar({ ...f, prazo: f.prazo ? new Date(f.prazo).toISOString() : null }); onClose(); }
    catch (e) { setErro(e?.response?.data?.error || "Não foi possível salvar."); setSalvando(false); }
  }
  return (
    <Modal titulo={inicial ? "Editar chamado" : "Novo chamado"} onClose={onClose}>
      <div className="space-y-3 text-sm">
        <div>
          <label className="text-xs opacity-70">Responsável(eis)</label>
          <div className="flex flex-wrap gap-1.5 mt-1">
            {pessoas.map((p) => {
              const on = f.responsaveis.includes(p.id);
              return (
                <button type="button" key={p.id} onClick={() => setF({ ...f, responsaveis: on ? f.responsaveis.filter((x) => x !== p.id) : [...f.responsaveis, p.id] })}
                  className="px-2.5 py-1 rounded-full text-xs font-medium"
                  style={on ? { background: P, color: "#fff" } : { color: "var(--pagina-texto-2)", border: "1px solid var(--pagina-borda)" }}>{p.name}</button>
              );
            })}
          </div>
        </div>
        <div><label className="text-xs opacity-70">Chamado</label><textarea rows={2} className="w-full rounded-lg px-3 py-2 mt-1" style={inp} value={f.titulo} onChange={(e) => setF({ ...f, titulo: e.target.value })} /></div>
        <div><label className="text-xs opacity-70">Obrigação (o que precisa ser entregue)</label><textarea rows={2} className="w-full rounded-lg px-3 py-2 mt-1" style={inp} value={f.obrigacao} onChange={(e) => setF({ ...f, obrigacao: e.target.value })} /></div>
        <div className="flex flex-wrap gap-4">
          <div>
            <label className="text-xs opacity-70">Prioridade</label>
            <div className="flex gap-1.5 mt-1">
              {Object.entries(PRIO).map(([k, v]) => (
                <button type="button" key={k} onClick={() => setF({ ...f, prioridade: k })} className="px-3 py-1.5 rounded-lg text-xs font-bold"
                  style={f.prioridade === k ? { background: v.cor, color: "#fff" } : { background: v.bg, color: v.cor }}>{v.label}</button>
              ))}
            </div>
          </div>
          <div><label className="text-xs opacity-70">Prazo</label><input type="datetime-local" className="block rounded-lg px-3 py-2 mt-1" style={inp} value={f.prazo} onChange={(e) => setF({ ...f, prazo: e.target.value })} /></div>
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

export default function Chamados() {
  const [lista, setLista] = useState([]);
  const [pessoas, setPessoas] = useState([]);
  const [busca, setBusca] = useState("");
  const [quem, setQuem] = useState("");
  const [prio, setPrio] = useState("");
  const [filtroStatus, setFiltroStatus] = useState("abertos"); // abertos | todos | concluido
  const [modal, setModal] = useState(null);
  const [erro, setErro] = useState("");

  const carregar = useCallback(async () => {
    try { const { data } = await api.get("/chamados"); setLista(data.chamados); setErro(""); }
    catch { setErro("Não foi possível carregar os chamados."); }
  }, []);
  useEffect(() => {
    carregar();
    api.get("/chamados/pessoas").then((r) => setPessoas(r.data)).catch(() => {});
    const t = setInterval(carregar, 30000);
    let s; try { s = getSocket(); s?.on("chamados:updated", carregar); } catch {}
    return () => { clearInterval(t); try { s?.off("chamados:updated", carregar); } catch {} };
  }, [carregar]);

  const patch = async (id, body) => { const { data } = await api.patch(`/chamados/${id}`, body); setLista((l) => l.map((c) => (c.id === id ? data : c))); window.dispatchEvent(new Event("chamado:atualizado")); };
  const criar = async (f) => { await api.post("/chamados", f); window.dispatchEvent(new Event("chamado:atualizado")); carregar(); };
  const remover = async (c) => { if (!window.confirm("Excluir este chamado?")) return; await api.delete(`/chamados/${c.id}`); window.dispatchEvent(new Event("chamado:atualizado")); carregar(); };

  const vis = useMemo(() => {
    const q = busca.toLowerCase();
    return lista.filter((c) =>
      (filtroStatus === "todos" || (filtroStatus === "concluido" ? c.status === "concluido" : c.status !== "concluido")) &&
      (!quem || c.responsaveis.some((r) => String(r.id) === quem)) &&
      (!prio || c.prioridade === prio) &&
      (!q || `${c.titulo} ${c.obrigacao} ${c.responsaveis.map((r) => r.name).join(" ")}`.toLowerCase().includes(q)));
  }, [lista, busca, quem, prio, filtroStatus]);

  const abertos = lista.filter((c) => c.status !== "concluido");
  const altas = abertos.filter((c) => c.prioridade === "alta").length;
  const vencendo = abertos.filter((c) => c.prazo && new Date(c.prazo) <= new Date(Date.now() + 2 * 86400000)).length;
  const mes = new Date(); mes.setDate(1); mes.setHours(0, 0, 0, 0);
  const concluidosMes = lista.filter((c) => c.status === "concluido" && c.concluido_em && new Date(c.concluido_em) >= mes).length;

  const Card = ({ n, t, cor }) => (
    <div className="flex-1 min-w-[140px] rounded-2xl p-3.5" style={{ border: "1px solid var(--pagina-borda-suave)", background: "var(--pagina-cartao)" }}>
      <div className="text-[22px] font-bold" style={{ color: cor || "var(--pagina-texto-1)" }}>{n}</div>
      <div className="text-[11.5px]" style={{ color: "var(--pagina-texto-2)" }}>{t}</div>
    </div>
  );

  return (
    <div className="flex flex-col h-full min-h-0">
      <PageHeader icon={LifeBuoy} title="Chamados" subtitle="Visível apenas para administradores · responsável, prioridade, obrigação e prazo" />
      <div className="flex-1 overflow-auto p-5">
        <div className="flex flex-wrap gap-3 mb-4">
          <Card n={abertos.length} t="Em aberto" />
          <Card n={altas} t="Prioridade alta" cor="#DC2626" />
          <Card n={vencendo} t="Vencendo em até 2 dias" cor="#DC2626" />
          <Card n={concluidosMes} t="Concluídos no mês" cor="#16A34A" />
        </div>
        <div className="flex flex-wrap items-center gap-2 mb-4">
          <div className="relative">
            <Search size={14} className="absolute left-2.5 top-2.5 opacity-50" />
            <input value={busca} onChange={(e) => setBusca(e.target.value)} placeholder="Buscar chamado…" className="pl-8 pr-3 py-2 rounded-lg text-sm" style={inp} />
          </div>
          <select value={quem} onChange={(e) => setQuem(e.target.value)} className="px-3 py-2 rounded-lg text-sm" style={inp}>
            <option value="">Todos os responsáveis</option>
            {pessoas.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
          </select>
          <select value={prio} onChange={(e) => setPrio(e.target.value)} className="px-3 py-2 rounded-lg text-sm" style={inp}>
            <option value="">Todas as prioridades</option>
            {Object.entries(PRIO).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
          </select>
          <select value={filtroStatus} onChange={(e) => setFiltroStatus(e.target.value)} className="px-3 py-2 rounded-lg text-sm" style={inp}>
            <option value="abertos">Em aberto</option><option value="concluido">Concluídos</option><option value="todos">Todos</option>
          </select>
          <div className="flex-1" />
          <button onClick={() => setModal({ t: "novo" })} className="px-3 py-2 rounded-lg text-sm text-white font-medium flex items-center gap-1.5" style={{ background: P }}><Plus size={14} /> Novo chamado</button>
        </div>
        {erro && <p className="text-red-500 text-sm mb-3">{erro}</p>}
        <div className="rounded-2xl overflow-x-auto" style={{ background: "var(--pagina-cartao)", border: "1px solid var(--pagina-borda-suave)" }}>
          <table className="w-full text-sm min-w-[860px]" style={{ color: "var(--pagina-texto-1)" }}>
            <thead>
              <tr className="text-left text-xs uppercase tracking-wide" style={{ background: "#5B21B6", color: "#fff" }}>
                <th className="px-3 py-2.5 w-44">Responsável</th><th className="px-3 py-2.5 w-24">Prioridade</th><th className="px-3 py-2.5">Chamado</th>
                <th className="px-3 py-2.5 w-72">Obrigação</th><th className="px-3 py-2.5 w-32">Prazo</th><th className="px-3 py-2.5 w-36">Status</th><th className="w-24" />
              </tr>
            </thead>
            <tbody>
              {vis.map((c) => {
                const pz = formatarPrazo(c.prazo), feito = c.status === "concluido", pr = PRIO[c.prioridade];
                return (
                  <tr key={c.id} style={{ borderTop: "1px solid var(--pagina-borda-suave)", background: c.prioridade === "alta" && !feito ? "rgba(124,58,237,.08)" : undefined, opacity: feito ? 0.55 : 1 }}>
                    <td className="px-3 py-2.5">
                      <div className="flex flex-wrap gap-1">{c.responsaveis.map((r) => <span key={r.id} className="text-[11.5px] rounded-full px-2 py-0.5" style={{ background: "rgba(124,58,237,.15)", color: "var(--pagina-texto-1)" }}>{r.name}</span>)}</div>
                    </td>
                    <td className="px-3 py-2.5"><span className="text-[11px] font-bold rounded-full px-2.5 py-1" style={{ background: pr.bg, color: pr.cor }}>{pr.label}</span></td>
                    <td className="px-3 py-2.5"><div className={`font-semibold ${feito ? "line-through" : ""}`}>{c.titulo}</div>{c.criado_por && <div className="text-[11.5px]" style={{ color: "var(--pagina-texto-2)" }}>Aberto por {c.criado_por}</div>}</td>
                    <td className="px-3 py-2.5" style={{ color: "var(--pagina-texto-2)" }}>{c.obrigacao}</td>
                    <td className="px-3 py-2.5" style={{ color: pz.urgente && !feito ? "#DC2626" : undefined, fontWeight: pz.urgente && !feito ? 700 : undefined }}>{pz.texto}{pz.vencido && !feito ? " (vencido)" : ""}</td>
                    <td className="px-3 py-2.5">
                      <select value={c.status} onChange={(e) => patch(c.id, { status: e.target.value })} className="rounded-lg px-2 py-1 text-xs" style={inp}>
                        {Object.entries(STATUS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                      </select>
                    </td>
                    <td className="px-2 py-2.5 text-right whitespace-nowrap">
                      <button className="text-xs mr-2 underline" style={{ color: P }} onClick={() => setModal({ t: "edit", c })}>Editar</button>
                      <button onClick={() => remover(c)} title="Excluir"><Trash2 size={14} className="opacity-60" /></button>
                    </td>
                  </tr>
                );
              })}
              {!vis.length && <tr><td colSpan={7} className="px-3 py-10 text-center opacity-50">Nenhum chamado por aqui.</td></tr>}
            </tbody>
          </table>
        </div>
      </div>
      {modal?.t === "novo" && <Form pessoas={pessoas} onSalvar={criar} onClose={() => setModal(null)} />}
      {modal?.t === "edit" && <Form pessoas={pessoas} inicial={{ titulo: modal.c.titulo, obrigacao: modal.c.obrigacao, prioridade: modal.c.prioridade, prazo: paraInput(modal.c.prazo), responsaveis: modal.c.responsaveis.map((r) => r.id) }}
        onSalvar={(f) => patch(modal.c.id, f)} onClose={() => setModal(null)} />}
    </div>
  );
}
