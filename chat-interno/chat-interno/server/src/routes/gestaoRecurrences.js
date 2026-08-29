// server/src/routes/gestaoRecurrences.js
// Rotinas do Painel Gestão — cadastro geral (a "receita") + lista de afazeres
// diária por pessoa (feito/não feito), isolado do resto do sistema.

const express = require('express');
const router = express.Router();
const { pool } = require('../db');
const { requireAuth, requireAdmin } = require('../middleware/auth');
const { upload } = require('../middleware/upload');

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
  const diaSemana = date.getDay();
  switch (recorrencia.recurrence_type) {
    case 'daily': return true;
    case 'weekdays': return diaSemana >= 1 && diaSemana <= 5;
    case 'specific_days': return (recorrencia.days_of_week || []).includes(diaSemana);
    case 'monthly': return date.getDate() === recorrencia.day_of_month;
    default: return false;
  }
}

/**
 * Gera as linhas de "a fazer" (routine_completions) dos próximos dias, uma por
 * responsável, pra cada dia que a rotina deveria acontecer. Pode rodar quantas
 * vezes for — o índice único (recurrence_id, user_id, occurrence_date) impede duplicar.
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
  if (assignees.rows.length === 0) return 0;

  let criadas = 0;
  for (let d = new Date(inicio); d <= fimJanela; d = somarDias(d, 1)) {
    if (fimRotina && d > fimRotina) break;
    if (!diaCombina(recorrencia, d)) continue;

    for (const a of assignees.rows) {
      const resultado = await pool.query(
        `INSERT INTO routine_completions (recurrence_id, user_id, occurrence_date)
         VALUES ($1, $2, $3)
         ON CONFLICT (recurrence_id, user_id, occurrence_date) DO NOTHING
         RETURNING id`,
        [recorrencia.id, a.user_id, chaveDia(d)]
      );
      if (resultado.rows[0]) criadas++;
    }
  }
  return criadas;
}

async function gerarTodasAsOcorrencias() {
  const { rows } = await pool.query('SELECT * FROM task_recurrences WHERE active = TRUE');
  let total = 0;
  for (const r of rows) total += await gerarOcorrenciasDaRotina(r);
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
  return { ...rec, assignees: assignees.rows };
}

// -------------------------------------------------------------
// GET /api/gestao/recurrences — cadastro geral de rotinas (visível a qualquer ADM)
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
// POST /api/gestao/recurrences — criar rotina (já gera as próximas ocorrências)
// -------------------------------------------------------------
router.post('/', async (req, res) => {
  try {
    const { title, description, priority, recurrence_type, days_of_week, day_of_month, start_time, start_date, end_date, assignee_ids } = req.body;

    if (!title || !title.trim()) return res.status(400).json({ error: 'Título é obrigatório' });
    if (!['low', 'medium', 'high'].includes(priority)) {
      return res.status(400).json({ error: 'Prioridade inválida' });
    }
    if (!['daily', 'weekdays', 'specific_days', 'monthly'].includes(recurrence_type)) {
      return res.status(400).json({ error: 'Tipo de repetição inválido' });
    }
    if (recurrence_type === 'specific_days' && (!days_of_week || days_of_week.length === 0)) {
      return res.status(400).json({ error: 'Escolha pelo menos um dia da semana' });
    }
    if (recurrence_type === 'monthly' && !day_of_month) {
      return res.status(400).json({ error: 'Escolha o dia do mês' });
    }
    if (!Array.isArray(assignee_ids) || assignee_ids.length === 0) {
      return res.status(400).json({ error: 'Escolha ao menos um responsável' });
    }

    const result = await pool.query(
      `INSERT INTO task_recurrences
        (title, description, priority, recurrence_type, days_of_week, day_of_month, start_time, start_date, end_date, created_by)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10) RETURNING id`,
      [
        title.trim(), description || null, priority, recurrence_type,
        recurrence_type === 'specific_days' ? days_of_week : [],
        recurrence_type === 'monthly' ? day_of_month : null,
        start_time || null, start_date || new Date().toISOString().slice(0, 10), end_date || null,
        req.user.id,
      ]
    );
    const recurrenceId = result.rows[0].id;

    for (const userId of assignee_ids) {
      await pool.query(
        'INSERT INTO recurrence_assignees (recurrence_id, user_id) VALUES ($1, $2) ON CONFLICT DO NOTHING',
        [recurrenceId, userId]
      );
    }

    const io = req.app.get('io');
    if (io) {
      assignee_ids
        .filter((uid) => uid !== req.user.id)
        .forEach((uid) => {
          io.to(`user-${uid}`).emit('gestao:notify', {
            titulo: 'Nova rotina',
            corpo: `${req.user.name} te colocou em: ${title.trim()}`,
          });
        });
    }
    const { rows: recRows } = await pool.query('SELECT * FROM task_recurrences WHERE id = $1', [recurrenceId]);
    const criadas = await gerarOcorrenciasDaRotina(recRows[0]);

    res.status(201).json({ recurrence: await hydrateRecurrence(recurrenceId), ocorrencias_criadas: criadas });
  } catch (err) {
    console.error('Erro ao criar rotina:', err);
    res.status(500).json({ error: 'Erro ao criar rotina' });
  }
});

// -------------------------------------------------------------
// PATCH /api/gestao/recurrences/:id — editar / pausar / reativar
// -------------------------------------------------------------
router.patch('/:id', async (req, res) => {
  try {
    const id = req.params.id;
    const existing = await pool.query('SELECT * FROM task_recurrences WHERE id = $1', [id]);
    if (!existing.rows[0]) return res.status(404).json({ error: 'Rotina não encontrada' });

    const { title, description, priority, recurrence_type, days_of_week, day_of_month, start_time, start_date, end_date, active, assignee_ids } = req.body;

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

    const { rows: atualizada } = await pool.query('SELECT * FROM task_recurrences WHERE id = $1', [id]);
    if (atualizada[0].active) await gerarOcorrenciasDaRotina(atualizada[0]);

    res.json({ recurrence: await hydrateRecurrence(id) });
  } catch (err) {
    console.error('Erro ao atualizar rotina:', err);
    res.status(500).json({ error: 'Erro ao atualizar rotina' });
  }
});

// -------------------------------------------------------------
// DELETE /api/gestao/recurrences/:id
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
// POST /api/gestao/recurrences/generate — gera na hora (botão manual)
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

// -------------------------------------------------------------
// GET /api/gestao/recurrences/minhas — "Minha Rotina": só as MINHAS ocorrências,
// de hoje (e um resumo dos últimos dias) — nunca as de outra pessoa.
// -------------------------------------------------------------
router.get('/minhas', async (req, res) => {
  try {
    const hoje = chaveDia(new Date());
    const { rows } = await pool.query(
      `SELECT rc.id, rc.occurrence_date, rc.done, rc.done_at, rc.nota, rc.anexo_url, rc.anexo_nome,
              r.id AS recurrence_id, r.title, r.description, r.start_time, r.priority
       FROM routine_completions rc
       JOIN task_recurrences r ON r.id = rc.recurrence_id
       WHERE rc.user_id = $1 AND rc.occurrence_date = $2
       ORDER BY CASE r.priority WHEN 'high' THEN 0 WHEN 'medium' THEN 1 ELSE 2 END, r.start_time NULLS LAST, r.title`,
      [req.user.id, hoje]
    );

    // Resumo dos últimos 7 dias (pra pessoa ver como andou a semana)
    const { rows: semana } = await pool.query(
      `SELECT occurrence_date, COUNT(*)::int AS total, COUNT(*) FILTER (WHERE done)::int AS feitas
       FROM routine_completions
       WHERE user_id = $1 AND occurrence_date BETWEEN $2 AND $3
       GROUP BY occurrence_date ORDER BY occurrence_date`,
      [req.user.id, chaveDia(somarDias(new Date(), -6)), hoje]
    );

    res.json({ hoje: rows, resumoSemana: semana });
  } catch (err) {
    console.error('Erro ao buscar minhas rotinas:', err);
    res.status(500).json({ error: 'Erro ao buscar suas rotinas' });
  }
});

// -------------------------------------------------------------
// PATCH /api/gestao/recurrences/completions/:id — marcar feito / não feito
// (só a própria pessoa marca a própria rotina)
// -------------------------------------------------------------
// POST /completions/upload -> sobe um arquivo pra anexar numa rotina do dia
router.post('/completions/upload', upload.single('file'), async (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'Nenhum arquivo enviado' });
  res.json({ url: `/uploads/${req.file.filename}`, name: req.file.originalname });
});

router.patch('/completions/:id', async (req, res) => {
  try {
    const { done, nota, anexo_url, anexo_nome } = req.body;
    const campos = ['done = $1', 'done_at = $2'];
    const valores = [!!done, done ? new Date() : null];
    let i = 3;
    if (nota !== undefined) { campos.push(`nota = $${i++}`); valores.push(nota || null); }
    if (anexo_url !== undefined) { campos.push(`anexo_url = $${i++}`); valores.push(anexo_url || null); }
    if (anexo_nome !== undefined) { campos.push(`anexo_nome = $${i++}`); valores.push(anexo_nome || null); }
    valores.push(req.params.id, req.user.id);
    const { rows } = await pool.query(
      `UPDATE routine_completions SET ${campos.join(', ')}
       WHERE id = $${i++} AND user_id = $${i} RETURNING *`,
      valores
    );
    if (!rows[0]) return res.status(404).json({ error: 'Rotina não encontrada ou não é sua.' });

    // Quando marca como FEITA, avisa todo mundo — igual uma notificação de mensagem
    if (done) {
      const io = req.app.get('io');
      if (io) {
        const { rows: infoRotina } = await pool.query(
          `SELECT r.title FROM task_recurrences r WHERE r.id = (
             SELECT recurrence_id FROM routine_completions WHERE id = $1
           )`,
          [req.params.id]
        );
        io.emit('gestao:notify', {
          titulo: 'Rotina concluída',
          corpo: `${req.user.name} concluiu: ${infoRotina[0]?.title || 'uma rotina'}`,
        });
      }
    }

    res.json({ completion: rows[0] });
  } catch (err) {
    console.error('Erro ao marcar rotina:', err);
    res.status(500).json({ error: 'Erro ao marcar rotina' });
  }
});

// -------------------------------------------------------------
// GET /api/gestao/recurrences/ranking?periodo=day|week|month — ranking de
// cumprimento das rotinas (feitas ÷ previstas, contando não marcadas como
// "não feita" assim que o dia já passou).
// -------------------------------------------------------------
router.get('/ranking/dados', async (req, res) => {
  try {
    const periodo = ['day', 'week', 'month'].includes(req.query.periodo) ? req.query.periodo : 'week';
    const hoje = new Date();
    let dataInicio;
    if (periodo === 'day') dataInicio = chaveDia(hoje);
    else if (periodo === 'week') dataInicio = chaveDia(somarDias(hoje, -6));
    else dataInicio = chaveDia(somarDias(hoje, -29));

    // Só considera dias que já passaram (ou hoje) — não faz sentido cobrar rotina do futuro
    const { rows } = await pool.query(
      `SELECT u.id, u.name, u.avatar_url, u.color,
              COUNT(rc.*)::int AS total,
              COUNT(*) FILTER (WHERE rc.done)::int AS feitas
       FROM routine_completions rc
       JOIN users u ON u.id = rc.user_id
       WHERE rc.occurrence_date >= $1 AND rc.occurrence_date <= $2
       GROUP BY u.id
       ORDER BY (COUNT(*) FILTER (WHERE rc.done))::float / GREATEST(COUNT(rc.*), 1) DESC, feitas DESC`,
      [dataInicio, chaveDia(hoje)]
    );

    const ranking = rows.map((r) => ({
      ...r,
      percentual: r.total > 0 ? Math.round((r.feitas / r.total) * 100) : 0,
    }));

    res.json({ periodo, ranking });
  } catch (err) {
    console.error('Erro ao montar ranking:', err);
    res.status(500).json({ error: 'Erro ao montar ranking' });
  }
});

/**
 * Mesma ideia do lembrete de tarefa, mas pra rotina: junta a data da ocorrência
 * com o horário cadastrado na rotina, e avisa 15min e depois 5min antes.
 */
