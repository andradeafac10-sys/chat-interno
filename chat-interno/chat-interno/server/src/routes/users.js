const express = require("express");
const bcrypt = require("bcryptjs");
const { pool } = require("../db");
const { requireAuth, requireAdmin } = require("../middleware/auth");

const router = express.Router();

// GET /api/users -> lista todos os operadores (usado pelo ADM p/ montar grupos e ver a lista de conversas)
router.get("/", requireAuth, requireAdmin, async (req, res) => {
  const { rows } = await pool.query(
    "SELECT id, name, username, role, color, active FROM users WHERE role = 'operator' ORDER BY name"
  );
  res.json({ users: rows });
});

// POST /api/users -> ADM cria um novo usuário (operador ou outro admin)
router.post("/", requireAuth, requireAdmin, async (req, res) => {
  const { name, username, password, role, color } = req.body || {};
  if (!name || !username || !password || !["admin", "operator"].includes(role)) {
    return res.status(400).json({ error: "Preencha nome, usuário, senha e um cargo válido." });
  }
  const password_hash = await bcrypt.hash(password, 10);
  try {
    const { rows } = await pool.query(
      `INSERT INTO users (name, username, password_hash, role, color)
       VALUES ($1, $2, $3, $4, COALESCE($5, '#2F6FED'))
       RETURNING id, name, username, role, color, active`,
      [name, username.trim().toLowerCase(), password_hash, role, color || null]
    );
    res.status(201).json({ user: rows[0] });
  } catch (err) {
    if (err.code === "23505") return res.status(409).json({ error: "Já existe um usuário com esse username." });
    console.error(err);
    res.status(500).json({ error: "Erro ao criar usuário." });
  }
});

// PATCH /api/users/:id -> ativar/desativar usuário
router.patch("/:id/active", requireAuth, requireAdmin, async (req, res) => {
  const { active } = req.body || {};
  await pool.query("UPDATE users SET active = $1 WHERE id = $2", [!!active, req.params.id]);
  res.json({ ok: true });
});

module.exports = router;
