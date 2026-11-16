const express = require("express");
const { pool } = require("../db");
const { requireAuth } = require("../middleware/auth");

const router = express.Router();

// Estratégia da semana: quadro de acompanhamento visível SÓ para o ADM master (André Andrade).
const norm = (t) => String(t || "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().trim().replace(/\s+/g, " ");
const ehMaster = (u) => u && u.role === "admin";

const CARTEIRAS_PADRAO = ["Hapvida Cancelado", "Qualicorp", "Unimed", "Nossa Saúde", "Clinipam", "Crediffato"];
const CANAIS = ["whatsapp", "discador", "sms", "email", "fila"];
const STATUS = ["planejada", "andamento", "feita"];

const EXTRAS = ["loja", "quantidade", "valores", "acionado", "situacoes", "indicadores", "observacao", "operador", "mensagem", "supervisor", "dono"];
const COLS = "id, carteira, dia, canal, titulo, responsavel, status, " + EXTRAS.join(", ");
let pronta = false;
async function garantir() {
  if (pronta) return;
  await pool.query(`CREATE TABLE IF NOT EXISTS estrategia_semana (
    semana DATE PRIMARY KEY, foco TEXT NOT NULL DEFAULT '', metas JSONB NOT NULL DEFAULT '{}'::jsonb,
    realizados JSONB NOT NULL DEFAULT '{}'::jsonb, carteiras JSONB NOT NULL DEFAULT '[]'::jsonb,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now())`);
  await pool.query(`CREATE TABLE IF NOT EXISTS estrategia_acoes (
    id SERIAL PRIMARY KEY, semana DATE NOT NULL, carteira TEXT NOT NULL, dia INTEGER NOT NULL CHECK (dia BETWEEN 0 AND 4),
    canal TEXT NOT NULL DEFAULT 'whatsapp', titulo TEXT NOT NULL, responsavel TEXT NOT NULL DEFAULT '',
    status TEXT NOT NULL DEFAULT 'planejada', created_at TIMESTAMPTZ NOT NULL DEFAULT now())`);
  await pool.query(`CREATE TABLE IF NOT EXISTS estrategia_carteira_resp (carteira TEXT PRIMARY KEY, supervisor TEXT NOT NULL DEFAULT '', responsavel TEXT NOT NULL DEFAULT '')`);
  for (const c of EXTRAS) await pool.query(`ALTER TABLE estrategia_acoes ADD COLUMN IF NOT EXISTS ${c} TEXT NOT NULL DEFAULT ''`);
  await pool.query(`CREATE INDEX IF NOT EXISTS estrategia_acoes_semana_idx ON estrategia_acoes(semana)`);
  pronta = true;
}

router.use(requireAuth, async (req, res, next) => {
  if (!ehMaster(req.user)) return res.status(403).json({ error: "Acesso restrito." });
  try { await garantir(); next(); } catch (e) { console.error(e); res.status(500).json({ error: "Erro ao carregar a estratégia." }); }
});

// A semana é sempre identificada pela segunda-feira (YYYY-MM-DD)
function segunda(str) {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(str || "");
  const d = m ? new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3])) : new Date();
  const dow = d.getDay();
  d.setDate(d.getDate() - ((dow + 6) % 7));
  const p = (n) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

router.get("/", async (req, res) => {
  try {
    const semana = segunda(req.query.semana);
    const { rows } = await pool.query("SELECT foco, metas, realizados, carteiras FROM estrategia_semana WHERE semana = $1::date", [semana]);
    let carteiras = rows[0]?.carteiras;
    if (!Array.isArray(carteiras) || !carteiras.length) {
      const { rows: ant } = await pool.query("SELECT carteiras FROM estrategia_semana WHERE jsonb_array_length(carteiras) > 0 ORDER BY semana DESC LIMIT 1");
      carteiras = ant[0]?.carteiras || CARTEIRAS_PADRAO;
    }
    const { rows: acoes } = await pool.query(
      "SELECT " + COLS + " FROM estrategia_acoes WHERE semana = $1::date ORDER BY dia, id", [semana]);
    const { rows: rs } = await pool.query("SELECT carteira, supervisor, responsavel FROM estrategia_carteira_resp");
    const responsaveis = Object.fromEntries(rs.map((r) => [r.carteira, { supervisor: r.supervisor, responsavel: r.responsavel }]));
    res.json({ semana, foco: rows[0]?.foco || "", metas: rows[0]?.metas || {}, realizados: rows[0]?.realizados || {}, carteiras, acoes, responsaveis });
  } catch (e) { console.error(e); res.status(500).json({ error: "Erro ao carregar a semana." }); }
});

