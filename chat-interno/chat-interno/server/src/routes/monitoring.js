const express = require("express");
const { pool } = require("../db");
const { requireAuth, requireAdmin } = require("../middleware/auth");
const { pairDmId, groupConvId } = require("../utils/permissions");

const router = express.Router();

// GET /api/monitoring/conversations?userId=X
// Lista todas as conversas em que a pessoa participa (privadas e grupos), pro ADM escolher qual auditar.
router.get("/conversations", requireAuth, requireAdmin, async (req, res) => {
  const userId = Number(req.query.userId);
  if (!userId) return res.status(400).json({ error: "Informe o usuário." });

  const { rows: target } = await pool.query("SELECT id, name, role FROM users WHERE id = $1", [userId]);
  if (!target[0]) return res.status(404).json({ error: "Usuário não encontrado." });

  const conversations = [];

  // Conversas privadas: apenas as que envolvem pelo menos um operador
  // (conversa entre dois ADMs continua privada, ninguém audita)
  const { rows: others } = await pool.query(
    "SELECT id, name, role, color FROM users WHERE id != $1 ORDER BY name",
    [userId]
  );
  others
    .filter((o) => target[0].role === "operator" || o.role === "operator")
    .forEach((o) =>
      conversations.push({
        id: pairDmId(userId, o.id),
        type: "dm",
        title: `${target[0].name} ↔ ${o.name}`,
        withName: o.name,
        withRole: o.role,
        color: o.color,
      })
    );

  // Grupos dos quais a pessoa participa
  const { rows: groups } = await pool.query(
    `SELECT g.id, g.name FROM groups g
     JOIN group_members gm ON gm.group_id = g.id AND gm.user_id = $1
     ORDER BY g.name`,
    [userId]
  );
  groups.forEach((g) =>
    conversations.push({ id: groupConvId(g.id), type: "group", title: g.name, groupId: g.id })
  );

  // Só devolve as conversas que realmente têm mensagens, pra não poluir a tela
  const withMessages = [];
  for (const conv of conversations) {
    const { rows } = await pool.query(
      "SELECT COUNT(*)::int AS total, MAX(created_at) AS last_at FROM messages WHERE conversation_id = $1",
      [conv.id]
    );
    if (rows[0].total > 0) {
      withMessages.push({ ...conv, messageCount: rows[0].total, lastAt: rows[0].last_at });
    }
  }

  withMessages.sort((a, b) => new Date(b.lastAt) - new Date(a.lastAt));

  res.json({ target: target[0], conversations: withMessages });
});

// GET /api/monitoring/messages?conversationId=X
// Histórico completo de uma conversa, para auditoria (inclui mensagens apagadas, marcadas como tal).
router.get("/messages", requireAuth, requireAdmin, async (req, res) => {
  const conversationId = req.query.conversationId;
  if (!conversationId) return res.status(400).json({ error: "Informe a conversa." });

  // Segurança: conversa privada entre dois ADMs não pode ser auditada por ninguém
  if (conversationId.startsWith("dm-")) {
    const [, a, b] = conversationId.split("-");
    const { rows: participants } = await pool.query(
      "SELECT role FROM users WHERE id = ANY($1::int[])",
      [[Number(a), Number(b)]]
    );
    const envolveOperador = participants.some((p) => p.role === "operator");
    const souParticipante = req.user.id === Number(a) || req.user.id === Number(b);
    if (!envolveOperador && !souParticipante) {
      return res.status(403).json({ error: "Conversas privadas entre administradores não podem ser auditadas." });
    }
  }

  const { rows } = await pool.query(
    `SELECT m.*, u.name AS sender_name, u.color AS sender_color, u.avatar_url AS sender_avatar_url
     FROM messages m JOIN users u ON u.id = m.sender_id
     WHERE m.conversation_id = $1
     ORDER BY m.created_at ASC`,
    [conversationId]
  );

  res.json({ messages: rows });
});

module.exports = router;
