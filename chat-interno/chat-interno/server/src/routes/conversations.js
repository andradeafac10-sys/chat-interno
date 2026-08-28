const express = require("express");
const { pool } = require("../db");
const { requireAuth, requireAdmin } = require("../middleware/auth");
const { canAccessConversation, canMonitorConversation, pairDmId, groupConvId } = require("../utils/permissions");
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
      `SELECT g.id, g.name, g.avatar_url, COUNT(gm.user_id)::int AS member_count,
              EXISTS(SELECT 1 FROM group_members gm2 WHERE gm2.group_id = g.id AND gm2.user_id = $1) AS is_member
       FROM groups g LEFT JOIN group_members gm ON gm.group_id = g.id
       WHERE NOT EXISTS (SELECT 1 FROM hidden_groups hg WHERE hg.group_id = g.id AND hg.user_id = $1)
       GROUP BY g.id ORDER BY g.name`,
      [user.id]
    );
    groups.forEach((g) =>
      conversations.push({ id: groupConvId(g.id), type: "group", title: g.name, avatarUrl: g.avatar_url, memberCount: g.member_count, groupId: g.id, isMember: g.is_member })
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

    // Conversas privadas com os OUTROS operadores — como agora dá pra monitorar
    // tudo (ADM vê conversas envolvendo operador), abrir essa comunicação direta
    // entre operadores também.
    const { rows: otherOperators } = await pool.query(
      "SELECT id, name, color, avatar_url FROM users WHERE role = 'operator' AND active = true AND id != $1 ORDER BY name",
      [user.id]
    );
    otherOperators.forEach((op) =>
      conversations.push({
        id: pairDmId(user.id, op.id),
        type: "dm",
        title: op.name,
        color: op.color,
        avatarUrl: op.avatar_url,
        otherUserId: op.id,
      })
    );

    const { rows: groups } = await pool.query(
      `SELECT g.id, g.name, g.avatar_url, COUNT(gm2.user_id)::int AS member_count
       FROM groups g
       JOIN group_members gm ON gm.group_id = g.id AND gm.user_id = $1
       LEFT JOIN group_members gm2 ON gm2.group_id = g.id
       WHERE NOT EXISTS (SELECT 1 FROM hidden_groups hg WHERE hg.group_id = g.id AND hg.user_id = $1)
       GROUP BY g.id ORDER BY g.name`,
      [user.id]
    );
    groups.forEach((g) =>
      conversations.push({ id: groupConvId(g.id), type: "group", title: g.name, avatarUrl: g.avatar_url, memberCount: g.member_count, groupId: g.id, isMember: true })
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

  // Conversas privadas sem NENHUMA mensagem ainda ficam de fora da lista pessoal —
  // agora todo mundo (ADM e operador) tem o painel de "online" à direita pra iniciar
  // conversa nova com quem quiser. Grupos sempre aparecem.
  let resultado = conversations.filter((c) => c.type !== "dm" || c.lastMessage);

  // Conversas privadas que a pessoa "fechou" ficam de fora (o histórico continua
  // existindo — só some da lista até alguém mandar mensagem de novo).
  const { rows: fechadas } = await pool.query(
    "SELECT other_user_id FROM closed_dms WHERE user_id = $1",
    [user.id]
  );
  const fechadasIds = new Set(fechadas.map((f) => f.other_user_id));
  resultado = resultado.filter((c) => c.type !== "dm" || !fechadasIds.has(c.otherUserId));

  // Marca quais estão fixadas, e coloca elas primeiro na lista
  const { rows: fixadas } = await pool.query(
    "SELECT conversation_id, pinned_at FROM pinned_conversations WHERE user_id = $1",
    [user.id]
  );
  const fixadasMap = new Map(fixadas.map((f) => [f.conversation_id, f.pinned_at]));
  resultado = resultado.map((c) => ({ ...c, pinned: fixadasMap.has(c.id), pinnedAt: fixadasMap.get(c.id) || null }));
  resultado.sort((a, b) => {
    if (a.pinned && !b.pinned) return -1;
    if (!a.pinned && b.pinned) return 1;
    if (a.pinned && b.pinned) return new Date(b.pinnedAt) - new Date(a.pinnedAt);
    const dataA = a.lastMessage?.created_at ? new Date(a.lastMessage.created_at) : 0;
    const dataB = b.lastMessage?.created_at ? new Date(b.lastMessage.created_at) : 0;
    return dataB - dataA;
  });

  // Quantas mensagens não lidas em cada conversa — calculado no servidor,
  // então sobrevive a dar F5 (antes só existia na memória da tela).
  for (const conv of resultado) {
    const { rows: naoLidas } = await pool.query(
      `SELECT COUNT(*)::int AS total FROM messages m
       WHERE m.conversation_id = $1 AND m.sender_id != $2 AND m.deleted = false
         AND m.created_at > COALESCE(
           (SELECT last_read_at FROM conversation_reads WHERE user_id = $2 AND conversation_id = $1),
           'epoch'::timestamptz
         )`,
      [conv.id, user.id]
    );
    conv.unreadCount = naoLidas[0].total;
  }

  res.json({ conversations: resultado });
});

