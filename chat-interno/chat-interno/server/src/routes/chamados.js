const express = require("express");
const { pool } = require("../db");
const { requireAuth, requireAdmin } = require("../middleware/auth");

const router = express.Router();

// Chamados: só usuários ADM do painel enxergam e mexem (todos os ADM veem tudo).
let pronta = false;
async function garantir() {
  if (pronta) return;
  await pool.query(`CREATE TABLE IF NOT EXISTS chamados (
    id SERIAL PRIMARY KEY, titulo TEXT NOT NULL, obrigacao TEXT NOT NULL DEFAULT '',
    prioridade TEXT NOT NULL DEFAULT 'media' CHECK (prioridade IN ('alta','media','baixa')),
    prazo TIMESTAMPTZ, status TEXT NOT NULL DEFAULT 'aberto' CHECK (status IN ('aberto','andamento','concluido')),
    concluido_em TIMESTAMPTZ, created_by INTEGER, created_at TIMESTAMPTZ NOT NULL DEFAULT now(), updated_at TIMESTAMPTZ NOT NULL DEFAULT now())`);
  await pool.query(`CREATE TABLE IF NOT EXISTS chamado_responsaveis (
    chamado_id INTEGER NOT NULL REFERENCES chamados(id) ON DELETE CASCADE, user_id INTEGER NOT NULL, PRIMARY KEY (chamado_id, user_id))`);
  pronta = true;
}

router.use(requireAuth, requireAdmin, async (req, res, next) => {
  try { await garantir(); next(); } catch (e) { console.error(e); res.status(500).json({ error: "Erro ao carregar chamados." }); }
});

const SELECT = `SELECT c.id, c.titulo, c.obrigacao, c.prioridade, c.prazo, c.status, c.concluido_em, c.created_at,
  (SELECT name FROM users WHERE id = c.created_by) AS criado_por,
  COALESCE((SELECT json_agg(json_build_object('id',u.id,'name',u.name) ORDER BY u.name)
    FROM chamado_responsaveis r JOIN users u ON u.id=r.user_id WHERE r.chamado_id=c.id), '[]'::json) AS responsaveis
  FROM chamados c`;

async function setResp(id, ids) {
  await pool.query("DELETE FROM chamado_responsaveis WHERE chamado_id=$1", [id]);
  for (const uid of [...new Set((ids || []).map(Number).filter(Boolean))]) {
    await pool.query("INSERT INTO chamado_responsaveis(chamado_id,user_id) VALUES($1,$2) ON CONFLICT DO NOTHING", [id, uid]);
  }
}
const um = async (id) => (await pool.query(SELECT + " WHERE c.id=$1", [id])).rows[0];
const emitir = (req) => { try { req.app.get("io")?.emit("chamados:updated"); } catch {} };
const PRIO = ["alta", "media", "baixa"];
const STATUS = ["aberto", "andamento", "concluido"];

router.get("/", async (req, res) => {
  const { rows } = await pool.query(
    SELECT + ` ORDER BY (c.status = 'concluido'),
      CASE c.prioridade WHEN 'alta' THEN 0 WHEN 'media' THEN 1 ELSE 2 END, c.prazo NULLS LAST, c.id`);
  res.json({ chamados: rows });
});

// Só administradores ativos podem ser responsáveis
router.get("/pessoas", async (req, res) => {
  const { rows } = await pool.query("SELECT id, name FROM users WHERE role = 'admin' AND active = true ORDER BY name");
  res.json(rows);
});

// Para a faixa de avisos: chamados em aberto que vencem em até 2 dias (ou já venceram) e são meus
router.get("/vencendo-count", async (req, res) => {
  const { rows } = await pool.query(
    `SELECT COUNT(*)::int AS count FROM chamados c
     WHERE c.status <> 'concluido' AND c.prazo IS NOT NULL AND c.prazo <= now() + interval '2 days'
       AND EXISTS (SELECT 1 FROM chamado_responsaveis r WHERE r.chamado_id = c.id AND r.user_id = $1)`, [req.user.id]);
  res.json({ count: rows[0].count });
});

router.post("/", async (req, res) => {
  const { titulo, obrigacao, prioridade, prazo, responsaveis } = req.body || {};
  if (!String(titulo || "").trim()) return res.status(400).json({ error: "Informe o chamado." });
  if (prioridade && !PRIO.includes(prioridade)) return res.status(400).json({ error: "Prioridade inválida." });
  const { rows } = await pool.query(
    "INSERT INTO chamados(titulo,obrigacao,prioridade,prazo,created_by) VALUES($1,$2,$3,$4,$5) RETURNING id",
    [String(titulo).trim(), obrigacao || "", prioridade || "media", prazo || null, req.user.id]);
  await setResp(rows[0].id, responsaveis);
  emitir(req);
  res.json(await um(rows[0].id));
});

router.patch("/:id", async (req, res) => {
  const id = Number(req.params.id);
  const b = req.body || {};
  const sets = [], vals = [];
  const add = (c, v) => { vals.push(v); sets.push(`${c}=$${vals.length}`); };
  if (b.titulo !== undefined) { if (!String(b.titulo).trim()) return res.status(400).json({ error: "Informe o chamado." }); add("titulo", String(b.titulo).trim()); }
  if (b.obrigacao !== undefined) add("obrigacao", b.obrigacao || "");
  if (b.prioridade !== undefined) { if (!PRIO.includes(b.prioridade)) return res.status(400).json({ error: "Prioridade inválida." }); add("prioridade", b.prioridade); }
  if (b.prazo !== undefined) add("prazo", b.prazo || null);
  if (b.status !== undefined) {
    if (!STATUS.includes(b.status)) return res.status(400).json({ error: "Status inválido." });
    add("status", b.status);
    add("concluido_em", b.status === "concluido" ? new Date() : null);
  }
  sets.push("updated_at=now()");
  vals.push(id);
  await pool.query(`UPDATE chamados SET ${sets.join(",")} WHERE id=$${vals.length}`, vals);
  if (b.responsaveis !== undefined) await setResp(id, b.responsaveis);
  emitir(req);
  const c = await um(id);
  if (!c) return res.status(404).json({ error: "Chamado não encontrado." });
  res.json(c);
});

router.delete("/:id", async (req, res) => {
  await pool.query("DELETE FROM chamados WHERE id=$1", [Number(req.params.id)]);
  emitir(req);
  res.json({ ok: true });
});

module.exports = router;
