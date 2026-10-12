const express = require("express");
const bcrypt = require("bcryptjs");
const { pool } = require("../db");
const { requireAuth } = require("../middleware/auth");

const router = express.Router();

// Coluna criada sozinha no primeiro uso (idempotente) — não precisa rodar seed.
let colunaPronta = null;
function garantirColuna() {
  if (!colunaPronta) {
    colunaPronta = pool
      .query("ALTER TABLE users ADD COLUMN IF NOT EXISTS profile_updated_at TIMESTAMPTZ")
      .catch((err) => { colunaPronta = null; throw err; });
  }
  return colunaPronta;
}

// Último dia 11 (00:00, horário de Brasília) que já passou. Quem não atualizou
// depois dele precisa atualizar agora.
function ultimoDia11() {
  const partes = new Intl.DateTimeFormat("en-CA", { timeZone: "America/Sao_Paulo", year: "numeric", month: "2-digit", day: "2-digit" })
    .format(new Date()).split("-").map(Number);
  let [ano, mes, dia] = partes;
  if (dia < 11) { mes -= 1; if (mes === 0) { mes = 12; ano -= 1; } }
  // 00:00 em Brasília (UTC-3) = 03:00 UTC
  return new Date(Date.UTC(ano, mes - 1, 11, 3, 0, 0));
}

function separarNome(nomeCompleto) {
  const partes = String(nomeCompleto || "").trim().split(/\s+/);
  return { nome: partes[0] || "", sobrenome: partes.slice(1).join(" ") };
}

// GET /api/perfil/status -> { due, nome, sobrenome }
router.get("/status", requireAuth, async (req, res) => {
  try {
    await garantirColuna();
    const { rows } = await pool.query("SELECT name, profile_updated_at FROM users WHERE id = $1", [req.user.id]);
    if (!rows[0]) return res.status(404).json({ error: "Usuário não encontrado." });
    const ultima = rows[0].profile_updated_at ? new Date(rows[0].profile_updated_at) : null;
    const due = !ultima || ultima < ultimoDia11();
    res.json({ due, ...separarNome(rows[0].name) });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Erro ao verificar o cadastro." });
  }
});

// POST /api/perfil/atualizar { nome, sobrenome, newPassword }
router.post("/atualizar", requireAuth, async (req, res) => {
  const nome = String(req.body?.nome || "").trim();
  const sobrenome = String(req.body?.sobrenome || "").trim();
  const newPassword = String(req.body?.newPassword || "");
  if (!nome || !sobrenome) return res.status(400).json({ error: "Preencha nome e sobrenome." });
  if (newPassword.length < 6) return res.status(400).json({ error: "A nova senha precisa ter pelo menos 6 caracteres." });
  try {
    await garantirColuna();
    const { rows } = await pool.query("SELECT password_hash FROM users WHERE id = $1", [req.user.id]);
    if (!rows[0]) return res.status(404).json({ error: "Usuário não encontrado." });
    if (await bcrypt.compare(newPassword, rows[0].password_hash)) {
      return res.status(400).json({ error: "Escolha uma senha diferente da atual." });
    }
    const hash = await bcrypt.hash(newPassword, 10);
    const { rows: atualizado } = await pool.query(
      "UPDATE users SET name = $1, password_hash = $2, profile_updated_at = now() WHERE id = $3 RETURNING id, name, username, role, color, avatar_url",
      [`${nome} ${sobrenome}`, hash, req.user.id]
    );
    res.json({ user: atualizado[0] });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Erro ao salvar os dados." });
  }
});

module.exports = router;
