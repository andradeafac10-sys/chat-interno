const jwt = require("jsonwebtoken");
const { pool } = require("../db");

async function requireAuth(req, res, next) {
  try {
    const header = req.headers.authorization || "";
    const token = header.startsWith("Bearer ") ? header.slice(7) : null;
    if (!token) return res.status(401).json({ error: "Não autenticado." });

    const payload = jwt.verify(token, process.env.JWT_SECRET);
    const { rows } = await pool.query(
      "SELECT id, name, username, role, color, active FROM users WHERE id = $1",
      [payload.sub]
    );
    const user = rows[0];
    if (!user || !user.active) return res.status(401).json({ error: "Usuário inválido ou desativado." });

    req.user = user;
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