// POST /api/conversations/:id/pin -> fixa uma conversa no topo da lista (pessoal, não afeta ninguém mais)
// POST /api/conversations/:id/read -> marca como lida até agora (some o contador de não lidas)
router.post("/:id/read", requireAuth, async (req, res) => {
  await pool.query(
    `INSERT INTO conversation_reads (user_id, conversation_id, last_read_at) VALUES ($1, $2, now())
     ON CONFLICT (user_id, conversation_id) DO UPDATE SET last_read_at = now()`,
    [req.user.id, req.params.id]
  );
  res.json({ ok: true });
});

router.post("/:id/pin", requireAuth, async (req, res) => {
  await pool.query(
    "INSERT INTO pinned_conversations (user_id, conversation_id) VALUES ($1, $2) ON CONFLICT DO NOTHING",
    [req.user.id, req.params.id]
  );
  res.json({ ok: true });
});

// DELETE /api/conversations/:id/pin -> desafixa
router.delete("/:id/pin", requireAuth, async (req, res) => {
  await pool.query(
    "DELETE FROM pinned_conversations WHERE user_id = $1 AND conversation_id = $2",
    [req.user.id, req.params.id]
  );
  res.json({ ok: true });
});

// POST /api/conversations/:id/close -> fecha uma conversa PRIVADA (nunca apaga histórico;
// volta a aparecer sozinha assim que qualquer um dos dois mandar mensagem de novo)
router.post("/:id/close", requireAuth, async (req, res) => {
  if (!req.params.id.startsWith("dm-")) {
    return res.status(400).json({ error: "Só é possível fechar conversas privadas." });
  }
  const [, a, b] = req.params.id.split("-").map(Number);
  const outroId = a === req.user.id ? b : a;
  if (![a, b].includes(req.user.id)) {
    return res.status(403).json({ error: "Você não participa dessa conversa." });
  }
  await pool.query(
    "INSERT INTO closed_dms (user_id, other_user_id) VALUES ($1, $2) ON CONFLICT DO NOTHING",
    [req.user.id, outroId]
  );
  res.json({ ok: true });
});

