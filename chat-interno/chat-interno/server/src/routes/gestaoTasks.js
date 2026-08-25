// server/src/routes/gestaoTasks.js
// Rotas do Painel Gestão > Tarefas. Isolado do resto do sistema.
// Tudo aqui exige login + ser ADM (igual ao restante do painel de Gestão).

const express = require('express');
const router = express.Router();
const db = require('../db');
const { requireAuth, requireAdmin } = require('../middleware/auth');

router.use(requireAuth, requireAdmin);

// -------------------------------------------------------------
// Helpers
// -------------------------------------------------------------

async function recordHistory(taskId, userId, action, details = null) {
  await db.query(
    `INSERT INTO task_history (task_id, user_id, action, details)
     VALUES ($1, $2, $3, $4)`,
    [taskId, userId, action, details ? JSON.stringify(details) : null]
  );
}

async function recalcProgress(taskId) {
  const task = await db.query(`SELECT progress_type FROM tasks WHERE id = $1`, [taskId]);
  if (!task.rows[0] || task.rows[0].progress_type !== 'checklist') return;

  const items = await db.query(
    `SELECT is_done FROM task_checklist_items WHERE task_id = $1`,
    [taskId]
  );
  if (items.rows.length === 0) return;

  const done = items.rows.filter((i) => i.is_done).length;
  const percent = Math.round((done / items.rows.length) * 100);

  await db.query(
    `UPDATE tasks SET progress_percent = $1, updated_at = NOW() WHERE id = $2`,
    [percent, taskId]
  );
}

async function hydrateTask(taskId) {
  const taskRes = await db.query(
    `SELECT t.*, u.name AS created_by_name
     FROM tasks t
     JOIN users u ON u.id = t.created_by
     WHERE t.id = $1`,
    [taskId]
  );
  const task = taskRes.rows[0];
  if (!task) return null;

  const assignees = await db.query(
    `SELECT u.id, u.name, u.avatar_url
     FROM task_assignees ta
     JOIN users u ON u.id = ta.user_id
     WHERE ta.task_id = $1
     ORDER BY u.name`,
    [taskId]
  );

  const checklist = await db.query(
    `SELECT * FROM task_checklist_items WHERE task_id = $1 ORDER BY position, id`,
    [taskId]
  );

  const isOverdue =
    task.status !== 'done' &&
    task.status !== 'canceled' &&
    task.due_date &&
    new Date(task.due_date) < new Date();

  return {
    ...task,
    assignees: assignees.rows,
    checklist: checklist.rows,
    is_overdue: isOverdue,
  };
}

// -------------------------------------------------------------
// GET /api/gestao/tasks/meta/assignees — lista de ADMs pra atribuir tarefas
// -------------------------------------------------------------
router.get('/meta/assignees', async (req, res) => {
  try {
    const result = await db.query(
      `SELECT id, name, avatar_url FROM users WHERE role = 'admin' AND active = TRUE ORDER BY name`
    );
    res.json({ users: result.rows });
  } catch (err) {
    console.error('Erro ao listar responsáveis:', err);
    res.status(500).json({ error: 'Erro ao listar responsáveis' });
  }
});

