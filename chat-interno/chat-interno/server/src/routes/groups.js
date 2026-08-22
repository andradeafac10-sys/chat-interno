const express = require("express");
const fs = require("fs");
const { pool } = require("../db");
const { requireAuth, requireAdmin } = require("../middleware/auth");
const { groupConvId } = require("../utils/permissions");
const { upload } = require("../middleware/upload");

const router = express.Router();

// GET /api/groups/:id -> detalhes completos pra tela de edição (só ADM)
router.get("/:id", requireAuth, requireAdmin, async (req, res) => {
  const groupId = Number(req.params.id);
  const { rows } = await pool.query(
    "SELECT id, name, avatar_url, created_by FROM groups WHERE id = $1",
    [groupId]
  );
  if (!rows[0]) return res.status(404).json({ error: "Grupo não encontrado." });

  const { rows: members } = await pool.query(
    "SELECT user_id FROM group_members WHERE group_id = $1",
    [groupId]
  );

  res.json({ group: { ...rows[0], avatarUrl: rows[0].avatar_url, memberIds: members.map((m) => m.user_id) } });
});

// POST /api/groups  { name, memberIds: [operatorId, ...] } -> só ADM cria
router.post("/", requireAuth, requireAdmin, async (req, res) => {
  const { name, memberIds } = req.body || {};
  if (!name || !Array.isArray(memberIds) || memberIds.length === 0) {
    return res.status(400).json({ error: "Informe um nome e ao menos um membro." });
  }

  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const { rows } = await client.query(
      "INSERT INTO groups (name, created_by) VALUES ($1, $2) RETURNING id, name, created_by, created_at",
      [name.trim(), req.user.id]
    );
    const group = rows[0];

    for (const memberId of memberIds) {
      await client.query(
        "INSERT INTO group_members (group_id, user_id) VALUES ($1, $2) ON CONFLICT DO NOTHING",
        [group.id, memberId]
      );
    }
    await client.query("COMMIT");

    const io = req.app.get("io");
    memberIds.forEach((uid) => io.to(`user-${uid}`).emit("group:created", { groupId: group.id }));

    res.status(201).json({ group: { ...group, id: group.id, conversationId: groupConvId(group.id), memberIds } });
  } catch (err) {
    await client.query("ROLLBACK");
    console.error(err);
    res.status(500).json({ error: "Erro ao criar grupo." });
  } finally {
    client.release();
  }
});

// PATCH /api/groups/:id/members  { add: [], remove: [] } -> só ADM
router.patch("/:id/members", requireAuth, requireAdmin, async (req, res) => {
  const groupId = Number(req.params.id);
  const { add = [], remove = [] } = req.body || {};
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    for (const uid of add) {
      await client.query(
        "INSERT INTO group_members (group_id, user_id) VALUES ($1, $2) ON CONFLICT DO NOTHING",
        [groupId, uid]
      );
    }
    for (const uid of remove) {
      await client.query("DELETE FROM group_members WHERE group_id = $1 AND user_id = $2", [groupId, uid]);
    }
    await client.query("COMMIT");

    const io = req.app.get("io");
    add.forEach((uid) => io.to(`user-${uid}`).emit("group:created", { groupId }));
    remove.forEach((uid) => io.to(`user-${uid}`).emit("group:removed", { groupId }));

    res.json({ ok: true });
  } catch (err) {
    await client.query("ROLLBACK");
    console.error(err);
    res.status(500).json({ error: "Erro ao atualizar membros." });
  } finally {
    client.release();
  }
});

// PATCH /api/groups/:id  { name } -> renomear grupo (só ADM)
router.patch("/:id", requireAuth, requireAdmin, async (req, res) => {
  const { name } = req.body || {};
  if (!name || !name.trim()) return res.status(400).json({ error: "O nome não pode ficar vazio." });

  const { rows } = await pool.query(
    "UPDATE groups SET name = $1 WHERE id = $2 RETURNING id, name, avatar_url",
    [name.trim(), req.params.id]
  );
  if (!rows[0]) return res.status(404).json({ error: "Grupo não encontrado." });

  const io = req.app.get("io");
  io.to(`conv-${groupConvId(req.params.id)}`).emit("group:updated", { groupId: Number(req.params.id), name: rows[0].name });

  res.json({ group: { ...rows[0], avatarUrl: rows[0].avatar_url } });
});

// POST /api/groups/:id/avatar -> trocar a foto do grupo (só ADM)
router.post("/:id/avatar", requireAuth, requireAdmin, upload.single("file"), async (req, res) => {
  if (!req.file) return res.status(400).json({ error: "Nenhuma imagem enviada." });

  const avatarUrl = `/uploads/${req.file.filename}`;
  const { rows } = await pool.query(
    "UPDATE groups SET avatar_url = $1 WHERE id = $2 RETURNING id, name, avatar_url",
    [avatarUrl, req.params.id]
  );
  if (!rows[0]) {
    fs.unlink(req.file.path, () => {});
    return res.status(404).json({ error: "Grupo não encontrado." });
  }

  const io = req.app.get("io");
  io.to(`conv-${groupConvId(req.params.id)}`).emit("group:updated", { groupId: Number(req.params.id), avatarUrl });

  res.json({ group: { ...rows[0], avatarUrl: rows[0].avatar_url } });
});

module.exports = router;
