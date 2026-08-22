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

// GET /api/users/manage -> lista TODOS os usuários (admins + operadores) para a tela de gestão de acessos
router.get("/manage", requireAuth, requireAdmin, async (req, res) => {
  const { rows } = await pool.query(
    "SELECT id, name, username, role, color, active, created_at FROM users ORDER BY role DESC, name"
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

// PATCH /api/users/:id -> ADM edita o nome (e opcionalmente usuário/cor) de qualquer pessoa, inclusive a si mesmo
router.patch("/:id", requireAuth, requireAdmin, async (req, res) => {
  const { name, username, color } = req.body || {};
  if (!name || !name.trim()) {
    return res.status(400).json({ error: "O nome não pode ficar vazio." });
  }
  try {
    const { rows } = await pool.query(
      `UPDATE users SET
         name = $1,
         username = COALESCE(NULLIF($2, ''), username),
         color = COALESCE(NULLIF($3, ''), color)
       WHERE id = $4
       RETURNING id, name, username, role, color, active`,
      [name.trim(), username ? username.trim().toLowerCase() : null, color || null, req.params.id]
    );
    if (!rows[0]) return res.status(404).json({ error: "Usuário não encontrado." });
    res.json({ user: rows[0] });
  } catch (err) {
    if (err.code === "23505") return res.status(409).json({ error: "Já existe um usuário com esse username." });
    console.error(err);
    res.status(500).json({ error: "Erro ao atualizar usuário." });
  }
});

// PATCH /api/users/:id/active -> ativar/desativar usuário
router.patch("/:id/active", requireAuth, requireAdmin, async (req, res) => {
  const { active } = req.body || {};
  if (Number(req.params.id) === req.user.id && !active) {
    return res.status(400).json({ error: "Você não pode desativar a si mesmo." });
  }
  await pool.query("UPDATE users SET active = $1 WHERE id = $2", [!!active, req.params.id]);
  res.json({ ok: true });
});

// PATCH /api/users/:id/reset-password -> ADM define uma nova senha para qualquer usuário (não precisa saber a antiga)
router.patch("/:id/reset-password", requireAuth, requireAdmin, async (req, res) => {
  const { newPassword } = req.body || {};
  if (!newPassword || newPassword.length < 6) {
    return res.status(400).json({ error: "A nova senha precisa ter pelo menos 6 caracteres." });
  }
  const password_hash = await bcrypt.hash(newPassword, 10);
  await pool.query("UPDATE users SET password_hash = $1 WHERE id = $2", [password_hash, req.params.id]);
  res.json({ ok: true });
});

module.exports = router;
