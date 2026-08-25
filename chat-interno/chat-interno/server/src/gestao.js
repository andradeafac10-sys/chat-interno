const express = require("express");
const { requireAuth, requireAdmin } = require("../middleware/auth");

const router = express.Router();

/**
 * Rotas do Painel Gestão Nacional — arquivo isolado do resto do sistema.
 * Toda rota daqui exige requireAdmin (mesma trava usada em Usuários/Monitoria),
 * então nenhuma delas pode ser acessada por operador, nem burlando o front-end.
 *
 * Etapa 1: só confirma que o acesso está de pé. As rotas de tarefas,
 * equipe, ranking etc. entram nas próximas etapas.
 */

// GET /api/gestao/ping -> usado só pra confirmar que a proteção ADM está funcionando
router.get("/ping", requireAuth, requireAdmin, (req, res) => {
  res.json({ ok: true, message: `Acesso liberado para ${req.user.name}.` });
});

module.exports = router;
