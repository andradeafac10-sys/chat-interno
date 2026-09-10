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
      // ADM entra na sala de TODO grupo (inclusive os que não participa) porque
      // precisa conseguir monitorar. Mas isso fazia ele tocar som de mensagem
      // nova de grupo que não é dele — por isso mandamos junto a lista dos
      // grupos em que ele é membro DE VERDADE, e o app só avisa nesses.
      const { rows: groups } = await pool.query("SELECT id FROM groups");
      groups.forEach((g) => socket.join(`conv-${groupConvId(g.id)}`));
      const { rows: meusGrupos } = await pool.query(
        "SELECT group_id FROM group_members WHERE user_id = $1", [user.id]
      );
      socket.emit("grupos:participo", meusGrupos.map((g) => g.group_id));
    } else {
      const { rows: admins } = await pool.query("SELECT id FROM users WHERE role = 'admin'");
      admins.forEach((adm) => socket.join(`conv-${pairDmId(user.id, adm.id)}`));
      // Operador também precisa entrar na sala de conversa com OUTROS operadores,
      // senão mensagem entre dois operadores só aparece depois de dar F5.
      const { rows: otherOperators } = await pool.query(
        "SELECT id FROM users WHERE role = 'operator' AND id != $1", [user.id]
      );
      otherOperators.forEach((op) => socket.join(`conv-${pairDmId(user.id, op.id)}`));
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
      // Se agora ela é membro de verdade, reenvia a lista atualizada pra que o
      // app volte a notificar desse grupo (ex: ADM que acabou de ser adicionado)
      if (rows.length > 0) {
        const { rows: meusGrupos } = await pool.query(
          "SELECT group_id FROM group_members WHERE user_id = $1", [user.id]
        );
        socket.emit("grupos:participo", meusGrupos.map((g) => g.group_id));
      }
    });

    // "Fulano está digitando..." — só repassa pra sala da conversa, sem guardar nada
    socket.on("typing:start", (conversationId) => {
      socket.to(`conv-${conversationId}`).emit("typing:start", { conversationId, userId: user.id, userName: user.name });
    });
    socket.on("typing:stop", (conversationId) => {
      socket.to(`conv-${conversationId}`).emit("typing:stop", { conversationId, userId: user.id });
    });

    // Presença online: avisa todo mundo que essa pessoa ficou online (se for a primeira aba dela)
    const count = (onlineCounts.get(user.id) || 0) + 1;
    onlineCounts.set(user.id, count);
    if (count === 1) io.emit("presence:online", { userId: user.id, userName: user.name });
    socket.emit("presence:list", { userIds: [...onlineCounts.keys()] });

    socket.on("disconnect", () => {
      const c = (onlineCounts.get(user.id) || 1) - 1;
      if (c <= 0) {
        onlineCounts.delete(user.id);
        io.emit("presence:offline", { userId: user.id, userName: user.name });
      } else {
        onlineCounts.set(user.id, c);
      }
    });
  });
}

module.exports = { setupSockets };