async function verificarLembretesRotinas(io) {
  const janelas = [
    { coluna: 'reminder_15_sent', de: '14 minutes', ate: '16 minutes', texto: 'Faltam 15 minutos' },
    { coluna: 'reminder_5_sent', de: '4 minutes', ate: '6 minutes', texto: 'Faltam 5 minutos' },
  ];

  for (const j of janelas) {
    const { rows } = await pool.query(
      `SELECT rc.id, rc.user_id, r.title
       FROM routine_completions rc
       JOIN task_recurrences r ON r.id = rc.recurrence_id
       WHERE r.start_time IS NOT NULL AND rc.done = false AND rc.${j.coluna} = false
         AND (rc.occurrence_date + r.start_time) BETWEEN now() + interval '${j.de}' AND now() + interval '${j.ate}'`
    );
    if (rows.length === 0) continue;

    for (const r of rows) {
      io?.to(`user-${r.user_id}`).emit('gestao:notify', {
        titulo: 'Lembrete de rotina',
        corpo: `${j.texto}: ${r.title}`,
      });
    }
    const ids = [...new Set(rows.map((r) => r.id))];
    await pool.query(`UPDATE routine_completions SET ${j.coluna} = true WHERE id = ANY($1::int[])`, [ids]);
  }
}

module.exports = { router, gerarTodasAsOcorrencias, verificarLembretesRotinas };
