const express = require("express");
const { pool } = require("../db");
const { requireAuth, requireAdmin } = require("../middleware/auth");
const { upload } = require("../middleware/upload");

const router = express.Router();

// Monta a condição que define se um comunicado é destinado a uma pessoa
const VISIBLE_TO_USER = `(
  a.audience = 'all'
  OR EXISTS (SELECT 1 FROM announcement_targets t WHERE t.announcement_id = a.id AND t.user_id = $1)
  OR EXISTS (
    SELECT 1 FROM announcement_targets t
    JOIN group_members gm ON gm.group_id = t.group_id
    WHERE t.announcement_id = a.id AND gm.user_id = $1
  )
)`;

// GET /api/announcements/latest -> o comunicado mais recente destinado a essa pessoa
router.get("/latest", requireAuth, async (req, res) => {
  try {
    const { rows } = await pool.query(
      `SELECT a.*, u.name AS created_by_name FROM announcements a
       JOIN users u ON u.id = a.created_by
       WHERE ${VISIBLE_TO_USER}
       ORDER BY a.created_at DESC LIMIT 1`,
      [req.user.id]
    );
    res.json({ announcement: rows[0] || null });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Erro ao buscar o comunicado." });
  }
});

// GET /api/announcements -> histórico. ADM vê todos; operador só os destinados a ele.
router.get("/", requireAuth, async (req, res) => {
  try {
    const isAdm = req.user.role === "admin";

    const { rows: totalActiveRows } = await pool.query(
      "SELECT COUNT(*)::int AS total FROM users WHERE active = true"
    );
    const totalActive = totalActiveRows[0].total;

    const sql = isAdm
      ? `SELECT a.*, u.name AS created_by_name, COUNT(DISTINCT ak.user_id)::int AS ack_count,
                CASE
                  WHEN a.audience = 'all' THEN $1::int
                  WHEN a.audience = 'users' THEN (
                    SELECT COUNT(DISTINCT t.user_id)::int FROM announcement_targets t
                    JOIN users u2 ON u2.id = t.user_id AND u2.active = true
                    WHERE t.announcement_id = a.id AND t.user_id IS NOT NULL
                  )
                  ELSE (
                    SELECT COUNT(DISTINCT gm.user_id)::int FROM announcement_targets t
                    JOIN group_members gm ON gm.group_id = t.group_id
                    JOIN users u2 ON u2.id = gm.user_id AND u2.active = true
                    WHERE t.announcement_id = a.id AND t.group_id IS NOT NULL
                  )
                END AS target_count
         FROM announcements a
         JOIN users u ON u.id = a.created_by
         LEFT JOIN announcement_acks ak ON ak.announcement_id = a.id
         GROUP BY a.id, u.name
         ORDER BY a.created_at DESC`
      : `SELECT a.*, u.name AS created_by_name, 0 AS ack_count, 0 AS target_count
         FROM announcements a
         JOIN users u ON u.id = a.created_by
         WHERE ${VISIBLE_TO_USER}
         ORDER BY a.created_at DESC`;

    const { rows } = isAdm
      ? await pool.query(sql, [totalActive])
      : await pool.query(sql, [req.user.id]);

    res.json({ announcements: rows, totalActive });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Erro ao listar comunicados." });
  }
});

// GET /api/announcements/:id/acks -> dados do comunicado (só ADM): quem confirmou,
// quem falta (só entre os destinatários) e a taxa de confirmação por grupo.
router.get("/:id/acks", requireAuth, requireAdmin, async (req, res) => {
  try {
    const id = Number(req.params.id);
    const { rows: ann } = await pool.query("SELECT id, audience, created_at FROM announcements WHERE id = $1", [id]);
    if (!ann[0]) return res.status(404).json({ error: "Comunicado não encontrado." });
    const audience = ann[0].audience;

    // Destinatários de verdade (ativos), respeitando o público escolhido
    const alvoSql =
      audience === "users"
        ? `SELECT DISTINCT u.id, u.name, u.role FROM announcement_targets t
           JOIN users u ON u.id = t.user_id AND u.active = true
           WHERE t.announcement_id = $1 AND t.user_id IS NOT NULL`
        : audience === "groups"
        ? `SELECT DISTINCT u.id, u.name, u.role FROM announcement_targets t
           JOIN group_members gm ON gm.group_id = t.group_id
           JOIN users u ON u.id = gm.user_id AND u.active = true
           WHERE t.announcement_id = $1 AND t.group_id IS NOT NULL`
        : `SELECT id, name, role FROM users WHERE active = true AND $1::int IS NOT NULL`;
    const { rows: alvo } = await pool.query(alvoSql, [id]);

    const { rows: acked } = await pool.query(
      `SELECT u.id, u.name, u.role, ak.acked_at
       FROM announcement_acks ak JOIN users u ON u.id = ak.user_id
       WHERE ak.announcement_id = $1 ORDER BY ak.acked_at`,
      [id]
    );
    const ackedIds = new Set(acked.map((u) => u.id));
    const pending = alvo.filter((u) => !ackedIds.has(u.id)).sort((x, y) => x.name.localeCompare(y.name, "pt-BR"));

    // Por grupo (somente quando o comunicado vai para todos ou para grupos escolhidos)
    let grupos = [];
    if (audience !== "users") {
      const filtro = audience === "groups" ? "AND g.id IN (SELECT group_id FROM announcement_targets WHERE announcement_id = $1 AND group_id IS NOT NULL)" : "AND $1::int IS NOT NULL";
      const { rows } = await pool.query(
        `SELECT g.id, g.name,
                COUNT(DISTINCT u.id)::int AS total,
                COUNT(DISTINCT ak.user_id)::int AS confirmaram
         FROM groups g
         JOIN group_members gm ON gm.group_id = g.id
         JOIN users u ON u.id = gm.user_id AND u.active = true
         LEFT JOIN announcement_acks ak ON ak.user_id = u.id AND ak.announcement_id = $1
         WHERE true ${filtro}
         GROUP BY g.id, g.name
         HAVING COUNT(DISTINCT u.id) > 0
         ORDER BY g.name`,
        [id]
      );
      grupos = rows;
    }

    res.json({ acked, pending, grupos, total: alvo.length, created_at: ann[0].created_at });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Erro ao buscar confirmações." });
  }
});

