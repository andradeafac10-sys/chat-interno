const jwt = require("jsonwebtoken");
const { pool } = require("../src/db");
const { pairDmId, groupConvId } = require("./utils/permissions");

/**
 * Cada usuário, ao conectar, entra automaticamente nas "salas" (rooms)
 * das conversas que ele tem permissão de ver — calculado no servidor,
 * nunca confiando no que o cliente pede. Isso garante que um operador
 * jamais receba eventos de conversas de outro operador.
 */
/**
 * Controla quem está online agora. Guarda quantas abas/conexões cada
 * pessoa tem abertas — só avisa "ficou online" na primeira conexão e
 * "ficou offline" quando a última fecha.
 */
const onlineCounts = new Map();

function setupSockets(io) {
  io.use(async (socket, next) => {
    try {
      const token = socket.handshake.auth?.token;
      if (!token) return next(new Error("Sem token"));
      const payload = jwt.verify(token, process.env.JWT_SECRET);
      const { rows } = await pool.query(
        "SELECT id, name, username, role, color, active, avatar_url FROM users WHERE id = $1",
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
      operators.forEach((op) => socket.join(`conv-${pairDmId(user.id, op.id)}`));
      const { rows: otherAdmins } = await pool.query("SELECT id FROM users WHERE role = 'admin' AND id != $1", [user.id]);
      otherAdmins.forEach((adm) => socket.join(`conv-${pairDmId(user.id, adm.id)}`));
      const { rows: groups } = await pool.query("SELECT id FROM groups");
      groups.forEach((g) => socket.join(`conv-${groupConvId(g.id)}`));
    } else {
      const { rows: admins } = await pool.query("SELECT id FROM users WHERE role = 'admin'");
      admins.forEach((adm) => socket.join(`conv-${pairDmId(user.id, adm.id)}`));
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

    // Presença online: avisa todo mundo que essa pessoa ficou online (se for a primeira aba dela)
    const count = (onlineCounts.get(user.id) || 0) + 1;
    onlineCounts.set(user.id, count);
    if (count === 1) io.emit("presence:online", { userId: user.id });
    socket.emit("presence:list", { userIds: [...onlineCounts.keys()] });

    socket.on("disconnect", () => {
      const c = (onlineCounts.get(user.id) || 1) - 1;
      if (c <= 0) {
        onlineCounts.delete(user.id);
        io.emit("presence:offline", { userId: user.id });
      } else {
        onlineCounts.set(user.id, c);
      }
    });
  });
}

module.exports = { setupSockets };