// -------------------------------------------------------------
// GET /api/gestao/tasks — lista com filtros
// query: status, assignee_id, overdue=1, priority
// -------------------------------------------------------------
router.get('/', async (req, res) => {
  try {
    const { status, assignee_id, overdue, priority } = req.query;
    const conditions = [];
    const params = [];

    if (status) {
      params.push(status);
      conditions.push(`t.status = $${params.length}`);
    }
    if (priority) {
      params.push(priority);
      conditions.push(`t.priority = $${params.length}`);
    }
    if (assignee_id) {
      params.push(assignee_id);
      conditions.push(
        `EXISTS (SELECT 1 FROM task_assignees ta WHERE ta.task_id = t.id AND ta.user_id = $${params.length})`
      );
    }
    if (overdue === '1') {
      conditions.push(
        `t.status NOT IN ('done','canceled') AND t.due_date IS NOT NULL AND t.due_date < NOW()`
      );
    }

    const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';

    const result = await db.query(
      `SELECT t.*, u.name AS created_by_name,
              COALESCE(
                (SELECT json_agg(json_build_object('id', au.id, 'name', au.name, 'avatar_url', au.avatar_url))
                 FROM task_assignees ta2 JOIN users au ON au.id = ta2.user_id
                 WHERE ta2.task_id = t.id),
                '[]'
              ) AS assignees
       FROM tasks t
       JOIN users u ON u.id = t.created_by
       ${where}
       ORDER BY
         CASE WHEN t.status NOT IN ('done','canceled') AND t.due_date IS NOT NULL AND t.due_date < NOW() THEN 0 ELSE 1 END,
         t.due_date ASC NULLS LAST,
         t.created_at DESC`,
      params
    );

    const tasks = result.rows.map((t) => ({
      ...t,
      is_overdue:
        t.status !== 'done' &&
        t.status !== 'canceled' &&
        t.due_date &&
        new Date(t.due_date) < new Date(),
    }));

    res.json({ tasks });
  } catch (err) {
    console.error('Erro ao listar tarefas:', err);
    res.status(500).json({ error: 'Erro ao listar tarefas' });
  }
});

// -------------------------------------------------------------
// GET /api/gestao/tasks/overview — números do dashboard
// -------------------------------------------------------------
router.get('/overview', async (req, res) => {
  try {
    const totals = await db.query(`
      SELECT
        COUNT(*) FILTER (WHERE status = 'pending') AS pending,
        COUNT(*) FILTER (WHERE status = 'in_progress') AS in_progress,
        COUNT(*) FILTER (WHERE status = 'done') AS done,
        COUNT(*) FILTER (WHERE status NOT IN ('done','canceled') AND due_date IS NOT NULL AND due_date < NOW()) AS overdue,
        COUNT(*) AS total
      FROM tasks
    `);

    const byAssignee = await db.query(`
      SELECT u.id, u.name,
             COUNT(t.id) FILTER (WHERE t.status <> 'canceled') AS total,
             COUNT(t.id) FILTER (WHERE t.status = 'done') AS done,
             COUNT(t.id) FILTER (WHERE t.status NOT IN ('done','canceled') AND t.due_date IS NOT NULL AND t.due_date < NOW()) AS overdue
      FROM users u
      LEFT JOIN task_assignees ta ON ta.user_id = u.id
      LEFT JOIN tasks t ON t.id = ta.task_id
      WHERE u.role = 'admin' AND u.active = TRUE
      GROUP BY u.id, u.name
      ORDER BY u.name
    `);

    res.json({ totals: totals.rows[0], by_assignee: byAssignee.rows });
  } catch (err) {
    console.error('Erro ao carregar visão geral:', err);
    res.status(500).json({ error: 'Erro ao carregar visão geral' });
  }
});

// -------------------------------------------------------------
// GET /api/gestao/tasks/:id — detalhe completo
// -------------------------------------------------------------
router.get('/:id', async (req, res) => {
  try {
    const task = await hydrateTask(req.params.id);
    if (!task) return res.status(404).json({ error: 'Tarefa não encontrada' });

    const comments = await db.query(
      `SELECT c.*, u.name AS user_name, u.avatar_url
       FROM task_comments c JOIN users u ON u.id = c.user_id
       WHERE c.task_id = $1 ORDER BY c.created_at ASC`,
      [req.params.id]
    );

    const history = await db.query(
      `SELECT h.*, u.name AS user_name
       FROM task_history h JOIN users u ON u.id = h.user_id
       WHERE h.task_id = $1 ORDER BY h.created_at DESC`,
      [req.params.id]
    );

    res.json({ task, comments: comments.rows, history: history.rows });
  } catch (err) {
    console.error('Erro ao carregar tarefa:', err);
    res.status(500).json({ error: 'Erro ao carregar tarefa' });
  }
});