// POST /api/announcements/:id/ack -> a pessoa confirma que ficou ciente
router.post("/:id/ack", requireAuth, async (req, res) => {
  try {
    await pool.query(
      "INSERT INTO announcement_acks (announcement_id, user_id) VALUES ($1, $2) ON CONFLICT DO NOTHING",
      [req.params.id, req.user.id]
    );
    const io = req.app.get("io");
    io.emit("announcement:ack", { announcementId: Number(req.params.id), userId: req.user.id, userName: req.user.name });
    res.json({ ok: true });
  } catch (err) {
    // Antes essa rota não tinha catch: se o banco engasgasse, o pedido nunca
    // recebia resposta e o botão "ESTOU CIENTE" ficava preso em "Enviando..."
    // pra sempre, só saindo com F5. Agora sempre responde, mesmo em erro.
    console.error(err);
    res.status(500).json({ error: "Erro ao confirmar o comunicado." });
  }
});

// POST /api/announcements -> criar comunicado (só ADM)
// body: message, audience ('all' | 'users' | 'groups'), userIds[], groupIds[], image (arquivo)
router.post("/", requireAuth, requireAdmin, upload.single("image"), async (req, res) => {
  const { message, audience } = req.body || {};
  if (!message || !message.trim()) return res.status(400).json({ error: "Escreva o texto do comunicado." });

  const aud = ["all", "users", "groups"].includes(audience) ? audience : "all";
  const parseIds = (v) => {
    if (!v) return [];
    try { return JSON.parse(v).map(Number).filter(Boolean); } catch { return []; }
  };
  const userIds = parseIds(req.body.userIds);
  const groupIds = parseIds(req.body.groupIds);

  if (aud === "users" && userIds.length === 0) return res.status(400).json({ error: "Escolha pelo menos uma pessoa." });
  if (aud === "groups" && groupIds.length === 0) return res.status(400).json({ error: "Escolha pelo menos um grupo." });

  const imageUrl = req.file ? `/uploads/${req.file.filename}` : null;
  const client = await pool.connect();

  try {
    await client.query("BEGIN");
    const { rows } = await client.query(
      `INSERT INTO announcements (message, image_url, audience, created_by) VALUES ($1, $2, $3, $4) RETURNING *`,
      [message.trim(), imageUrl, aud, req.user.id]
    );
    const announcement = rows[0];

    for (const uid of userIds) {
      await client.query("INSERT INTO announcement_targets (announcement_id, user_id) VALUES ($1, $2)", [announcement.id, uid]);
    }
    for (const gid of groupIds) {
      await client.query("INSERT INTO announcement_targets (announcement_id, group_id) VALUES ($1, $2)", [announcement.id, gid]);
    }
    await client.query("COMMIT");

    const payload = { ...announcement, created_by_name: req.user.name };
    const io = req.app.get("io");

    if (aud === "all") {
      io.emit("announcement:new", payload);
    } else {
      // Descobre exatamente quem deve receber e avisa só essas pessoas
      const { rows: recipients } = await pool.query(
        `SELECT DISTINCT u.id FROM users u
         WHERE u.active = true AND (
           u.id = ANY($1::int[])
           OR EXISTS (SELECT 1 FROM group_members gm WHERE gm.user_id = u.id AND gm.group_id = ANY($2::int[]))
         )`,
        [userIds, groupIds]
      );
      recipients.forEach((r) => io.to(`user-${r.id}`).emit("announcement:new", payload));
    }

    res.status(201).json({ announcement: payload });
  } catch (err) {
    await client.query("ROLLBACK");
    console.error(err);
    res.status(500).json({ error: "Erro ao criar comunicado." });
  } finally {
    client.release();
  }
});

// DELETE /api/announcements/:id -> apagar um comunicado (só ADM)
router.delete("/:id", requireAuth, requireAdmin, async (req, res) => {
  await pool.query("DELETE FROM announcements WHERE id = $1", [req.params.id]);
  const io = req.app.get("io");
  io.emit("announcement:deleted", { id: Number(req.params.id) });
  res.json({ ok: true });
});

module.exports = router;
