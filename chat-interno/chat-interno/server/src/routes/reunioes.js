const express = require("express");
const { pool } = require("../db");
const { requireAuth, requireAdmin } = require("../middleware/auth");
const { gerarOcorrenciasDaRotina } = require("./gestaoRecurrences");

const router = express.Router();

// Reuniões são exclusivas de ADM — operador nunca vê nem participa.
router.use(requireAuth, requireAdmin);

const LEMBRETES_PADRAO = [0, 30, 15, 5]; // 0 = no começo do dia

// Teto de segurança: mesmo em repetição diária sem fim definido, não cria
// uma quantidade absurda de reuniões de uma vez.
const MAX_OCORRENCIAS = 200;

/**
 * Descobre todas as datas de uma reunião que se repete, mantendo sempre o
 * mesmo horário de início e a mesma duração da primeira.
 * recorrencia: { tipo: 'diaria'|'semanal'|'quinzenal'|'mensal', diasSemana: [0..6], ate: 'YYYY-MM-DD' }
 */
function calcularDatasRecorrencia(inicio, fim, recorrencia) {
  const inicioBase = new Date(inicio);
  const fimBase = new Date(fim);
  const duracaoMs = fimBase - inicioBase;

  if (!recorrencia || !recorrencia.tipo || recorrencia.tipo === "nenhuma" || !recorrencia.ate) {
    return [{ inicio: inicioBase, fim: fimBase }];
  }

  const limite = new Date(recorrencia.ate);
  limite.setHours(23, 59, 59, 999);
  const datas = [];
  const empurrar = (d) => {
    const i = new Date(d);
    datas.push({ inicio: i, fim: new Date(i.getTime() + duracaoMs) });
  };

  if (recorrencia.tipo === "semanal" || recorrencia.tipo === "quinzenal") {
    // Se não escolher dia nenhum, usa o dia da semana da primeira data
    const dias = (recorrencia.diasSemana || []).length > 0
      ? recorrencia.diasSemana
      : [inicioBase.getDay()];
    const pulaSemanas = recorrencia.tipo === "quinzenal" ? 2 : 1;

    // A data escolhida sempre entra, mesmo que o dia da semana dela não esteja
    // marcado (a pessoa escolheu aquele dia de propósito ao abrir o formulário)
    empurrar(inicioBase);

    const cursorSemana = new Date(inicioBase);
    cursorSemana.setDate(cursorSemana.getDate() - cursorSemana.getDay());

    while (cursorSemana <= limite && datas.length < MAX_OCORRENCIAS) {
      for (const dia of [...dias].sort((a, b) => a - b)) {
        const d = new Date(cursorSemana);
        d.setDate(cursorSemana.getDate() + dia);
        d.setHours(inicioBase.getHours(), inicioBase.getMinutes(), 0, 0);
        // > inicioBase (não >=) pra não repetir a data que já entrou acima
        if (d > inicioBase && d <= limite) empurrar(d);
      }
      cursorSemana.setDate(cursorSemana.getDate() + 7 * pulaSemanas);
    }
  } else if (recorrencia.tipo === "diaria") {
    const d = new Date(inicioBase);
    while (d <= limite && datas.length < MAX_OCORRENCIAS) {
      empurrar(d);
      d.setDate(d.getDate() + 1);
    }
  } else if (recorrencia.tipo === "mensal") {
    const diaDoMes = inicioBase.getDate();
    const d = new Date(inicioBase);
    while (d <= limite && datas.length < MAX_OCORRENCIAS) {
      // Se o mês não tiver esse dia (ex: 31 em fevereiro), pula esse mês
      if (d.getDate() === diaDoMes) empurrar(d);
      d.setMonth(d.getMonth() + 1);
      d.setDate(diaDoMes);
    }
  }

  return datas.length > 0 ? datas : [{ inicio: inicioBase, fim: fimBase }];
}

