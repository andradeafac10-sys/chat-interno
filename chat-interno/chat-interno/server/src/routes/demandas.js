const express = require("express");
const { pool } = require("../db");
const { requireAuth, requireAdmin } = require("../middleware/auth");

const router = express.Router();

// Só estas pessoas criam/editam demandas. Os demais apenas acompanham.
const EDITORES = ["kamila eduarda", "andre andrade"];
const norm = (s) => String(s || "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().trim().replace(/\s+/g, " ");
const ehEditor = (user) => user && (EDITORES.some((n) => norm(user.name).startsWith(n)));

let pronta = false;
async function garantir() {
  if (pronta) return;
  await pool.query(`CREATE TABLE IF NOT EXISTS demandas (
    id SERIAL PRIMARY KEY, demanda TEXT NOT NULL, obs TEXT NOT NULL DEFAULT '', prazo DATE,
    concluida BOOLEAN NOT NULL DEFAULT false, concluida_em TIMESTAMPTZ, destaque BOOLEAN NOT NULL DEFAULT false,
    created_by INTEGER, created_at TIMESTAMPTZ NOT NULL DEFAULT now(), updated_at TIMESTAMPTZ NOT NULL DEFAULT now())`);
  await pool.query(`CREATE TABLE IF NOT EXISTS demanda_responsaveis (
    demanda_id INTEGER NOT NULL REFERENCES demandas(id) ON DELETE CASCADE, user_id INTEGER NOT NULL, PRIMARY KEY (demanda_id, user_id))`);
  await pool.query("ALTER TABLE demandas ADD COLUMN IF NOT EXISTS resp_texto TEXT NOT NULL DEFAULT ''");
  pronta = true;
}

router.use(requireAuth, requireAdmin, async (req, res, next) => {
  try {
    await garantir();
    const { rows } = await pool.query("SELECT id, name, username FROM users WHERE id = $1", [req.user.id]);
    req.me = rows[0] || req.user;
    req.podeEditar = ehEditor(req.me);
    next();
  } catch (e) { console.error(e); res.status(500).json({ error: "Erro ao carregar demandas." }); }
});

function soEditor(req, res, next) {
  if (!req.podeEditar) return res.status(403).json({ error: "Apenas Kamila Eduarda ou André Andrade podem alterar demandas." });
  next();
}

const SELECT = `SELECT d.id, d.demanda, d.obs, to_char(d.prazo,'YYYY-MM-DD') AS prazo, d.concluida, d.concluida_em, d.destaque, d.created_at, d.resp_texto,
  COALESCE((SELECT json_agg(json_build_object('id',u.id,'name',u.name,'color',u.color) ORDER BY u.name)
    FROM demanda_responsaveis r JOIN users u ON u.id=r.user_id WHERE r.demanda_id=d.id), '[]'::json) AS responsaveis
  FROM demandas d`;

async function setResp(id, ids) {
  await pool.query("DELETE FROM demanda_responsaveis WHERE demanda_id=$1", [id]);
  const lista = [...new Set((ids || []).map(Number).filter(Boolean))];
  for (const uid of lista) await pool.query("INSERT INTO demanda_responsaveis(demanda_id,user_id) VALUES($1,$2) ON CONFLICT DO NOTHING", [id, uid]);
}
async function um(id) { const { rows } = await pool.query(SELECT + " WHERE d.id=$1", [id]); return rows[0]; }
function emitir(req) { try { req.app.get("io")?.emit("demandas:updated"); } catch {} }

router.get("/", async (req, res) => {
  const { rows } = await pool.query(SELECT + " ORDER BY d.concluida, d.destaque DESC, d.prazo NULLS LAST, d.id");
  res.json({ podeEditar: req.podeEditar, demandas: rows });
});

router.get("/pessoas", async (req, res) => {
  const { rows } = await pool.query("SELECT id, name, color FROM users WHERE active = true ORDER BY name");
  res.json(rows);
});

router.post("/", soEditor, async (req, res) => {
  const { demanda, obs, prazo, destaque, responsaveis } = req.body || {};
  if (!String(demanda || "").trim()) return res.status(400).json({ error: "Informe a demanda." });
  const { rows } = await pool.query(
    "INSERT INTO demandas(demanda,obs,prazo,destaque,created_by) VALUES($1,$2,$3,$4,$5) RETURNING id",
    [String(demanda).trim(), obs || "", prazo || null, !!destaque, req.user.id]);
  await setResp(rows[0].id, responsaveis);
  emitir(req);
  res.json(await um(rows[0].id));
});

router.patch("/:id", soEditor, async (req, res) => {
  const id = Number(req.params.id);
  const b = req.body || {};
  const sets = [], vals = [];
  const add = (c, v) => { vals.push(v); sets.push(`${c}=$${vals.length}`); };
  if (b.demanda !== undefined) { if (!String(b.demanda).trim()) return res.status(400).json({ error: "Informe a demanda." }); add("demanda", String(b.demanda).trim()); }
  if (b.obs !== undefined) add("obs", b.obs || "");
  if (b.prazo !== undefined) add("prazo", b.prazo || null);
  if (b.destaque !== undefined) add("destaque", !!b.destaque);
  if (b.concluida !== undefined) { add("concluida", !!b.concluida); add("concluida_em", b.concluida ? new Date() : null); }
  sets.push("updated_at=now()");
  vals.push(id);
  await pool.query(`UPDATE demandas SET ${sets.join(",")} WHERE id=$${vals.length}`, vals);
  if (b.responsaveis !== undefined) await setResp(id, b.responsaveis);
  emitir(req);
  const d = await um(id);
  if (!d) return res.status(404).json({ error: "Demanda não encontrada." });
  res.json(d);
});

router.delete("/:id", soEditor, async (req, res) => {
  await pool.query("DELETE FROM demandas WHERE id=$1", [Number(req.params.id)]);
  emitir(req);
  res.json({ ok: true });
});

// Importar colando da planilha: Responsável \t Demanda \t Obs \t Prazo (dd/mm/aaaa) \t Concluído
router.post("/importar", soEditor, async (req, res) => {
  const linhas = String(req.body?.texto || "").split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
  const { rows: users } = await pool.query("SELECT id, name FROM users WHERE active = true");
  let criadas = 0; const semMatch = new Set();
  for (const l of linhas) {
    const c = l.split("\t");
    if (c.length < 2) continue;
    const [resp, demanda, obs = "", prazoTxt = "", conc = ""] = c.map((x) => x.trim());
    if (/^respons/i.test(resp) && /^demanda/i.test(demanda)) continue;
    if (!demanda) continue;
    let prazo = null;
    const m = prazoTxt.match(/(\d{1,2})\/(\d{1,2})\/(\d{2,4})/);
    if (m) prazo = `${m[3].length === 2 ? "20" + m[3] : m[3]}-${m[2].padStart(2, "0")}-${m[1].padStart(2, "0")}`;
    const ids = []; const nomesSem = [];
    for (const p of resp.split(/[\/,;&]| e /i).map((x) => norm(x)).filter(Boolean)) {
      const u = users.find((x) => norm(x.name) === p) || users.find((x) => norm(x.name).split(" ")[0] === p.split(" ")[0] && (p.split(" ").length === 1 || norm(x.name).startsWith(p)));
      if (u) ids.push(u.id); else { semMatch.add(p); nomesSem.push(p); }
    }
    const feita = /^(sim|s|x|ok|feito|conclu)/i.test(conc);
    const { rows } = await pool.query(
      "INSERT INTO demandas(demanda,obs,prazo,concluida,concluida_em,created_by,resp_texto) VALUES($1,$2,$3,$4,$5,$6,$7) RETURNING id",
      [demanda, obs, prazo, feita, feita ? new Date() : null, req.user.id, resp.split(/[\/,;&]| e /i).map((x) => x.trim()).filter((x) => nomesSem.includes(norm(x))).join(" / ")]);
    await setResp(rows[0].id, ids);
    criadas++;
  }
  emitir(req);
  res.json({ criadas, semMatch: [...semMatch] });
});

module.exports = router;
