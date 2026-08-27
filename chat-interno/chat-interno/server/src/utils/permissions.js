const { pool } = require("../db");

const groupConvId = (groupId) => `group-${groupId}`;

// Conversa privada entre duas pessoas (operador↔ADM ou ADM↔ADM): id sempre
// com o menor id primeiro, pra ficar igual pros dois lados da conversa.
const pairDmId = (idA, idB) => {
  const [a, b] = [Number(idA), Number(idB)].sort((x, y) => x - y);
  return `dm-${a}-${b}`;
};

/**
 * Verifica se um usuário pode ler/escrever em uma determinada conversa.
 * Regras:
 *  - conversa privada (dm-<idA>-<idB>): só as duas pessoas envolvidas acessam,
 *    seja operador↔ADM ou ADM↔ADM. Ninguém mais vê, nem outro ADM.
 *  - grupo: ADM acessa qualquer grupo; operador só os grupos dos quais é membro.
 */
async function canAccessConversation(user, conversationId) {
  if (conversationId.startsWith("dm-")) {
    const [, a, b] = conversationId.split("-");
    return user.id === Number(a) || user.id === Number(b);
  }

  if (conversationId.startsWith("group-")) {
    if (user.role === "admin") return true;
    const groupId = Number(conversationId.replace("group-", ""));
    const { rows } = await pool.query(
      "SELECT 1 FROM group_members WHERE group_id = $1 AND user_id = $2",
      [groupId, user.id]
    );
    return rows.length > 0;
  }

  return false;
}

/**
 * O ADM pode "espiar" (monitorar) uma conversa mesmo sem participar dela?
 * Mesma regra usada na tela de Monitoria: só quando pelo menos uma das duas
 * pessoas é operador — ADM↔ADM nunca é monitorável, fica sempre privado.
 */
async function canMonitorConversation(user, conversationId) {
  if (user.role !== "admin") return false;

  if (conversationId.startsWith("dm-")) {
    const [, a, b] = conversationId.split("-");
    const { rows } = await pool.query(
      "SELECT role FROM users WHERE id = ANY($1::int[])",
      [[Number(a), Number(b)]]
    );
    return rows.some((r) => r.role === "operator");
  }

  if (conversationId.startsWith("group-")) return true;

  return false;
}

module.exports = { canAccessConversation, canMonitorConversation, pairDmId, groupConvId };
