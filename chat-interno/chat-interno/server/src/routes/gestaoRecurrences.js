// server/src/routes/gestaoRecurrences.js
// Rotinas (tarefas recorrentes) do Painel Gestão. Isolado do resto do sistema.
// Cada dia que a rotina deve acontecer vira uma tarefa de verdade na tabela "tasks",
// ligada de volta pela coluna recurrence_id — nunca duplica graças ao índice único.

const express = require('express');
const router = express.Router();
const { pool } = require('../db');
const { requireAuth, requireAdmin } = require('../middleware/auth');

router.use(requireAuth, requireAdmin);

const DIAS_A_FRENTE = 14; // até quantos dias no futuro gera ocorrências de uma vez

// -------------------------------------------------------------
// Helpers de data (comparando ano/mês/dia, sem depender de fuso horário)
// -------------------------------------------------------------
function chaveDia(date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}
function somarDias(date, n) {
  const d = new Date(date);
  d.setDate(d.getDate() + n);
  return d;
}

// A rotina "bate" com esse dia?
function diaCombina(recorrencia, date) {
  const diaSemana = date.getDay(); // 0=domingo ... 6=sábado
  switch (recorrencia.recurrence_type) {
    case 'daily':
      return true;
    case 'weekdays':
      return diaSemana >= 1 && diaSemana <= 5;
    case 'specific_days':
      return (recorrencia.days_of_week || []).includes(diaSemana);
    case 'monthly':
      return date.getDate() === recorrencia.day_of_month;
    default:
      return false;
  }
}

/**
 * Gera as ocorrências (tarefas de verdade) dos próximos DIAS_A_FRENTE dias
 * para uma rotina específica. Pode ser chamada quantas vezes for —
 * o índice único em (recurrence_id, occurrence_date) garante que nunca duplica.
 */
async function gerarOcorrenciasDaRotina(recorrencia) {
  const hoje = new Date();
  hoje.setHours(0, 0, 0, 0);
  const inicio = new Date(recorrencia.start_date) > hoje ? new Date(recorrencia.start_date) : hoje;
  const fimJanela = somarDias(hoje, DIAS_A_FRENTE);
  const fimRotina = recorrencia.end_date ? new Date(recorrencia.end_date) : null;

  const assignees = await pool.query(
    'SELECT user_id FROM recurrence_assignees WHERE recurrence_id = $1',
    [recorrencia.id]
  );

  let criadas = 0;
  for (let d = new Date(inicio); d <= fimJanela; d = somarDias(d, 1)) {
    if (fimRotina && d > fimRotina) break;
    if (!diaCombina(recorrencia, d)) continue;

    const horario = recorrencia.start_time || '09:00:00';
    const [hh, mm] = String(horario).split(':');
    const dueDate = new Date(d);
    dueDate.setHours(Number(hh) || 9, Number(mm) || 0, 0, 0);

    const inserted = await pool.query(
      `INSERT INTO tasks (title, description, priority, due_date, created_by, recurrence_id, occurrence_date, progress_type)
       VALUES ($1, $2, $3, $4, $5, $6, $7, 'manual')
       ON CONFLICT (recurrence_id, occurrence_date) WHERE recurrence_id IS NOT NULL DO NOTHING
       RETURNING id`,
      [recorrencia.title, recorrencia.description, recorrencia.priority, dueDate.toISOString(), recorrencia.created_by, recorrencia.id, chaveDia(d)]
    );

    if (inserted.rows[0]) {
      criadas++;
      const taskId = inserted.rows[0].id;
      for (const a of assignees.rows) {
        await pool.query(
          'INSERT INTO task_assignees (task_id, user_id) VALUES ($1, $2) ON CONFLICT DO NOTHING',
          [taskId, a.user_id]
        );
      }
      await pool.query(
        `INSERT INTO task_history (task_id, user_id, action, details) VALUES ($1, $2, 'created', $3)`,
        [taskId, recorrencia.created_by, JSON.stringify({ gerada_pela_rotina: recorrencia.id, dia: chaveDia(d) })]
      );
    }
  }
  return criadas;
}