// Salva foco, metas, realizados e a lista de carteiras da semana
router.put("/semana", async (req, res) => {
  try {
    const semana = segunda(req.body?.semana);
    const foco = String(req.body?.foco || "").slice(0, 300);
    const objNum = (o) => Object.fromEntries(Object.entries(o && typeof o === "object" ? o : {}).slice(0, 20).map(([k, v]) => [String(k).slice(0, 30), Number(v) || 0]));
    const carteiras = (Array.isArray(req.body?.carteiras) ? req.body.carteiras : []).map((c) => String(c).trim().slice(0, 60)).filter(Boolean).slice(0, 40);
    await pool.query(
      `INSERT INTO estrategia_semana (semana, foco, metas, realizados, carteiras) VALUES ($1::date, $2, $3::jsonb, $4::jsonb, $5::jsonb)
       ON CONFLICT (semana) DO UPDATE SET foco = EXCLUDED.foco, metas = EXCLUDED.metas, realizados = EXCLUDED.realizados,
         carteiras = EXCLUDED.carteiras, updated_at = now()`,
      [semana, foco, JSON.stringify(objNum(req.body?.metas)), JSON.stringify(objNum(req.body?.realizados)), JSON.stringify(carteiras)]);
    res.json({ ok: true });
  } catch (e) { console.error(e); res.status(500).json({ error: "Erro ao salvar a semana." }); }
});

function validar(b, parcial) {
  const o = {};
  if (!parcial || b.carteira !== undefined) o.carteira = String(b.carteira || "").trim().slice(0, 60);
  if (!parcial || b.titulo !== undefined) o.titulo = String(b.titulo || "").trim().slice(0, 120);
  if (!parcial || b.responsavel !== undefined) o.responsavel = String(b.responsavel || "").trim().slice(0, 60);
  for (const k of EXTRAS) if (!parcial || b[k] !== undefined) { o[k] = String(b[k] || "").trim().slice(0, k === "observacao" ? 1000 : k === "mensagem" ? 2000 : 200); if (k === "loja") o[k] = o[k].toUpperCase(); }
  if (!parcial || b.dia !== undefined) o.dia = Number(b.dia);
  if (!parcial || b.canal !== undefined) o.canal = b.canal;
  if (!parcial || b.status !== undefined) o.status = b.status;
  if ("carteira" in o && !o.carteira) return { erro: "Informe a carteira." };
  if ("titulo" in o && !o.titulo) return { erro: "Informe o que será feito." };
  if ("dia" in o && !(Number.isInteger(o.dia) && o.dia >= 0 && o.dia <= 4)) return { erro: "Dia inválido." };
  if ("canal" in o && !CANAIS.includes(o.canal)) return { erro: "Canal inválido." };
  if ("status" in o && !STATUS.includes(o.status)) return { erro: "Status inválido." };
  return { o };
}

router.post("/acoes", async (req, res) => {
  try {
    const v = validar({ status: "planejada", canal: "whatsapp", ...req.body }, false);
    if (v.erro) return res.status(400).json({ error: v.erro });
    const { rows } = await pool.query(
      `INSERT INTO estrategia_acoes (semana, carteira, dia, canal, titulo, responsavel, status, ${EXTRAS.join(", ")})
       VALUES ($1::date, $2, $3, $4, $5, $6, $7, ${EXTRAS.map((_, i) => "$" + (i + 8)).join(", ")}) RETURNING ${COLS}`,
      [segunda(req.body?.semana), v.o.carteira, v.o.dia, v.o.canal, v.o.titulo, v.o.responsavel, v.o.status, ...EXTRAS.map((k) => v.o[k])]);
    res.json({ acao: rows[0] });
  } catch (e) { console.error(e); res.status(500).json({ error: "Erro ao criar a ação." }); }
});

router.patch("/acoes/:id", async (req, res) => {
  try {
    const v = validar(req.body || {}, true);
    if (v.erro) return res.status(400).json({ error: v.erro });
    const chaves = Object.keys(v.o);
    if (!chaves.length) return res.status(400).json({ error: "Nada para atualizar." });
    const sets = chaves.map((k, i) => `${k} = $${i + 1}`);
    const { rows } = await pool.query(
      `UPDATE estrategia_acoes SET ${sets.join(", ")} WHERE id = $${chaves.length + 1} RETURNING ${COLS}`,
      [...chaves.map((k) => v.o[k]), req.params.id]);
    if (!rows[0]) return res.status(404).json({ error: "Ação não encontrada." });
    res.json({ acao: rows[0] });
  } catch (e) { console.error(e); res.status(500).json({ error: "Erro ao atualizar a ação." }); }
});

// Supervisor e responsável da estratégia ficam na carteira (valem para todas as semanas)
router.put("/carteira-resp", async (req, res) => {
  try {
    const carteira = String(req.body?.carteira || "").trim().slice(0, 60);
    if (!carteira) return res.status(400).json({ error: "Informe a carteira." });
    const supervisor = String(req.body?.supervisor || "").trim().slice(0, 60);
    const responsavel = String(req.body?.responsavel || "").trim().slice(0, 60);
    await pool.query(
      `INSERT INTO estrategia_carteira_resp (carteira, supervisor, responsavel) VALUES ($1, $2, $3)
       ON CONFLICT (carteira) DO UPDATE SET supervisor = EXCLUDED.supervisor, responsavel = EXCLUDED.responsavel`,
      [carteira, supervisor, responsavel]);
    res.json({ ok: true });
  } catch (e) { console.error(e); res.status(500).json({ error: "Erro ao salvar o responsável." }); }
});

router.delete("/acoes/:id", async (req, res) => {
  try {
    await pool.query("DELETE FROM estrategia_acoes WHERE id = $1", [req.params.id]);
    res.json({ ok: true });
  } catch (e) { console.error(e); res.status(500).json({ error: "Erro ao excluir a ação." }); }
});

module.exports = router;