// -------------------------------------------------------------
// POST /api/gestao/tasks — criar
// body: { title, description, priority, due_date, assignee_ids: [], checklist_items: [] }
// -------------------------------------------------------------
router.post('/', async (req, res) => {
  try {
    const { title, description, priority, due_date, assignee_ids, checklist_items } = req.body;
    if (!title || !title.trim()) {
      return res.status(400).json({ error: 'Título é obrigatório' });
    }

    const progressType = checklist_items && checklist_items.length > 0 ? 'checklist' : 'manual';

    const result = await db.query(
      `INSERT INTO tasks (title, description, priority, due_date, created_by, progress_type)
       VALUES ($1, $2, $3, $4, $5, $6) RETURNING id`,
      [title.trim(), description || null, priority || 'medium', due_date || null, req.user.id, progressType]
    );
    const taskId = result.rows[0].id;

    if (Array.isArray(assignee_ids)) {
      for (const userId of assignee_ids) {
        await db.query(
          `INSERT INTO task_assignees (task_id, user_id) VALUES ($1, $2) ON CONFLICT DO NOTHING`,
          [taskId, userId]
        );
      }
    }

    if (Array.isArray(checklist_items)) {
      let position = 0;
      for (const itemTitle of checklist_items) {
        if (!itemTitle || !itemTitle.trim()) continue;
        await db.query(
          `INSERT INTO task_checklist_items (task_id, title, position) VALUES ($1, $2, $3)`,
          [taskId, itemTitle.trim(), position++]
        );
      }
    }

    await recordHistory(taskId, req.user.id, 'created', { title: title.trim() });

    const task = await hydrateTask(taskId);
    res.status(201).json({ task });
  } catch (err) {
    console.error('Erro ao criar tarefa:', err);
    res.status(500).json({ error: 'Erro ao criar tarefa' });
  }
});

// -------------------------------------------------------------
// PUT /api/gestao/tasks/:id — atualizar
// body: qualquer combinação de: title, description, status, priority, due_date, assignee_ids, progress_percent
// -------------------------------------------------------------
router.put('/:id', async (req, res) => {
  try {
    const taskId = req.params.id;
    const existing = await db.query(`SELECT * FROM tasks WHERE id = $1`, [taskId]);
    if (!existing.rows[0]) return res.status(404).json({ error: 'Tarefa não encontrada' });
    const before = existing.rows[0];

    const { title, description, status, priority, due_date, assignee_ids, progress_percent } = req.body;

    const fields = [];
    const params = [];
    let i = 1;

    if (title !== undefined) { fields.push(`title = $${i++}`); params.push(title); }
    if (description !== undefined) { fields.push(`description = $${i++}`); params.push(description); }
    if (priority !== undefined) { fields.push(`priority = $${i++}`); params.push(priority); }
    if (due_date !== undefined) { fields.push(`due_date = $${i++}`); params.push(due_date); }
    if (status !== undefined) {
      fields.push(`status = $${i++}`);
      params.push(status);
      if (status === 'done') fields.push(`completed_at = NOW()`);
    }
    if (progress_percent !== undefined && before.progress_type === 'manual') {
      fields.push(`progress_percent = $${i++}`);
      params.push(Math.max(0, Math.min(100, progress_percent)));
    }

    if (fields.length > 0) {
      fields.push(`updated_at = NOW()`);
      params.push(taskId);
      await db.query(`UPDATE tasks SET ${fields.join(', ')} WHERE id = $${i}`, params);
    }

    if (Array.isArray(assignee_ids)) {
      await db.query(`DELETE FROM task_assignees WHERE task_id = $1`, [taskId]);
      for (const userId of assignee_ids) {
        await db.query(
          `INSERT INTO task_assignees (task_id, user_id) VALUES ($1, $2) ON CONFLICT DO NOTHING`,
          [taskId, userId]
        );
      }
      await recordHistory(taskId, req.user.id, 'assignee_added', { assignee_ids });
    }

    if (status !== undefined && status !== before.status) {
      await recordHistory(taskId, req.user.id, 'status_changed', { from: before.status, to: status });
    }
    if (priority !== undefined && priority !== before.priority) {
      await recordHistory(taskId, req.user.id, 'priority_changed', { from: before.priority, to: priority });
    }
    if (due_date !== undefined && due_date !== before.due_date) {
      await recordHistory(taskId, req.user.id, 'due_date_changed', { from: before.due_date, to: due_date });
    }

    const task = await hydrateTask(taskId);
    res.json({ task });
  } catch (err) {
    console.error('Erro ao atualizar tarefa:', err);
    res.status(500).json({ error: 'Erro ao atualizar tarefa' });
  }
});