/** Gera ocorrências de TODAS as rotinas ativas. Chamada pelo servidor sozinho e também sob demanda. */
async function gerarTodasAsOcorrencias() {
  const { rows } = await pool.query('SELECT * FROM task_recurrences WHERE active = TRUE');
  let total = 0;
  for (const r of rows) {
    total += await gerarOcorrenciasDaRotina(r);
  }
  return total;
}

async function hydrateRecurrence(id) {
  const { rows } = await pool.query(
    `SELECT r.*, u.name AS created_by_name FROM task_recurrences r
     JOIN users u ON u.id = r.created_by WHERE r.id = $1`,
    [id]
  );
  const rec = rows[0];
  if (!rec) return null;

  const assignees = await pool.query(
    `SELECT usr.id, usr.name, usr.avatar_url FROM recurrence_assignees ra
     JOIN users usr ON usr.id = ra.user_id WHERE ra.recurrence_id = $1 ORDER BY usr.name`,
    [id]
  );
  const proximas = await pool.query(
    `SELECT id, title, due_date, status FROM tasks
     WHERE recurrence_id = $1 AND occurrence_date >= CURRENT_DATE
     ORDER BY occurrence_date ASC LIMIT 5`,
    [id]
  );

  return { ...rec, assignees: assignees.rows, proximas_ocorrencias: proximas.rows };
}

// -------------------------------------------------------------
// GET /api/gestao/recurrences — lista todas as rotinas
// -------------------------------------------------------------
router.get('/', async (req, res) => {
  try {
    const { rows } = await pool.query('SELECT id FROM task_recurrences ORDER BY created_at DESC');
    const recorrencias = [];
    for (const r of rows) recorrencias.push(await hydrateRecurrence(r.id));
    res.json({ recurrences: recorrencias });
  } catch (err) {
    console.error('Erro ao listar rotinas:', err);
    res.status(500).json({ error: 'Erro ao listar rotinas' });
  }
});

// -------------------------------------------------------------
// POST /api/gestao/recurrences — criar rotina (já gera as ocorrências na hora)
// -------------------------------------------------------------
router.post('/', async (req, res) => {
  try {
    const {
      title, description, priority, recurrence_type,
      days_of_week, day_of_month, start_time, start_date, end_date, assignee_ids,
    } = req.body;

    if (!title || !title.trim()) return res.status(400).json({ error: 'Título é obrigatório' });
    if (!['daily', 'weekdays', 'specific_days', 'monthly'].includes(recurrence_type)) {
      return res.status(400).json({ error: 'Tipo de repetição inválido' });
    }
    if (recurrence_type === 'specific_days' && (!days_of_week || days_of_week.length === 0)) {
      return res.status(400).json({ error: 'Escolha pelo menos um dia da semana' });
    }
    if (recurrence_type === 'monthly' && !day_of_month) {
      return res.status(400).json({ error: 'Escolha o dia do mês' });
    }

    const result = await pool.query(
      `INSERT INTO task_recurrences
        (title, description, priority, recurrence_type, days_of_week, day_of_month, start_time, start_date, end_date, created_by)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10) RETURNING id`,
      [
        title.trim(), description || null, priority || 'medium', recurrence_type,
        recurrence_type === 'specific_days' ? days_of_week : [],
        recurrence_type === 'monthly' ? day_of_month : null,
        start_time || null, start_date || new Date().toISOString().slice(0, 10), end_date || null,
        req.user.id,
      ]
    );
    const recurrenceId = result.rows[0].id;

    if (Array.isArray(assignee_ids)) {
      for (const userId of assignee_ids) {
        await pool.query(
          'INSERT INTO recurrence_assignees (recurrence_id, user_id) VALUES ($1, $2) ON CONFLICT DO NOTHING',
          [recurrenceId, userId]
        );
      }
    }

    const { rows: recRows } = await pool.query('SELECT * FROM task_recurrences WHERE id = $1', [recurrenceId]);
    const criadas = await gerarOcorrenciasDaRotina(recRows[0]);

    const recorrencia = await hydrateRecurrence(recurrenceId);
    res.status(201).json({ recurrence: recorrencia, ocorrencias_criadas: criadas });
  } catch (err) {
    console.error('Erro ao criar rotina:', err);
    res.status(500).json({ error: 'Erro ao criar rotina' });
  }
});

