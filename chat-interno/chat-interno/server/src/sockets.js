const jwt = require("jsonwebtoken");
const { pool } = require("../src/db");
const { dmId, groupConvId } = require("./utils/permissions");

/**
 * Cada usuário, ao conectar, entra automaticamente nas "salas" (rooms)
 * das conversas que ele tem permissão de ver — calculado no servidor,
 * nunca confiando no que o cliente pede. Isso garante que um operador
 * jamais receba eventos de conversas de outro operador.
 */
function setupSockets(io) {
  io.use(async (socket, next) => {
    try {
      const token = socket.handshake.auth?.token;
      if (!token) return next(new Error("Sem token"));
      const payload = jwt.verify(token, process.env.JWT_SECRET);
      const { rows } = await pool.query(
        "SELECT id, name, username, role, color, active FROM users WHERE id = $1",
        [payload.sub]
      );
      const user = rows[0];
      if (!user || !user.active) return next(new Error("Usuário inválido"));
      socket.user = user;
      next();
    } catch (err) {
      next(new Error("Token inválido"));
    }
  });

  io.on("connection", async (socket) => {
    const user = socket.user;
    socket.join(`user-${user.id}`);

    if (user.role === "admin") {
      const { rows: operators } = await pool.query("SELECT id FROM users WHERE role = 'operator'");
      operators.forEach((op) => socket.join(`conv-${dmId(op.id)}`));
      const { rows: groups } = await pool.query("SELECT id FROM groups");
      groups.forEach((g) => socket.join(`conv-${groupConvId(g.id)}`));
    } else {
      socket.join(`conv-${dmId(user.id)}`);
      const { rows: groups } = await pool.query(
        "SELECT group_id FROM group_members WHERE user_id = $1",
        [user.id]
      );
      groups.forEach((g) => socket.join(`conv-${groupConvId(g.group_id)}`));
    }

    // quando o usuário é adicionado a um grupo novo, ele precisa entrar na sala em tempo real
    socket.on("group:join", async (groupId) => {
      const { rows } = await pool.query(
        "SELECT 1 FROM group_members WHERE group_id = $1 AND user_id = $2",
        [groupId, user.id]
      );
      if (rows.length > 0 || user.role === "admin") {
        socket.join(`conv-${groupConvId(groupId)}`);
      }
    });
  });
}

module.exports = { setupSockets };