// -------------------------------------------------------------
// DELETE /api/gestao/tasks/:id
// -------------------------------------------------------------
router.delete('/:id', async (req, res) => {
  try {
    const result = await db.query(`DELETE FROM tasks WHERE id = $1 RETURNING id`, [req.params.id]);
    if (!result.rows[0]) return res.status(404).json({ error: 'Tarefa não encontrada' });
    res.json({ ok: true });
  } catch (err) {
    console.error('Erro ao apagar tarefa:', err);
    res.status(500).json({ error: 'Erro ao apagar tarefa' });
  }
});

// -------------------------------------------------------------
// Checklist
// -------------------------------------------------------------
router.post('/:id/checklist', async (req, res) => {
  try {
    const { title } = req.body;
    if (!title || !title.trim()) return res.status(400).json({ error: 'Título é obrigatório' });

    await db.query(`UPDATE tasks SET progress_type = 'checklist' WHERE id = $1 AND progress_type = 'manual'`, [req.params.id]);

    const posRes = await db.query(
      `SELECT COALESCE(MAX(position), -1) + 1 AS next FROM task_checklist_items WHERE task_id = $1`,
      [req.params.id]
    );

    const result = await db.query(
      `INSERT INTO task_checklist_items (task_id, title, position) VALUES ($1, $2, $3) RETURNING *`,
      [req.params.id, title.trim(), posRes.rows[0].next]
    );

    await recalcProgress(req.params.id);
    res.status(201).json({ item: result.rows[0] });
  } catch (err) {
    console.error('Erro ao adicionar item:', err);
    res.status(500).json({ error: 'Erro ao adicionar item' });
  }
});

router.put('/:id/checklist/:itemId', async (req, res) => {
  try {
    const { is_done } = req.body;
    const result = await db.query(
      `UPDATE task_checklist_items SET is_done = $1 WHERE id = $2 AND task_id = $3 RETURNING *`,
      [is_done, req.params.itemId, req.params.id]
    );
    if (!result.rows[0]) return res.status(404).json({ error: 'Item não encontrado' });

    await recalcProgress(req.params.id);
    await recordHistory(req.params.id, req.user.id, is_done ? 'checklist_item_done' : 'checklist_item_undone', {
      item: result.rows[0].title,
    });

    res.json({ item: result.rows[0] });
  } catch (err) {
    console.error('Erro ao atualizar item:', err);
    res.status(500).json({ error: 'Erro ao atualizar item' });
  }
});

router.delete('/:id/checklist/:itemId', async (req, res) => {
  try {
    await db.query(`DELETE FROM task_checklist_items WHERE id = $1 AND task_id = $2`, [req.params.itemId, req.params.id]);
    await recalcProgress(req.params.id);
    res.json({ ok: true });
  } catch (err) {
    console.error('Erro ao remover item:', err);
    res.status(500).json({ error: 'Erro ao remover item' });
  }
});

// -------------------------------------------------------------
// Comentários
// -------------------------------------------------------------
router.post('/:id/comments', async (req, res) => {
  try {
    const { content } = req.body;
    if (!content || !content.trim()) return res.status(400).json({ error: 'Comentário vazio' });

    const result = await db.query(
      `INSERT INTO task_comments (task_id, user_id, content) VALUES ($1, $2, $3) RETURNING *`,
      [req.params.id, req.user.id, content.trim()]
    );

    await recordHistory(req.params.id, req.user.id, 'comment_added', null);

    res.status(201).json({ comment: { ...result.rows[0], user_name: req.user.name, avatar_url: req.user.avatar_url } });
  } catch (err) {
    console.error('Erro ao comentar:', err);
    res.status(500).json({ error: 'Erro ao comentar' });
  }
});

module.exports = router;
