const express = require("express");
const path = require("path");
const fs = require("fs");
const multer = require("multer");
const { pool } = require("../db");
const { requireAuth, requireAdmin } = require("../middleware/auth");
const { canAccessConversation, dmId, groupConvId } = require("../utils/permissions");

const router = express.Router();

const uploadDir = path.join(__dirname, "..", "..", "uploads");
fs.mkdirSync(uploadDir, { recursive: true });

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, uploadDir),
  filename: (req, file, cb) => {
    const safe = Date.now() + "-" + Math.round(Math.random() * 1e9) + path.extname(file.originalname);
    cb(null, safe);
  },
});
const upload = multer({
  storage,
  limits: { fileSize: Number(process.env.MAX_UPLOAD_SIZE || 20 * 1024 * 1024) },
});

// GET /api/conversations -> lista as conversas visíveis para o usuário logado, com prévia da última mensagem
router.get("/", requireAuth, async (req, res) => {
  const user = req.user;
  const conversations = [];

  if (user.role === "admin") {
    const { rows: operators } = await pool.query(
      "SELECT id, name, color FROM users WHERE role = 'operator' AND active = true ORDER BY name"
    );
    operators.forEach((op) =>
      conversations.push({ id: dmId(op.id), type: "dm", title: op.name, color: op.color, otherUserId: op.id })
    );

    const { rows: groups } = await pool.query(
      `SELECT g.id, g.name, COUNT(gm.user_id)::int AS member_count
       FROM groups g LEFT JOIN group_members gm ON gm.group_id = g.id
       GROUP BY g.id ORDER BY g.name`
    );
    groups.forEach((g) =>
      conversations.push({ id: groupConvId(g.id), type: "group", title: g.name, memberCount: g.member_count, groupId: g.id })
    );
  } else {
    const { rows: admins } = await pool.query("SELECT id, name, color FROM users WHERE role = 'admin' LIMIT 1");
    const admin = admins[0];
    conversations.push({ id: dmId(user.id), type: "dm", title: admin ? admin.name : "Administração", color: admin?.color });

    const { rows: groups } = await pool.query(
      `SELECT g.id, g.name, COUNT(gm2.user_id)::int AS member_count
       FROM groups g
       JOIN group_members gm ON gm.group_id = g.id AND gm.user_id = $1
       LEFT JOIN group_members gm2 ON gm2.group_id = g.id
       GROUP BY g.id ORDER BY g.name`,
      [user.id]
    );
    groups.forEach((g) =>
      conversations.push({ id: groupConvId(g.id), type: "group", title: g.name, memberCount: g.member_count, groupId: g.id })
    );
  }

  // busca última mensagem de cada conversa
  for (const conv of conversations) {
    const { rows } = await pool.query(
      `SELECT type, content, created_at FROM messages WHERE conversation_id = $1 ORDER BY created_at DESC LIMIT 1`,
      [conv.id]
    );
    conv.lastMessage = rows[0] || null;
  }

  res.json({ conversations });
});

// GET /api/conversations/:id/messages -> histórico (mais recentes primeiro, paginado por 'before')
router.get("/:id/messages", requireAuth, async (req, res) => {
  const conversationId = req.params.id;
  if (!(await canAccessConversation(req.user, conversationId))) {
    return res.status(403).json({ error: "Você não tem acesso a esta conversa." });
  }

  const before = req.query.before ? new Date(req.query.before) : new Date();
  const { rows } = await pool.query(
    `SELECT m.*, u.name AS sender_name, u.color AS sender_color
     FROM messages m JOIN users u ON u.id = m.sender_id
     WHERE m.conversation_id = $1 AND m.created_at < $2
     ORDER BY m.created_at DESC LIMIT 50`,
    [conversationId, before]
  );

  res.json({ messages: rows.reverse() });
});

// POST /api/conversations/:id/messages -> envia mensagem de texto
router.post("/:id/messages", requireAuth, async (req, res) => {
  const conversationId = req.params.id;
  const { text } = req.body || {};
  if (!(await canAccessConversation(req.user, conversationId))) {
    return res.status(403).json({ error: "Você não tem acesso a esta conversa." });
  }
  if (!text || !text.trim()) return res.status(400).json({ error: "Mensagem vazia." });

  const { rows } = await pool.query(
    `INSERT INTO messages (conversation_id, sender_id, type, content)
     VALUES ($1, $2, 'text', $3) RETURNING *`,
    [conversationId, req.user.id, text.trim()]
  );
  const message = { ...rows[0], sender_name: req.user.name, sender_color: req.user.color };

  broadcast(req, conversationId, "message:new", message);
  res.status(201).json({ message });
});

// POST /api/conversations/:id/upload -> envia foto, arquivo ou áudio
router.post("/:id/upload", requireAuth, upload.single("file"), async (req, res) => {
  const conversationId = req.params.id;
  if (!(await canAccessConversation(req.user, conversationId))) {
    fs.unlink(req.file.path, () => {});
    return res.status(403).json({ error: "Você não tem acesso a esta conversa." });
  }
  if (!req.file) return res.status(400).json({ error: "Nenhum arquivo enviado." });

  const kind = req.body.kind === "image" || req.body.kind === "audio" ? req.body.kind : "file";
  const fileUrl = `/uploads/${req.file.filename}`;

  const { rows } = await pool.query(
    `INSERT INTO messages (conversation_id, sender_id, type, file_url, file_name, file_size, audio_seconds)
     VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING *`,
    [conversationId, req.user.id, kind, fileUrl, req.file.originalname, req.file.size, req.body.seconds ? Number(req.body.seconds) : null]
  );
  const message = { ...rows[0], sender_name: req.user.name, sender_color: req.user.color };

  broadcast(req, conversationId, "message:new", message);
  res.status(201).json({ message });
});

// PATCH /api/conversations/:id/messages/:msgId/pin -> fixar/desafixar (só ADM)
router.patch("/:id/messages/:msgId/pin", requireAuth, requireAdmin, async (req, res) => {
  const conversationId = req.params.id;
  const { pinned } = req.body || {};

  if (pinned) {
    // só uma mensagem fixada por conversa: desfixa as outras antes
    await pool.query("UPDATE messages SET pinned = false WHERE conversation_id = $1", [conversationId]);
  }

  const { rows } = await pool.query(
    `UPDATE messages SET pinned = $1, pinned_by = $2, pinned_at = CASE WHEN $1 THEN now() ELSE NULL END
     WHERE id = $3 AND conversation_id = $4 RETURNING *`,
    [!!pinned, req.user.id, req.params.msgId, conversationId]
  );
  const message = rows[0];
  if (!message) return res.status(404).json({ error: "Mensagem não encontrada." });

  broadcast(req, conversationId, "message:pinned", message);
  res.json({ message });
});

function broadcast(req, conversationId, event, payload) {
  const io = req.app.get("io");
  io.to(`conv-${conversationId}`).emit(event, payload);
}

module.exports = router;