// GET /api/reunioes?de=&ate= -> reuniões do período (pro calendário)
// GET /api/reunioes/hoje -> as reuniões de HOJE em que eu participo e que
// ainda não acabaram. Serve pro contador no menu e pra tarja no topo do chat.
router.get("/hoje", async (req, res) => {
  try {
    const { rows } = await pool.query(
      `SELECT r.id, r.titulo, r.tipo, r.inicio, r.fim, r.local
       FROM reunioes r
       JOIN reuniao_participantes rp ON rp.reuniao_id = r.id
       WHERE rp.user_id = $1
         AND r.inicio::date = CURRENT_DATE
         AND r.fim > now()
       ORDER BY r.inicio`,
      [req.user.id]
    );
    res.json({ reunioes: rows, count: rows.length });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Erro ao carregar as reuniões de hoje." });
  }
});

router.get("/", async (req, res) => {
  try {
    const { de, ate } = req.query;
    const params = [];
    let filtro = "";
    if (de && ate) {
      params.push(de, ate);
      filtro = "WHERE r.inicio::date BETWEEN $1 AND $2";
    }
    const { rows: reunioes } = await pool.query(
      `SELECT r.*, u.name AS criado_por_nome
       FROM reunioes r JOIN users u ON u.id = r.criado_por
       ${filtro}
       ORDER BY r.inicio`,
      params
    );
    if (reunioes.length === 0) return res.json({ reunioes: [] });

    const { rows: participantes } = await pool.query(
      `SELECT rp.reuniao_id, rp.user_id, rp.presente, u.name, u.avatar_url, u.color
       FROM reuniao_participantes rp JOIN users u ON u.id = rp.user_id
       WHERE rp.reuniao_id = ANY($1::int[])`,
      [reunioes.map((r) => r.id)]
    );
    const porReuniao = {};
    participantes.forEach((p) => {
      (porReuniao[p.reuniao_id] ||= []).push({
        userId: p.user_id, name: p.name, avatarUrl: p.avatar_url, color: p.color, presente: p.presente,
      });
    });

    res.json({ reunioes: reunioes.map((r) => ({ ...r, participantes: porReuniao[r.id] || [] })) });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Erro ao carregar as reuniões." });
  }
});

