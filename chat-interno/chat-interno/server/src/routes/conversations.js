const express = require("express");
const { pool } = require("../db");
const { requireAuth, requireAdmin } = require("../middleware/auth");
const { canAccessConversation, pairDmId, groupConvId } = require("../utils/permissions");
const { upload } = require("../middleware/upload");
const fs = require("fs");

const router = express.Router();

// GET /api/conversations -> lista as conversas visíveis para o usuário logado, com prévia da última mensagem
router.get("/", requireAuth, async (req, res) => {
  const user = req.user;
  const conversations = [];

  if (user.role === "admin") {
    const { rows: operators } = await pool.query(
      "SELECT id, name, color, avatar_url FROM users WHERE role = 'operator' AND active = true ORDER BY name"
    );
    operators.forEach((op) =>
      conversations.push({ id: pairDmId(user.id, op.id), type: "dm", title: op.name, color: op.color, avatarUrl: op.avatar_url, otherUserId: op.id })
    );

    // Conversas privadas com os outros ADMs
    const { rows: otherAdmins } = await pool.query(
      "SELECT id, name, color, avatar_url FROM users WHERE role = 'admin' AND active = true AND id != $1 ORDER BY name",
      [user.id]
    );
    otherAdmins.forEach((adm) =>
      conversations.push({
        id: pairDmId(user.id, adm.id),
        type: "dm",
        title: adm.name,
        color: adm.color,
        avatarUrl: adm.avatar_url,
        otherUserId: adm.id,
        isAdmin: true,
      })
    );

    const { rows: groups } = await pool.query(
      `SELECT g.id, g.name, g.avatar_url, COUNT(gm.user_id)::int AS member_count
       FROM groups g LEFT JOIN group_members gm ON gm.group_id = g.id
       GROUP BY g.id ORDER BY g.name`
    );
    groups.forEach((g) =>
      conversations.push({ id: groupConvId(g.id), type: "group", title: g.name, avatarUrl: g.avatar_url, memberCount: g.member_count, groupId: g.id })
    );
  } else {
    // Conversas privadas com CADA ADM ativo
    const { rows: admins } = await pool.query(
      "SELECT id, name, color, avatar_url FROM users WHERE role = 'admin' AND active = true ORDER BY name"
    );
    admins.forEach((adm) =>
      conversations.push({
        id: pairDmId(user.id, adm.id),
        type: "dm",
        title: adm.name,
        color: adm.color,
        avatarUrl: adm.avatar_url,
        otherUserId: adm.id,
        isAdmin: true,
      })
    );

    const { rows: groups } = await pool.query(
      `SELECT g.id, g.name, g.avatar_url, COUNT(gm2.user_id)::int AS member_count
       FROM groups g
       JOIN group_members gm ON gm.group_id = g.id AND gm.user_id = $1
       LEFT JOIN group_members gm2 ON gm2.group_id = g.id
       GROUP BY g.id ORDER BY g.name`,
      [user.id]
    );
    groups.forEach((g) =>
      conversations.push({ id: groupConvId(g.id), type: "group", title: g.name, avatarUrl: g.avatar_url, memberCount: g.member_count, groupId: g.id })
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
    `SELECT m.*, u.name AS sender_name, u.color AS sender_color, u.avatar_url AS sender_avatar_url,
            r.id AS reply_id, r.type AS reply_type, r.content AS reply_content,
            r.deleted AS reply_deleted, ru.name AS reply_sender_name
     FROM messages m
     JOIN users u ON u.id = m.sender_id
     LEFT JOIN messages r ON r.id = m.reply_to_id
     LEFT JOIN users ru ON ru.id = r.sender_id
     WHERE m.conversation_id = $1 AND m.created_at < $2
     ORDER BY m.created_at DESC LIMIT 50`,
    [conversationId, before]
  );

  const ids = rows.map((r) => r.id);
  let reactionsByMessage = {};
  if (ids.length > 0) {
    const { rows: reactions } = await pool.query(
      `SELECT message_id, user_id, emoji FROM message_reactions WHERE message_id = ANY($1::int[])`,
      [ids]
    );
    reactionsByMessage = reactions.reduce((acc, r) => {
      (acc[r.message_id] ||= []).push({ userId: r.user_id, emoji: r.emoji });
      return acc;
    }, {});
  }

  const messages = rows.map((r) => ({ ...r, reactions: reactionsByMessage[r.id] || [] }));
  res.json({ messages: messages.reverse() });
});

// POST /api/conversations/:id/messages -> envia mensagem de texto (opcionalmente respondendo outra)
router.post("/:id/messages", requireAuth, async (req, res) => {
  const conversationId = req.params.id;
  const { text, replyToId } = req.body || {};
  if (!(await canAccessConversation(req.user, conversationId))) {
    return res.status(403).json({ error: "Você não tem acesso a esta conversa." });
  }
  if (!text || !text.trim()) return res.status(400).json({ error: "Mensagem vazia." });

  const { rows } = await pool.query(
    `INSERT INTO messages (conversation_id, sender_id, type, content, reply_to_id)
     VALUES ($1, $2, 'text', $3, $4) RETURNING *`,
    [conversationId, req.user.id, text.trim(), replyToId || null]
  );
  const message = await hydrateNewMessage(rows[0], req.user);

  broadcast(req, conversationId, "message:new", message);
  res.status(201).json({ message });
});

// POST /api/conversations/:id/upload -> envia foto, arquivo ou áudio (opcionalmente respondendo outra)
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
    `INSERT INTO messages (conversation_id, sender_id, type, file_url, file_name, file_size, audio_seconds, reply_to_id)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING *`,
    [conversationId, req.user.id, kind, fileUrl, req.file.originalname, req.file.size, req.body.seconds ? Number(req.body.seconds) : null, req.body.replyToId || null]
  );
  const message = await hydrateNewMessage(rows[0], req.user);

  broadcast(req, conversationId, "message:new", message);
  res.status(201).json({ message });
});