// GET /api/conversations/:id/messages -> histórico (mais recentes primeiro, paginado por 'before')
router.get("/:id/messages", requireAuth, async (req, res) => {
  const conversationId = req.params.id;
  const allowed = (await canAccessConversation(req.user, conversationId)) ||
                  (await canMonitorConversation(req.user, conversationId));
  if (!allowed) {
    return res.status(403).json({ error: "Você não tem acesso a esta conversa." });
  }

  // Se veio "aroundId", carrega a conversa a partir daquela mensagem (usado pela busca),
  // trazendo também o que veio depois dela. Senão, carrega as mais recentes.
  let before = req.query.before ? new Date(req.query.before) : new Date();
  let limit = 50;

  if (req.query.aroundId) {
    const { rows: alvo } = await pool.query(
      "SELECT created_at FROM messages WHERE id = $1 AND conversation_id = $2",
      [req.query.aroundId, conversationId]
    );
    if (alvo[0]) {
      const { rows: depois } = await pool.query(
        "SELECT COUNT(*)::int AS total FROM messages WHERE conversation_id = $1 AND created_at >= $2",
        [conversationId, alvo[0].created_at]
      );
      // pega tudo que veio depois da mensagem + 25 anteriores, pra dar contexto
      limit = Math.min(depois[0].total + 25, 500);
    }
  }
  const { rows } = await pool.query(
    `SELECT m.*, u.name AS sender_name, u.color AS sender_color, u.avatar_url AS sender_avatar_url,
            r.id AS reply_id, r.type AS reply_type, r.content AS reply_content,
            r.deleted AS reply_deleted, ru.name AS reply_sender_name
     FROM messages m
     JOIN users u ON u.id = m.sender_id
     LEFT JOIN messages r ON r.id = m.reply_to_id
     LEFT JOIN users ru ON ru.id = r.sender_id
     WHERE m.conversation_id = $1 AND m.created_at < $2
     ORDER BY m.created_at DESC LIMIT $3`,
    [conversationId, before, limit]
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

// GET /api/conversations/:id/search?q=texto -> busca mensagens dentro da conversa
router.get("/:id/search", requireAuth, async (req, res) => {
  const conversationId = req.params.id;
  const q = (req.query.q || "").trim();

  const allowed = (await canAccessConversation(req.user, conversationId)) ||
                  (await canMonitorConversation(req.user, conversationId));
  if (!allowed) {
    return res.status(403).json({ error: "Você não tem acesso a esta conversa." });
  }
  if (q.length < 2) return res.json({ messages: [] });

  const { rows } = await pool.query(
    `SELECT m.id, m.content, m.type, m.file_name, m.created_at,
            u.name AS sender_name, u.color AS sender_color,
            (SELECT COUNT(*)::int FROM messages m2
             WHERE m2.conversation_id = m.conversation_id AND m2.created_at >= m.created_at) AS position_from_end
     FROM messages m JOIN users u ON u.id = m.sender_id
     WHERE m.conversation_id = $1 AND m.deleted = false
       AND (m.content ILIKE $2 OR m.file_name ILIKE $2)
     ORDER BY m.created_at DESC LIMIT 40`,
    [conversationId, `%${q}%`]
  );

  res.json({ messages: rows });
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
  await reabrirDmSeFechada(conversationId);

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
  const legenda = req.body.caption && req.body.caption.trim() ? req.body.caption.trim() : null;

  const { rows } = await pool.query(
    `INSERT INTO messages (conversation_id, sender_id, type, content, file_url, file_name, file_size, audio_seconds, reply_to_id)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9) RETURNING *`,
    [conversationId, req.user.id, kind, legenda, fileUrl, req.file.originalname, req.file.size, req.body.seconds ? Number(req.body.seconds) : null, req.body.replyToId || null]
  );
  const message = await hydrateNewMessage(rows[0], req.user);
  await reabrirDmSeFechada(conversationId);

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

// DELETE /api/conversations/:id/messages/:msgId -> apaga (SOMENTE ADM; operadores não podem apagar)
router.delete("/:id/messages/:msgId", requireAuth, requireAdmin, async (req, res) => {
  const conversationId = req.params.id;
  const { rows: existing } = await pool.query("SELECT * FROM messages WHERE id = $1 AND conversation_id = $2", [req.params.msgId, conversationId]);
  const original = existing[0];
  if (!original) return res.status(404).json({ error: "Mensagem não encontrada." });

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
const REACOES_PERMITIDAS = ["👍", "❤️", "😂", "😮", "😢", "🙏"];

router.post("/:id/messages/:msgId/reactions", requireAuth, async (req, res) => {
  const { emoji } = req.body || {};
  if (!(await canAccessConversation(req.user, req.params.id))) {
    return res.status(403).json({ error: "Você não tem acesso a esta conversa." });
  }
  if (!REACOES_PERMITIDAS.includes(emoji)) return res.status(400).json({ error: "Reação inválida." });

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
    const { rows: contagem } = await pool.query(
      "SELECT COUNT(*)::int AS total FROM messages WHERE conversation_id = $1 AND pinned = true",
      [conversationId]
    );
    if (contagem[0].total >= 10) {
      return res.status(400).json({ error: "Já tem 10 mensagens fixadas nessa conversa. Desafixe alguma antes de fixar outra." });
    }
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

// GET /api/conversations/:id/pinned -> lista as mensagens fixadas dessa conversa (mais recente primeiro)
router.get("/:id/pinned", requireAuth, async (req, res) => {
  const conversationId = req.params.id;
  const allowed = (await canAccessConversation(req.user, conversationId)) ||
                  (await canMonitorConversation(req.user, conversationId));
  if (!allowed) return res.status(403).json({ error: "Você não tem acesso a esta conversa." });

  const { rows } = await pool.query(
    `SELECT m.id, m.type, m.content, m.file_name, m.file_url, m.created_at, m.pinned_at,
            u.name AS sender_name, u.color AS sender_color, u.avatar_url AS sender_avatar_url
     FROM messages m JOIN users u ON u.id = m.sender_id
     WHERE m.conversation_id = $1 AND m.pinned = true AND m.deleted = false
     ORDER BY m.pinned_at DESC LIMIT 10`,
    [conversationId]
  );
  res.json({ pinned: rows });
});

function broadcast(req, conversationId, event, payload) {
  const io = req.app.get("io");
  io.to(`conv-${conversationId}`).emit(event, payload);
}

// Monta a mensagem recém-criada já com o preview de "respondendo a" (se houver) e reações vazias
// Se a conversa for privada e algum dos dois tinha "fechado", reabre pros dois
// automaticamente — trocar mensagem de novo é sinal claro que a conversa "voltou".
async function reabrirDmSeFechada(conversationId) {
  if (!conversationId.startsWith("dm-")) return;
  const [, a, b] = conversationId.split("-").map(Number);
  await pool.query(
    "DELETE FROM closed_dms WHERE (user_id = $1 AND other_user_id = $2) OR (user_id = $2 AND other_user_id = $1)",
    [a, b]
  );
}

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

// POST /api/conversations/groups/:groupId/hide -> esconde esse grupo só da MINHA lista (não afeta ninguém mais)
router.post("/groups/:groupId/hide", requireAuth, async (req, res) => {
  await pool.query(
    "INSERT INTO hidden_groups (user_id, group_id) VALUES ($1, $2) ON CONFLICT DO NOTHING",
    [req.user.id, req.params.groupId]
  );
  res.json({ ok: true });
});

// DELETE /api/conversations/groups/:groupId/hide -> mostra esse grupo de novo na minha lista
router.delete("/groups/:groupId/hide", requireAuth, async (req, res) => {
  await pool.query("DELETE FROM hidden_groups WHERE user_id = $1 AND group_id = $2", [req.user.id, req.params.groupId]);
  res.json({ ok: true });
});

// GET /api/conversations/hidden-groups -> lista os grupos que EU escondi, pra eu poder trazer de volta
router.get("/hidden-groups", requireAuth, async (req, res) => {
  const { rows } = await pool.query(
    `SELECT g.id, g.name, g.avatar_url, hg.hidden_at
     FROM hidden_groups hg JOIN groups g ON g.id = hg.group_id
     WHERE hg.user_id = $1 ORDER BY hg.hidden_at DESC`,
    [req.user.id]
  );
  res.json({ groups: rows });
});

module.exports = router;
