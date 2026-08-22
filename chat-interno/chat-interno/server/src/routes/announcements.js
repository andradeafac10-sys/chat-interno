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