// GET /api/reunioes/:id -> detalhe (com ata e encaminhamentos)
router.get("/:id", async (req, res) => {
  try {
    const { rows } = await pool.query(
      `SELECT r.*, u.name AS criado_por_nome
       FROM reunioes r JOIN users u ON u.id = r.criado_por WHERE r.id = $1`,
      [req.params.id]
    );
    const reuniao = rows[0];
    if (!reuniao) return res.status(404).json({ error: "Reunião não encontrada." });

    const { rows: participantes } = await pool.query(
      `SELECT rp.user_id, rp.presente, u.name, u.avatar_url, u.color
       FROM reuniao_participantes rp JOIN users u ON u.id = rp.user_id
       WHERE rp.reuniao_id = $1 ORDER BY u.name`,
      [reuniao.id]
    );
    const { rows: encaminhamentos } = await pool.query(
      `SELECT e.*, u.name AS responsavel_nome
       FROM reuniao_encaminhamentos e JOIN users u ON u.id = e.responsavel_id
       WHERE e.reuniao_id = $1 ORDER BY e.prazo, e.id`,
      [reuniao.id]
    );
    const { rows: lembretes } = await pool.query(
      `SELECT minutos_antes, enviado_em FROM reuniao_lembretes WHERE reuniao_id = $1 ORDER BY minutos_antes DESC`,
      [reuniao.id]
    );

    res.json({
      reuniao: {
        ...reuniao,
        participantes: participantes.map((p) => ({
          userId: p.user_id, name: p.name, avatarUrl: p.avatar_url, color: p.color, presente: p.presente,
        })),
        encaminhamentos,
        lembretes,
        souDono: reuniao.criado_por === req.user.id,
      },
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Erro ao carregar a reunião." });
  }
});

// POST /api/reunioes -> agenda uma reunião nova
router.post("/", async (req, res) => {
  const { titulo, tipo, inicio, fim, local, descricao, participantes, lembretes, recorrencia } = req.body || {};
  if (!titulo?.trim() || !inicio || !fim) {
    return res.status(400).json({ error: "Preencha título, início e fim." });
  }
  if (new Date(fim) <= new Date(inicio)) {
    return res.status(400).json({ error: "O fim precisa ser depois do início." });
  }

  // Quando a reunião se repete, geramos uma reunião DE VERDADE pra cada data.
  // Cada uma fica com ata, presença e encaminhamentos próprios — só ficam
  // ligadas entre si pela mesma serie_id, pra dar pra apagar a série inteira.
  const datas = calcularDatasRecorrencia(inicio, fim, recorrencia);
  const serieId = datas.length > 1 ? `serie-${Date.now()}-${req.user.id}` : null;

  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const ids = [...new Set([req.user.id, ...(participantes || [])])];
    const minutos = Array.isArray(lembretes) && lembretes.length > 0 ? lembretes : LEMBRETES_PADRAO;
    let primeiroId = null;

    for (const d of datas) {
      const { rows } = await client.query(
        `INSERT INTO reunioes (titulo, tipo, inicio, fim, local, descricao, criado_por, serie_id)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING id`,
        [titulo.trim(), tipo === "externa" ? "externa" : "interna", d.inicio, d.fim, local?.trim() || null, descricao?.trim() || null, req.user.id, serieId]
      );
      const reuniaoId = rows[0].id;
      if (!primeiroId) primeiroId = reuniaoId;

      for (const userId of ids) {
        await client.query(
          `INSERT INTO reuniao_participantes (reuniao_id, user_id) VALUES ($1, $2) ON CONFLICT DO NOTHING`,
          [reuniaoId, userId]
        );
      }
      for (const m of minutos) {
        await client.query(
          `INSERT INTO reuniao_lembretes (reuniao_id, minutos_antes) VALUES ($1, $2) ON CONFLICT DO NOTHING`,
          [reuniaoId, m]
        );
      }
    }
    await client.query("COMMIT");

    const io = req.app.get("io");
    const quantas = datas.length > 1 ? ` (${datas.length} datas)` : "";
    ids.filter((id) => id !== req.user.id).forEach((userId) => {
      io.to(`user-${userId}`).emit("gestao:notify", {
        titulo: "Você foi incluído numa reunião",
        corpo: `${titulo.trim()} — ${new Date(inicio).toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" })}${quantas}`,
      });
    });

    res.status(201).json({ id: primeiroId, criadas: datas.length });
  } catch (err) {
    await client.query("ROLLBACK");
    console.error(err);
    res.status(500).json({ error: "Erro ao agendar a reunião." });
  } finally {
    client.release();
  }
});

// PATCH /api/reunioes/:id -> edita dados da reunião (só quem criou)
router.patch("/:id", async (req, res) => {
  try {
    const { rows: donoRows } = await pool.query(`SELECT criado_por FROM reunioes WHERE id = $1`, [req.params.id]);
    if (!donoRows[0]) return res.status(404).json({ error: "Reunião não encontrada." });
    if (donoRows[0].criado_por !== req.user.id) {
      return res.status(403).json({ error: "Só quem criou a reunião pode editar." });
    }

    const { titulo, tipo, inicio, fim, local, descricao } = req.body || {};
    await pool.query(
      `UPDATE reunioes SET
         titulo = COALESCE($2, titulo), tipo = COALESCE($3, tipo),
         inicio = COALESCE($4, inicio), fim = COALESCE($5, fim),
         local = COALESCE($6, local), descricao = COALESCE($7, descricao)
       WHERE id = $1`,
      [req.params.id, titulo?.trim() || null, tipo || null, inicio || null, fim || null, local?.trim() || null, descricao?.trim() || null]
    );
    res.json({ ok: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Erro ao editar a reunião." });
  }
});

// DELETE /api/reunioes/:id -> só quem criou
router.delete("/:id", async (req, res) => {
  try {
    const { rows } = await pool.query(`SELECT criado_por, serie_id FROM reunioes WHERE id = $1`, [req.params.id]);
    if (!rows[0]) return res.status(404).json({ error: "Reunião não encontrada." });
    if (rows[0].criado_por !== req.user.id) {
      return res.status(403).json({ error: "Só quem criou a reunião pode apagar." });
    }
    // ?serie=1 apaga a série toda (só as que ainda não aconteceram, pra não
    // perder ata de reunião que já passou)
    if (req.query.serie === "1" && rows[0].serie_id) {
      const { rowCount } = await pool.query(
        `DELETE FROM reunioes WHERE serie_id = $1 AND fim > now()`,
        [rows[0].serie_id]
      );
      return res.json({ ok: true, apagadas: rowCount });
    }
    await pool.query(`DELETE FROM reunioes WHERE id = $1`, [req.params.id]);
    res.json({ ok: true, apagadas: 1 });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Erro ao apagar a reunião." });
  }
});

// PUT /api/reunioes/:id/ata -> salva a ata e a presença (só quem criou)
router.put("/:id/ata", async (req, res) => {
  try {
    const { rows } = await pool.query(`SELECT criado_por FROM reunioes WHERE id = $1`, [req.params.id]);
    if (!rows[0]) return res.status(404).json({ error: "Reunião não encontrada." });
    if (rows[0].criado_por !== req.user.id) {
      return res.status(403).json({ error: "Só quem criou a reunião pode escrever a ata." });
    }

    await pool.query(
      `UPDATE reunioes SET ata = $2, ata_atualizada_em = now() WHERE id = $1`,
      [req.params.id, req.body?.ata || ""]
    );

    // Presença de cada participante, se veio junto
    const presencas = req.body?.presencas || {};
    for (const [userId, presente] of Object.entries(presencas)) {
      await pool.query(
        `UPDATE reuniao_participantes SET presente = $3 WHERE reuniao_id = $1 AND user_id = $2`,
        [req.params.id, userId, presente]
      );
    }

    res.json({ ok: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Erro ao salvar a ata." });
  }
});

// POST /api/reunioes/:id/encaminhamentos -> adiciona um combinado da ata e já
// cria a rotina na "Minha Rotina" de quem ficou responsável
router.post("/:id/encaminhamentos", async (req, res) => {
  const { descricao, responsavelId, prazo } = req.body || {};
  if (!descricao?.trim() || !responsavelId || !prazo) {
    return res.status(400).json({ error: "Preencha a ação, o responsável e o prazo." });
  }
  const client = await pool.connect();
  try {
    const { rows: donoRows } = await client.query(`SELECT criado_por, titulo FROM reunioes WHERE id = $1`, [req.params.id]);
    if (!donoRows[0]) return res.status(404).json({ error: "Reunião não encontrada." });
    if (donoRows[0].criado_por !== req.user.id) {
      return res.status(403).json({ error: "Só quem criou a reunião pode adicionar encaminhamentos." });
    }

    await client.query("BEGIN");
    // Rotina de um dia só (início e fim na mesma data), igual o feedback agendado
    const { rows: recRows } = await client.query(
      `INSERT INTO task_recurrences (title, description, priority, recurrence_type, start_date, end_date, active, created_by)
       VALUES ($1, $2, 'medium', 'daily', $3, $3, true, $4) RETURNING *`,
      [`Reunião: ${descricao.trim()}`, `Encaminhamento da reunião "${donoRows[0].titulo}"`, prazo, req.user.id]
    );
    const recurrence = recRows[0];
    await client.query(`INSERT INTO recurrence_assignees (recurrence_id, user_id) VALUES ($1, $2)`, [recurrence.id, responsavelId]);

    const { rows } = await client.query(
      `INSERT INTO reuniao_encaminhamentos (reuniao_id, descricao, responsavel_id, prazo, recurrence_id)
       VALUES ($1, $2, $3, $4, $5) RETURNING id`,
      [req.params.id, descricao.trim(), responsavelId, prazo, recurrence.id]
    );
    await client.query("COMMIT");

    await gerarOcorrenciasDaRotina(recurrence);

    const io = req.app.get("io");
    io.to(`user-${responsavelId}`).emit("gestao:notify", {
      titulo: "Novo item na sua rotina",
      corpo: `Encaminhamento da reunião: ${descricao.trim()}`,
    });

    res.status(201).json({ id: rows[0].id });
  } catch (err) {
    await client.query("ROLLBACK");
    console.error(err);
    res.status(500).json({ error: "Erro ao adicionar o encaminhamento." });
  } finally {
    client.release();
  }
});

// DELETE /api/reunioes/encaminhamentos/:id
router.delete("/encaminhamentos/:id", async (req, res) => {
  try {
    const { rows } = await pool.query(
      `SELECT e.recurrence_id, r.criado_por FROM reuniao_encaminhamentos e
       JOIN reunioes r ON r.id = e.reuniao_id WHERE e.id = $1`,
      [req.params.id]
    );
    if (!rows[0]) return res.status(404).json({ error: "Encaminhamento não encontrado." });
    if (rows[0].criado_por !== req.user.id) {
      return res.status(403).json({ error: "Só quem criou a reunião pode remover." });
    }
    // Apagar a rotina remove junto o encaminhamento (ON DELETE SET NULL) e as ocorrências
    if (rows[0].recurrence_id) {
      await pool.query(`DELETE FROM task_recurrences WHERE id = $1`, [rows[0].recurrence_id]);
    }
    await pool.query(`DELETE FROM reuniao_encaminhamentos WHERE id = $1`, [req.params.id]);
    res.json({ ok: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Erro ao remover o encaminhamento." });
  }
});

/**
 * Roda de tempo em tempo e dispara os lembretes de reunião que chegaram na
 * hora (no começo do dia, 30/15/5 minutos antes). Cada lembrete é marcado
 * como enviado pra não avisar duas vezes.
 */
async function verificarLembretesReunioes(io) {
  try {
    const { rows } = await pool.query(
      `SELECT rl.reuniao_id, rl.minutos_antes, r.titulo, r.inicio, r.local
       FROM reuniao_lembretes rl
       JOIN reunioes r ON r.id = rl.reuniao_id
       WHERE rl.enviado_em IS NULL
         AND r.inicio > now()
         AND (
           (rl.minutos_antes = 0 AND r.inicio::date = CURRENT_DATE)
           OR (rl.minutos_antes > 0 AND r.inicio - (rl.minutos_antes || ' minutes')::interval <= now())
         )`
    );

    for (const l of rows) {
      const { rows: participantes } = await pool.query(
        `SELECT user_id FROM reuniao_participantes WHERE reuniao_id = $1`,
        [l.reuniao_id]
      );
      const hora = new Date(l.inicio).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
      const quando = l.minutos_antes === 0 ? "hoje" : `em ${l.minutos_antes} minutos`;
      participantes.forEach((p) => {
        io.to(`user-${p.user_id}`).emit("reuniao:lembrete", {
          titulo: `Reunião ${quando}`,
          corpo: `${l.titulo} — ${hora}${l.local ? ` · ${l.local}` : ""}`,
        });
      });
      await pool.query(
        `UPDATE reuniao_lembretes SET enviado_em = now() WHERE reuniao_id = $1 AND minutos_antes = $2`,
        [l.reuniao_id, l.minutos_antes]
      );
    }
  } catch (err) {
    console.error("Erro ao verificar lembretes de reunião:", err);
  }
}

module.exports = { router, verificarLembretesReunioes };
