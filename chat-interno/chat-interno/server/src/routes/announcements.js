const express = require("express");
const { pool } = require("../db");
const { requireAuth, requireAdmin } = require("../middleware/auth");
const { upload } = require("../middleware/upload");

const router = express.Router();

// GET /api/announcements/latest -> o comunicado mais recente (pra quem abre o chat depois de já ter sido enviado)
router.get("/latest", requireAuth, async (req, res) => {
  const { rows } = await pool.query(
    `SELECT a.*, u.name AS created_by_name FROM announcements a
     JOIN users u ON u.id = a.created_by
     ORDER BY a.created_at DESC LIMIT 1`
  );
  res.json({ announcement: rows[0] || null });
});

// GET /api/announcements -> histórico completo, com quantas pessoas confirmaram (só ADM)
router.get("/", requireAuth, requireAdmin, async (req, res) => {
  const { rows: totalActiveRows } = await pool.query("SELECT COUNT(*)::int AS total FROM users WHERE active = true");
  const totalActive = totalActiveRows[0].total;

  const { rows } = await pool.query(
    `SELECT a.*, u.name AS created_by_name, COUNT(ak.user_id)::int AS ack_count
     FROM announcements a
     JOIN users u ON u.id = a.created_by
     LEFT JOIN announcement_acks ak ON ak.announcement_id = a.id
     GROUP BY a.id, u.name
     ORDER BY a.created_at DESC`
  );

  res.json({ announcements: rows, totalActive });
});

// GET /api/announcements/:id/acks -> quem já confirmou e quem ainda não (só ADM)
router.get("/:id/acks", requireAuth, requireAdmin, async (req, res) => {
  const { rows: acked } = await pool.query(
    `SELECT u.id, u.name, u.role, ak.acked_at
     FROM announcement_acks ak JOIN users u ON u.id = ak.user_id
     WHERE ak.announcement_id = $1 ORDER BY ak.acked_at`,
    [req.params.id]
  );
  const { rows: pending } = await pool.query(
    `SELECT id, name, role FROM users
     WHERE active = true AND id NOT IN (SELECT user_id FROM announcement_acks WHERE announcement_id = $1)
     ORDER BY name`,
    [req.params.id]
  );
  res.json({ acked, pending });
});

// POST /api/announcements/:id/ack -> a pessoa confirma que ficou ciente
router.post("/:id/ack", requireAuth, async (req, res) => {
  await pool.query(
    "INSERT INTO announcement_acks (announcement_id, user_id) VALUES ($1, $2) ON CONFLICT DO NOTHING",
    [req.params.id, req.user.id]
  );
  const io = req.app.get("io");
  io.emit("announcement:ack", { announcementId: Number(req.params.id), userId: req.user.id, userName: req.user.name });
  res.json({ ok: true });
});

// POST /api/announcements  { message } + arquivo opcional (imagem) -> só ADM
router.post("/", requireAuth, requireAdmin, upload.single("image"), async (req, res) => {
  const { message } = req.body || {};
  if (!message || !message.trim()) return res.status(400).json({ error: "Escreva o texto do comunicado." });

  const imageUrl = req.file ? `/uploads/${req.file.filename}` : null;

  const { rows } = await pool.query(
    `INSERT INTO announcements (message, image_url, created_by) VALUES ($1, $2, $3) RETURNING *`,
    [message.trim(), imageUrl, req.user.id]
  );
  const announcement = { ...rows[0], created_by_name: req.user.name };

  const io = req.app.get("io");
  io.emit("announcement:new", announcement);

  res.status(201).json({ announcement });
});

module.exports = router;
