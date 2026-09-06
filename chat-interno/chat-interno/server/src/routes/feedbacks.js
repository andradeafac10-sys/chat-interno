const express = require("express");
const { pool } = require("../db");
const { requireAuth, requireAdmin } = require("../middleware/auth");
const { upload } = require("../middleware/upload");

const router = express.Router();

// GET /api/feedbacks/mine -> os feedbacks que EU recebi, com o meu status de "ciente"
router.get("/mine", requireAuth, async (req, res) => {
  try {
    const { rows } = await pool.query(
      `SELECT f.id, f.title, f.content, f.attachment_url, f.attachment_name, f.created_at,
              fr.acknowledged_at,
              u.name AS created_by_name
       FROM feedback_recipients fr
       JOIN feedbacks f ON f.id = fr.feedback_id
       JOIN users u ON u.id = f.created_by
       WHERE fr.user_id = $1
       ORDER BY (fr.acknowledged_at IS NULL) DESC, f.created_at DESC`,
      [req.user.id]
    );
    res.json({ feedbacks: rows });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Erro ao carregar seus feedbacks." });
  }
});

// GET /api/feedbacks/mine/pending-count -> só o número, pra tarja vermelha no topo
router.get("/mine/pending-count", requireAuth, async (req, res) => {
  try {
    const { rows } = await pool.query(
      `SELECT COUNT(*)::int AS count FROM feedback_recipients WHERE user_id = $1 AND acknowledged_at IS NULL`,
      [req.user.id]
    );
    res.json({ count: rows[0].count });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Erro ao contar feedbacks pendentes." });
  }
});

