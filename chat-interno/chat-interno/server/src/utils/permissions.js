const { pool } = require("../db");

const dmId = (operatorId) => `dm-${operatorId}`;
const groupConvId = (groupId) => `group-${groupId}`;

/**
 * Verifica se um usuário pode ler/escrever em uma determinada conversa.
 * Regras:
 *  - admin: acessa qualquer conversa privada (dm-*) e qualquer grupo.
 *  - operator: acessa APENAS a própria conversa privada (dm-<seu id>)
 *              e grupos dos quais é membro. Nunca acessa a conversa
 *              privada de outro operador nem grupos que não integra.
 */
async function canAccessConversation(user, conversationId) {
  if (user.role === "admin") return true;

  if (conversationId.startsWith("dm-")) {
    return conversationId === dmId(user.id);
  }

  if (conversationId.startsWith("group-")) {
    const groupId = Number(conversationId.replace("group-", ""));
    const { rows } = await pool.query(
      "SELECT 1 FROM group_members WHERE group_id = $1 AND user_id = $2",
      [groupId, user.id]
    );
    return rows.length > 0;
  }

  return false;
}

module.exports = { canAccessConversation, dmId, groupConvId };
