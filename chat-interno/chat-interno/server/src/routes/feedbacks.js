const express = require("express");
const { pool } = require("../db");
const { requireAuth, requireAdmin } = require("../middleware/auth");
const { upload } = require("../middleware/upload");

const router = express.Router();

// GET /api/feedbacks/mine -> os feedbacks que EU recebi, com o meu status de "ciente"
router.get("/mine", requireAuth, async (req, res) => {
  try {
    const { rows } = await pool.query(
      `SELECT f.id, f.title, f.content, f.attachment_url, f.attachment_name, f.created_at,
              fr.acknowledged_at,
              u.name AS created_by_name
       FROM feedback_recipients fr
       JOIN feedbacks f ON f.id = fr.feedback_id
       JOIN users u ON u.id = f.created_by
       WHERE fr.user_id = $1
       ORDER BY (fr.acknowledged_at IS NULL) DESC, f.created_at DESC`,
      [req.user.id]
    );
    res.json({ feedbacks: rows });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Erro ao carregar seus feedbacks." });
  }
});

// GET /api/feedbacks/mine/pending-count -> só o número, pra tarja vermelha no topo
router.get("/mine/pending-count", requireAuth, async (req, res) => {
  try {
    const { rows } = await pool.query(
      `SELECT COUNT(*)::int AS count FROM feedback_recipients WHERE user_id = $1 AND acknowledged_at IS NULL`,
      [req.user.id]
    );
    res.json({ count: rows[0].count });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Erro ao contar feedbacks pendentes." });
  }
});

// POST /api/feedbacks/:id/ack -> "OK, CIENTE" — confirma que li esse feedback
router.post("/:id/ack", requireAuth, async (req, res) => {
  try {
    const { rows } = await pool.query(
      `UPDATE feedback_recipients SET acknowledged_at = now()
       WHERE feedback_id = $1 AND user_id = $2 AND acknowledged_at IS NULL
       RETURNING feedback_id`,
      [req.params.id, req.user.id]
    );
    if (rows.length === 0) return res.status(404).json({ error: "Feedback não encontrado ou já confirmado." });
    res.json({ ok: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Não deu pra confirmar. Tente de novo." });
  }
});

// GET /api/feedbacks -> lista geral (só ADM), cada feedback com todos os destinatários e o status de cada um
router.get("/", requireAuth, requireAdmin, async (req, res) => {
  try {
    const params = [];
    let where = "";
    if (req.query.userId) {
      params.push(req.query.userId);
      where = `WHERE f.id IN (SELECT feedback_id FROM feedback_recipients WHERE user_id = $${params.length})`;
    }
    const { rows: feedbacks } = await pool.query(
      `SELECT f.id, f.title, f.content, f.attachment_url, f.attachment_name, f.created_at,
              cu.name AS created_by_name
       FROM feedbacks f
       JOIN users cu ON cu.id = f.created_by
       ${where}
       ORDER BY f.created_at DESC`,
      params
    );
    if (feedbacks.length === 0) return res.json({ feedbacks: [] });

    const { rows: destinatarios } = await pool.query(
      `SELECT fr.feedback_id, fr.user_id, fr.acknowledged_at, u.name AS user_name, u.avatar_url AS user_avatar_url
       FROM feedback_recipients fr
       JOIN users u ON u.id = fr.user_id
       WHERE fr.feedback_id = ANY($1::int[])`,
      [feedbacks.map((f) => f.id)]
    );
    const porFeedback = {};
    destinatarios.forEach((d) => {
      (porFeedback[d.feedback_id] ||= []).push({
        userId: d.user_id, name: d.user_name, avatarUrl: d.user_avatar_url, acknowledgedAt: d.acknowledged_at,
      });
    });

    res.json({ feedbacks: feedbacks.map((f) => ({ ...f, recipients: porFeedback[f.id] || [] })) });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Erro ao carregar os feedbacks." });
  }
});

// POST /api/feedbacks -> ADM registra um feedback novo, pra uma ou várias pessoas, com anexo opcional
router.post("/", requireAuth, requireAdmin, upload.single("attachment"), async (req, res) => {
  const { title, content } = req.body || {};
  let userIds = [];
  try {
    userIds = JSON.parse(req.body.userIds || "[]");
  } catch {
    return res.status(400).json({ error: "Lista de pessoas inválida." });
  }
  if (!title?.trim() || !content?.trim() || !Array.isArray(userIds) || userIds.length === 0) {
    return res.status(400).json({ error: "Escolha pelo menos uma pessoa e preencha título e conteúdo." });
  }

  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const attachmentUrl = req.file ? `/uploads/${req.file.filename}` : null;
    const attachmentName = req.file ? req.file.originalname : null;

    const { rows } = await client.query(
      `INSERT INTO feedbacks (created_by, title, content, attachment_url, attachment_name)
       VALUES ($1, $2, $3, $4, $5) RETURNING id`,
      [req.user.id, title.trim(), content.trim(), attachmentUrl, attachmentName]
    );
    const feedbackId = rows[0].id;

    for (const userId of userIds) {
      await client.query(
        `INSERT INTO feedback_recipients (feedback_id, user_id) VALUES ($1, $2) ON CONFLICT DO NOTHING`,
        [feedbackId, userId]
      );
    }
    await client.query("COMMIT");

    // Avisa cada pessoa na hora (som + notificação do sistema)
    const io = req.app.get("io");
    userIds.forEach((userId) => {
      io.to(`user-${userId}`).emit("feedback:novo", {
        titulo: "Novo feedback recebido",
        corpo: title.trim(),
      });
    });

    res.status(201).json({ ok: true, feedbackId });
  } catch (err) {
    await client.query("ROLLBACK");
    console.error(err);
    res.status(500).json({ error: "Erro ao registrar o feedback." });
  } finally {
    client.release();
  }
});

module.exports = router;