// POST /api/feedbacks/:id/ack -> "OK, CIENTE" — confirma que li esse feedback
router.post("/:id/ack", requireAuth, async (req, res) => {
  try {
    const { rows } = await pool.query(
      `UPDATE feedback_recipients SET acknowledged_at = now()
       WHERE feedback_id = $1 AND user_id = $2 AND acknowledged_at IS NULL
       RETURNING feedback_id`,
      [req.params.id, req.user.id]
    );
    if (rows.length === 0) return res.status(404).json({ error: "Feedback não encontrado ou já confirmado." });
    res.json({ ok: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Não deu pra confirmar. Tente de novo." });
  }
});

// GET /api/feedbacks -> lista geral (só ADM), cada feedback com todos os destinatários e o status de cada um
router.get("/", requireAuth, requireAdmin, async (req, res) => {
  try {
    const params = [];
    let where = "";
    if (req.query.userId) {
      params.push(req.query.userId);
      where = `WHERE f.id IN (SELECT feedback_id FROM feedback_recipients WHERE user_id = $${params.length})`;
    }
    const { rows: feedbacks } = await pool.query(
      `SELECT f.id, f.title, f.content, f.attachment_url, f.attachment_name, f.created_at,
              cu.name AS created_by_name
       FROM feedbacks f
       JOIN users cu ON cu.id = f.created_by
       ${where}
       ORDER BY f.created_at DESC`,
      params
    );
    if (feedbacks.length === 0) return res.json({ feedbacks: [] });

    const { rows: destinatarios } = await pool.query(
      `SELECT fr.feedback_id, fr.user_id, fr.acknowledged_at, u.name AS user_name, u.avatar_url AS user_avatar_url
       FROM feedback_recipients fr
       JOIN users u ON u.id = fr.user_id
       WHERE fr.feedback_id = ANY($1::int[])`,
      [feedbacks.map((f) => f.id)]
    );
    const porFeedback = {};
    destinatarios.forEach((d) => {
      (porFeedback[d.feedback_id] ||= []).push({
        userId: d.user_id, name: d.user_name, avatarUrl: d.user_avatar_url, acknowledgedAt: d.acknowledged_at,
      });
    });

    res.json({ feedbacks: feedbacks.map((f) => ({ ...f, recipients: porFeedback[f.id] || [] })) });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Erro ao carregar os feedbacks." });
  }
});

// POST /api/feedbacks -> ADM registra um feedback novo, pra uma ou várias pessoas, com anexo opcional
router.post("/", requireAuth, requireAdmin, upload.single("attachment"), async (req, res) => {
  const { title, content } = req.body || {};
  let userIds = [];
  try {
    userIds = JSON.parse(req.body.userIds || "[]");
  } catch {
    return res.status(400).json({ error: "Lista de pessoas inválida." });
  }
  if (!title?.trim() || !content?.trim() || !Array.isArray(userIds) || userIds.length === 0) {
    return res.status(400).json({ error: "Escolha pelo menos uma pessoa e preencha título e conteúdo." });
  }

  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const attachmentUrl = req.file ? `/uploads/${req.file.filename}` : null;
    const attachmentName = req.file ? req.file.originalname : null;

    const { rows } = await client.query(
      `INSERT INTO feedbacks (created_by, title, content, attachment_url, attachment_name)
       VALUES ($1, $2, $3, $4, $5) RETURNING id`,
      [req.user.id, title.trim().toUpperCase(), content.trim(), attachmentUrl, attachmentName]
    );
    const feedbackId = rows[0].id;

    for (const userId of userIds) {
      await client.query(
        `INSERT INTO feedback_recipients (feedback_id, user_id) VALUES ($1, $2) ON CONFLICT DO NOTHING`,
        [feedbackId, userId]
      );
    }
    await client.query("COMMIT");

    // Avisa cada pessoa na hora (som + notificação do sistema)
    const io = req.app.get("io");
    userIds.forEach((userId) => {
      io.to(`user-${userId}`).emit("feedback:novo", {
        titulo: "Novo feedback recebido",
        corpo: title.trim(),
      });
    });

    res.status(201).json({ ok: true, feedbackId });
  } catch (err) {
    await client.query("ROLLBACK");
    console.error(err);
    res.status(500).json({ error: "Erro ao registrar o feedback." });
  } finally {
    client.release();
  }
});

// GET /api/feedbacks/ranking?de=&ate= -> quem mais recebeu feedback no período
// (nota: esse sistema não tem conceito de "supervisor/coordenador/equipe"
// cadastrado ainda, então o filtro disponível por enquanto é só por período)
router.get("/ranking", requireAuth, requireAdmin, async (req, res) => {
  try {
    const params = [];
    let filtroData = "";
    if (req.query.de && req.query.ate) {
      params.push(req.query.de, req.query.ate);
      filtroData = `AND f.created_at::date BETWEEN $1 AND $2`;
    }
    const { rows } = await pool.query(
      `SELECT u.id, u.name, u.avatar_url, u.color, COUNT(fr.feedback_id)::int AS total
       FROM feedback_recipients fr
       JOIN feedbacks f ON f.id = fr.feedback_id
       JOIN users u ON u.id = fr.user_id
       WHERE 1=1 ${filtroData}
       GROUP BY u.id, u.name, u.avatar_url, u.color
       ORDER BY total DESC, u.name`,
      params
    );
    res.json({ ranking: rows });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Erro ao montar o ranking." });
  }
});

// POST /api/feedbacks/agendar-proximo -> agenda o próximo feedback de alguém,
// vinculado ao anterior, e já cria uma tarefa pro responsável (é isso que faz
// aparecer na rotina/tarefas dele)
router.post("/agendar-proximo", requireAuth, requireAdmin, async (req, res) => {
  const { feedbackAnteriorId, colaboradorId, responsavelId, dataPrevista, motivo, observacao } = req.body || {};
  if (!colaboradorId || !responsavelId || !dataPrevista || !motivo?.trim()) {
    return res.status(400).json({ error: "Preencha colaborador, responsável, data e motivo." });
  }
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const { rows: colabRows } = await client.query(`SELECT name FROM users WHERE id = $1`, [colaboradorId]);
    const nomeColaborador = colabRows[0]?.name || "colaborador";

    const { rows: taskRows } = await client.query(
      `INSERT INTO tasks (title, description, priority, due_date, created_by, progress_type)
       VALUES ($1, $2, 'medium', $3, $4, 'manual') RETURNING id`,
      [`Feedback: ${motivo.trim()} — ${nomeColaborador}`, observacao?.trim() || null, dataPrevista, req.user.id]
    );
    const taskId = taskRows[0].id;
    await client.query(`INSERT INTO task_assignees (task_id, user_id) VALUES ($1, $2)`, [taskId, responsavelId]);

    const { rows } = await client.query(
      `INSERT INTO feedback_agendamentos (feedback_anterior_id, colaborador_id, responsavel_id, task_id, data_prevista, motivo, observacao, criado_por)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING id`,
      [feedbackAnteriorId || null, colaboradorId, responsavelId, taskId, dataPrevista, motivo.trim(), observacao?.trim() || null, req.user.id]
    );
    await client.query("COMMIT");

    const io = req.app.get("io");
    io.to(`user-${responsavelId}`).emit("gestao:notify", { titulo: "Nova tarefa de feedback", corpo: `Feedback com ${nomeColaborador}: ${motivo.trim()}` });

    res.status(201).json({ id: rows[0].id });
  } catch (err) {
    await client.query("ROLLBACK");
    console.error(err);
    res.status(500).json({ error: "Erro ao agendar o próximo feedback." });
  } finally {
    client.release();
  }
});

module.exports = router;
