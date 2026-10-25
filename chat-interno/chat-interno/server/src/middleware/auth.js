const jwt = require("jsonwebtoken");
const { pool } = require("../db");

// Marca "visto por último" (no máx. a cada 5 min por pessoa) — base da inativação automática
const ultimaMarca = new Map();
function registrarAtividade(id) {
  const agora = Date.now();
  if (agora - (ultimaMarca.get(id) || 0) < 5 * 60 * 1000) return;
  ultimaMarca.set(id, agora);
  pool.query("UPDATE users SET last_seen_at = now() WHERE id = $1", [id]).catch(() => {});
}

async function requireAuth(req, res, next) {
  try {
    const header = req.headers.authorization || "";
    const token = header.startsWith("Bearer ") ? header.slice(7) : null;
    if (!token) return res.status(401).json({ error: "Não autenticado." });

    const payload = jwt.verify(token, process.env.JWT_SECRET);
    const { rows } = await pool.query(
      "SELECT id, name, username, role, color, avatar_url, active FROM users WHERE id = $1",
      [payload.sub]
    );
    const user = rows[0];
    if (!user || !user.active) return res.status(401).json({ error: "Usuário inválido ou desativado." });

    req.user = user;
    registrarAtividade(user.id);
    next();
  } catch (err) {
    return res.status(401).json({ error: "Token inválido ou expirado." });
  }
}

function requireAdmin(req, res, next) {
  if (req.user?.role !== "admin") {
    return res.status(403).json({ error: "Apenas administradores podem fazer isso." });
  }
  next();
}

module.exports = { requireAuth, requireAdmin };