// PATCH /api/conversations/:id/messages/:msgId -> editar o texto da própria mensagem
router.patch("/:id/messages/:msgId", requireAuth, async (req, res) => {
  const conversationId = req.params.id;
  const { text } = req.body || {};
  if (!text || !text.trim()) return res.status(400).json({ error: "Mensagem vazia." });

  const { rows: existing } = await pool.query("SELECT * FROM messages WHERE id = $1 AND conversation_id = $2", [req.params.msgId, conversationId]);
  const original = existing[0];
  if (!original) return res.status(404).json({ error: "Mensagem não encontrada." });
  if (original.sender_id !== req.user.id) return res.status(403).json({ error: "Você só pode editar suas próprias mensagens." });
  if (original.type !== "text") return res.status(400).json({ error: "Só é possível editar mensagens de texto." });

  const { rows } = await pool.query(
    `UPDATE messages SET content = $1, edited = true, edited_at = now() WHERE id = $2 RETURNING *`,
    [text.trim(), req.params.msgId]
  );
  const message = { ...rows[0], sender_name: req.user.name, sender_color: req.user.color, sender_avatar_url: req.user.avatar_url };

  broadcast(req, conversationId, "message:edited", message);
  res.json({ message });
});

// DELETE /api/conversations/:id/messages/:msgId -> apaga (o próprio dono ou qualquer ADM)
router.delete("/:id/messages/:msgId", requireAuth, async (req, res) => {
  const conversationId = req.params.id;
  const { rows: existing } = await pool.query("SELECT * FROM messages WHERE id = $1 AND conversation_id = $2", [req.params.msgId, conversationId]);
  const original = existing[0];
  if (!original) return res.status(404).json({ error: "Mensagem não encontrada." });
  if (original.sender_id !== req.user.id && req.user.role !== "admin") {
    return res.status(403).json({ error: "Você não pode apagar essa mensagem." });
  }

  const { rows } = await pool.query(
    `UPDATE messages SET deleted = true, deleted_at = now(), content = NULL, file_url = NULL, file_name = NULL
     WHERE id = $1 RETURNING *`,
    [req.params.msgId]
  );
  const message = { ...rows[0], sender_name: original.sender_id === req.user.id ? req.user.name : undefined };

  broadcast(req, conversationId, "message:deleted", { id: rows[0].id, conversation_id: conversationId });
  res.json({ ok: true });
});

// POST /api/conversations/:id/messages/:msgId/reactions -> reagir (👍 ou ❌); clicar de novo no mesmo remove
router.post("/:id/messages/:msgId/reactions", requireAuth, async (req, res) => {
  const { emoji } = req.body || {};
  if (!["👍", "❌"].includes(emoji)) return res.status(400).json({ error: "Reação inválida." });

  const { rows: existing } = await pool.query(
    "SELECT emoji FROM message_reactions WHERE message_id = $1 AND user_id = $2",
    [req.params.msgId, req.user.id]
  );

  if (existing[0] && existing[0].emoji === emoji) {
    await pool.query("DELETE FROM message_reactions WHERE message_id = $1 AND user_id = $2", [req.params.msgId, req.user.id]);
  } else {
    await pool.query(
      `INSERT INTO message_reactions (message_id, user_id, emoji) VALUES ($1, $2, $3)
       ON CONFLICT (message_id, user_id) DO UPDATE SET emoji = $3`,
      [req.params.msgId, req.user.id, emoji]
    );
  }

  const { rows: reactions } = await pool.query(
    "SELECT user_id, emoji FROM message_reactions WHERE message_id = $1",
    [req.params.msgId]
  );

  const payload = { messageId: Number(req.params.msgId), conversationId: req.params.id, reactions: reactions.map((r) => ({ userId: r.user_id, emoji: r.emoji })) };
  broadcast(req, req.params.id, "message:reaction", payload);
  res.json(payload);
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

// Monta a mensagem recém-criada já com o preview de "respondendo a" (se houver) e reações vazias
async function hydrateNewMessage(row, sender) {
  let reply = {};
  if (row.reply_to_id) {
    const { rows } = await pool.query(
      `SELECT r.id AS reply_id, r.type AS reply_type, r.content AS reply_content, r.deleted AS reply_deleted, ru.name AS reply_sender_name
       FROM messages r JOIN users ru ON ru.id = r.sender_id WHERE r.id = $1`,
      [row.reply_to_id]
    );
    if (rows[0]) reply = rows[0];
  }
  return { ...row, sender_name: sender.name, sender_color: sender.color, sender_avatar_url: sender.avatar_url, reactions: [], ...reply };
}

module.exports = router;