// -------------------------------------------------------------
// PATCH /api/gestao/recurrences/:id — editar (não mexe nas tarefas já geradas)
// -------------------------------------------------------------
router.patch('/:id', async (req, res) => {
  try {
    const id = req.params.id;
    const existing = await pool.query('SELECT * FROM task_recurrences WHERE id = $1', [id]);
    if (!existing.rows[0]) return res.status(404).json({ error: 'Rotina não encontrada' });

    const {
      title, description, priority, recurrence_type,
      days_of_week, day_of_month, start_time, start_date, end_date, active, assignee_ids,
    } = req.body;

    const fields = [];
    const params = [];
    let i = 1;
    const set = (coluna, valor) => { fields.push(`${coluna} = $${i++}`); params.push(valor); };

    if (title !== undefined) set('title', title.trim());
    if (description !== undefined) set('description', description);
    if (priority !== undefined) set('priority', priority);
    if (recurrence_type !== undefined) set('recurrence_type', recurrence_type);
    if (days_of_week !== undefined) set('days_of_week', days_of_week);
    if (day_of_month !== undefined) set('day_of_month', day_of_month);
    if (start_time !== undefined) set('start_time', start_time);
    if (start_date !== undefined) set('start_date', start_date);
    if (end_date !== undefined) set('end_date', end_date);
    if (active !== undefined) set('active', active);

    if (fields.length > 0) {
      fields.push('updated_at = NOW()');
      params.push(id);
      await pool.query(`UPDATE task_recurrences SET ${fields.join(', ')} WHERE id = $${i}`, params);
    }

    if (Array.isArray(assignee_ids)) {
      await pool.query('DELETE FROM recurrence_assignees WHERE recurrence_id = $1', [id]);
      for (const userId of assignee_ids) {
        await pool.query(
          'INSERT INTO recurrence_assignees (recurrence_id, user_id) VALUES ($1, $2) ON CONFLICT DO NOTHING',
          [id, userId]
        );
      }
    }

    // Se continua ativa, aproveita e já gera qualquer ocorrência nova que passou a valer
    const { rows: atualizada } = await pool.query('SELECT * FROM task_recurrences WHERE id = $1', [id]);
    if (atualizada[0].active) await gerarOcorrenciasDaRotina(atualizada[0]);

    const recorrencia = await hydrateRecurrence(id);
    res.json({ recurrence: recorrencia });
  } catch (err) {
    console.error('Erro ao atualizar rotina:', err);
    res.status(500).json({ error: 'Erro ao atualizar rotina' });
  }
});

// -------------------------------------------------------------
// DELETE /api/gestao/recurrences/:id
// As tarefas já geradas continuam existindo normalmente (só perdem o vínculo com a rotina).
// -------------------------------------------------------------
router.delete('/:id', async (req, res) => {
  try {
    const result = await pool.query('DELETE FROM task_recurrences WHERE id = $1 RETURNING id', [req.params.id]);
    if (!result.rows[0]) return res.status(404).json({ error: 'Rotina não encontrada' });
    res.json({ ok: true });
  } catch (err) {
    console.error('Erro ao apagar rotina:', err);
    res.status(500).json({ error: 'Erro ao apagar rotina' });
  }
});

// -------------------------------------------------------------
// POST /api/gestao/recurrences/generate — gera na hora (botão manual na tela)
// -------------------------------------------------------------
router.post('/generate', async (req, res) => {
  try {
    const total = await gerarTodasAsOcorrencias();
    res.json({ ok: true, ocorrencias_criadas: total });
  } catch (err) {
    console.error('Erro ao gerar ocorrências:', err);
    res.status(500).json({ error: 'Erro ao gerar ocorrências' });
  }
});

module.exports = { router, gerarTodasAsOcorrencias };
