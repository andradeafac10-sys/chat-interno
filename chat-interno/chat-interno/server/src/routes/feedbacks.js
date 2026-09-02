const express = require("express");
const { pool } = require("../db");
const { requireAuth, requireAdmin } = require("../middleware/auth");

const router = express.Router();

// GET /api/feedbacks/mine -> os feedbacks que EU recebi (qualquer pessoa pode ver os próprios)
router.get("/mine", requireAuth, async (req, res) => {
  try {
    const { rows } = await pool.query(
      `SELECT f.id, f.title, f.content, f.created_at,
              u.name AS created_by_name, u.avatar_url AS created_by_avatar_url
       FROM feedbacks f
       JOIN users u ON u.id = f.created_by
       WHERE f.user_id = $1
       ORDER BY f.created_at DESC`,
      [req.user.id]
    );
    res.json({ feedbacks: rows });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Erro ao carregar seus feedbacks." });
  }
});

// GET /api/feedbacks -> lista geral (só ADM), com filtro opcional por pessoa (?userId=)
router.get("/", requireAuth, requireAdmin, async (req, res) => {
  try {
    const params = [];
    let where = "";
    if (req.query.userId) {
      params.push(req.query.userId);
      where = `WHERE f.user_id = $${params.length}`;
    }
    const { rows } = await pool.query(
      `SELECT f.id, f.title, f.content, f.created_at,
              ru.id AS user_id, ru.name AS user_name, ru.avatar_url AS user_avatar_url,
              cu.name AS created_by_name
       FROM feedbacks f
       JOIN users ru ON ru.id = f.user_id
       JOIN users cu ON cu.id = f.created_by
       ${where}
       ORDER BY f.created_at DESC`,
      params
    );
    res.json({ feedbacks: rows });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Erro ao carregar os feedbacks." });
  }
});

// POST /api/feedbacks -> ADM registra um feedback novo pra alguém
router.post("/", requireAuth, requireAdmin, async (req, res) => {
  const { userId, title, content } = req.body || {};
  if (!userId || !title?.trim() || !content?.trim()) {
    return res.status(400).json({ error: "Escolha a pessoa e preencha título e conteúdo." });
  }
  try {
    const { rows } = await pool.query(
      `INSERT INTO feedbacks (user_id, created_by, title, content) VALUES ($1, $2, $3, $4)
       RETURNING id, title, content, created_at`,
      [userId, req.user.id, title.trim(), content.trim()]
    );
    const feedback = rows[0];

    // Notifica a pessoa na hora (som + notificação do sistema), igual comunicado/tarefa nova.
    const io = req.app.get("io");
    io.to(`user-${userId}`).emit("feedback:novo", {
      titulo: "Novo feedback recebido",
      corpo: title.trim(),
    });

    res.status(201).json({ feedback });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Erro ao registrar o feedback." });
  }
});

module.exports = router;
