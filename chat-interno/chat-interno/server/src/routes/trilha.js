const express = require("express");
const { pool } = require("../db");
const { requireAuth, requireAdmin } = require("../middleware/auth");
const { uploadVideo } = require("../middleware/upload");

const router = express.Router();

// Nota sobre a nota de corte: hoje precisa acertar TODAS as perguntas do
// módulo pra passar. Se um dia quiser afrouxar (ex: 70%), é só mudar a
// comparação em "passou = acertos === total" lá embaixo.

// ---------------------------------------------------------------
// GET /api/trilha/modulos -> lista os módulos em ordem, com o MEU progresso
// em cada um, e se está bloqueado (só libera depois de passar no anterior)
// ---------------------------------------------------------------
router.get("/modulos", requireAuth, async (req, res) => {
  try {
    const { rows: modulos } = await pool.query(
      `SELECT m.id, m.title, m.description, m.video_url, m.video_name, m.order_index,
              (SELECT COUNT(*)::int FROM trilha_perguntas p WHERE p.modulo_id = m.id) AS total_perguntas
       FROM trilha_modulos m
       ORDER BY m.order_index, m.id`
    );
    const { rows: progresso } = await pool.query(
      `SELECT modulo_id, video_assistido, passou, tentativas, concluido_em
       FROM trilha_progresso WHERE user_id = $1`,
      [req.user.id]
    );
    const progressoPorModulo = new Map(progresso.map((p) => [p.modulo_id, p]));

    let anteriorPassou = true; // o primeiro módulo nunca fica bloqueado
    const lista = modulos.map((m) => {
      const meuProgresso = progressoPorModulo.get(m.id) || { video_assistido: false, passou: false, tentativas: 0, concluido_em: null };
      const bloqueado = !anteriorPassou;
      anteriorPassou = meuProgresso.passou;
      return { ...m, progresso: meuProgresso, bloqueado };
    });

    res.json({ modulos: lista });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Erro ao carregar a trilha." });
  }
});

// ---------------------------------------------------------------
// GET /api/trilha/modulos/:id -> detalhe de um módulo (vídeo + perguntas,
// SEM revelar qual alternativa é a certa) + confere se está liberado pra essa pessoa
// ---------------------------------------------------------------
router.get("/modulos/:id", requireAuth, async (req, res) => {
  try {
    const { rows: modRows } = await pool.query(
      `SELECT id, title, description, video_url, video_name, order_index FROM trilha_modulos WHERE id = $1`,
      [req.params.id]
    );
    const modulo = modRows[0];
    if (!modulo) return res.status(404).json({ error: "Módulo não encontrado." });

    // Confere se os módulos anteriores (por order_index) já foram todos passados
    const { rows: anteriores } = await pool.query(
      `SELECT m.id FROM trilha_modulos m WHERE m.order_index < $1 OR (m.order_index = $1 AND m.id < $2)`,
      [modulo.order_index, modulo.id]
    );
    if (anteriores.length > 0) {
      const { rows: passouAnteriores } = await pool.query(
        `SELECT COUNT(*)::int AS total FROM trilha_progresso
         WHERE user_id = $1 AND modulo_id = ANY($2::int[]) AND passou = true`,
        [req.user.id, anteriores.map((a) => a.id)]
      );
      if (passouAnteriores[0].total < anteriores.length) {
        return res.status(403).json({ error: "Termine os módulos anteriores primeiro." });
      }
    }

    const { rows: perguntas } = await pool.query(
      `SELECT id, question, order_index FROM trilha_perguntas WHERE modulo_id = $1 ORDER BY order_index, id`,
      [modulo.id]
    );
    const { rows: opcoes } = await pool.query(
      `SELECT id, pergunta_id, text, order_index FROM trilha_opcoes WHERE pergunta_id = ANY($1::int[]) ORDER BY order_index, id`,
      [perguntas.map((p) => p.id)]
    );
    const opcoesPorPergunta = {};
    opcoes.forEach((o) => (opcoesPorPergunta[o.pergunta_id] ||= []).push({ id: o.id, text: o.text }));

    const { rows: progRows } = await pool.query(
      `SELECT video_assistido, passou, tentativas FROM trilha_progresso WHERE user_id = $1 AND modulo_id = $2`,
      [req.user.id, modulo.id]
    );
    const meuProgresso = progRows[0] || { video_assistido: false, passou: false, tentativas: 0 };

    res.json({
      modulo,
      perguntas: perguntas.map((p) => ({ ...p, opcoes: opcoesPorPergunta[p.id] || [] })),
      progresso: meuProgresso,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Erro ao carregar o módulo." });
  }
});

// ---------------------------------------------------------------
// POST /api/trilha/modulos/:id/video-assistido -> marca que terminei de ver o
// vídeo (chamado quando o vídeo chega no fim) — libera a prova
// ---------------------------------------------------------------
router.post("/modulos/:id/video-assistido", requireAuth, async (req, res) => {
  try {
    await pool.query(
      `INSERT INTO trilha_progresso (user_id, modulo_id, video_assistido)
       VALUES ($1, $2, true)
       ON CONFLICT (user_id, modulo_id) DO UPDATE SET video_assistido = true`,
      [req.user.id, req.params.id]
    );
    res.json({ ok: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Erro ao salvar seu progresso do vídeo." });
  }
});

// ---------------------------------------------------------------
// POST /api/trilha/modulos/:id/responder -> manda as respostas da prova.
// body: { respostas: { [perguntaId]: opcaoId } }
// ---------------------------------------------------------------
router.post("/modulos/:id/responder", requireAuth, async (req, res) => {
  try {
    const { rows: progRows } = await pool.query(
      `SELECT video_assistido FROM trilha_progresso WHERE user_id = $1 AND modulo_id = $2`,
      [req.user.id, req.params.id]
    );
    if (!progRows[0]?.video_assistido) {
      return res.status(403).json({ error: "Assista o vídeo até o fim antes de fazer a prova." });
    }

    const respostas = req.body?.respostas || {};
    const { rows: perguntas } = await pool.query(
      `SELECT id FROM trilha_perguntas WHERE modulo_id = $1`,
      [req.params.id]
    );
    const { rows: corretas } = await pool.query(
      `SELECT pergunta_id, id FROM trilha_opcoes WHERE pergunta_id = ANY($1::int[]) AND is_correct = true`,
      [perguntas.map((p) => p.id)]
    );
    const corretaPorPergunta = new Map(corretas.map((c) => [c.pergunta_id, c.id]));

    let acertos = 0;
    perguntas.forEach((p) => {
      if (Number(respostas[p.id]) === corretaPorPergunta.get(p.id)) acertos++;
    });
    const total = perguntas.length;
    const passou = total > 0 && acertos === total; // precisa acertar tudo

    await pool.query(
      `UPDATE trilha_progresso SET
         passou = $3,
         tentativas = tentativas + 1,
         ultima_tentativa_em = now(),
         concluido_em = CASE WHEN $3 THEN now() ELSE concluido_em END,
         video_assistido = CASE WHEN $3 THEN video_assistido ELSE false END
       WHERE user_id = $1 AND modulo_id = $2`,
      [req.user.id, req.params.id, passou]
    );

    res.json({ passou, acertos, total });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Erro ao corrigir a prova." });
  }
});

// =================================================================
// Administração — criar/editar conteúdo e ver o progresso da equipe
// =================================================================

// POST /api/trilha/modulos -> cria um módulo novo (upload do vídeo)
// Se o vídeo passar do limite (2GB por padrão), o multer dá um erro antes
// mesmo de chegar na rota — sem isso, virava um erro genérico feio em vez de
// uma mensagem que a pessoa entende.
function uploadVideoComErroAmigavel(req, res, next) {
  uploadVideo.single("video")(req, res, (err) => {
    if (err) {
      if (err.code === "LIMIT_FILE_SIZE") {
        return res.status(413).json({ error: "Esse vídeo é grande demais. Tente um arquivo menor ou comprimido." });
      }
      console.error(err);
      return res.status(500).json({ error: "Erro ao enviar o vídeo." });
    }
    next();
  });
}

router.post("/modulos", requireAuth, requireAdmin, uploadVideoComErroAmigavel, async (req, res) => {
  const { title, description } = req.body || {};
  if (!title?.trim() || !req.file) {
    return res.status(400).json({ error: "Escreva um título e escolha o vídeo." });
  }
  try {
    const { rows: maxRows } = await pool.query(`SELECT COALESCE(MAX(order_index), -1) + 1 AS proximo FROM trilha_modulos`);
    const { rows } = await pool.query(
      `INSERT INTO trilha_modulos (title, description, video_url, video_name, order_index, created_by)
       VALUES ($1, $2, $3, $4, $5, $6) RETURNING id`,
      [title.trim(), description?.trim() || null, `/uploads/${req.file.filename}`, req.file.originalname, maxRows[0].proximo, req.user.id]
    );
    res.status(201).json({ id: rows[0].id });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Erro ao criar o módulo." });
  }
});

// DELETE /api/trilha/modulos/:id
router.delete("/modulos/:id", requireAuth, requireAdmin, async (req, res) => {
  try {
    await pool.query(`DELETE FROM trilha_modulos WHERE id = $1`, [req.params.id]);
    res.json({ ok: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Erro ao apagar o módulo." });
  }
});

// POST /api/trilha/modulos/:id/perguntas -> adiciona uma pergunta com alternativas
// body: { question, opcoes: [{ text, isCorrect }] }
router.post("/modulos/:id/perguntas", requireAuth, requireAdmin, async (req, res) => {
  const { question, opcoes } = req.body || {};
  if (!question?.trim() || !Array.isArray(opcoes) || opcoes.length < 2 || !opcoes.some((o) => o.isCorrect)) {
    return res.status(400).json({ error: "Escreva a pergunta, pelo menos 2 alternativas e marque a correta." });
  }
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const { rows: maxRows } = await client.query(
      `SELECT COALESCE(MAX(order_index), -1) + 1 AS proximo FROM trilha_perguntas WHERE modulo_id = $1`,
      [req.params.id]
    );
    const { rows } = await client.query(
      `INSERT INTO trilha_perguntas (modulo_id, question, order_index) VALUES ($1, $2, $3) RETURNING id`,
      [req.params.id, question.trim(), maxRows[0].proximo]
    );
    const perguntaId = rows[0].id;
    for (let i = 0; i < opcoes.length; i++) {
      await client.query(
        `INSERT INTO trilha_opcoes (pergunta_id, text, is_correct, order_index) VALUES ($1, $2, $3, $4)`,
        [perguntaId, opcoes[i].text, !!opcoes[i].isCorrect, i]
      );
    }
    await client.query("COMMIT");
    res.status(201).json({ id: perguntaId });
  } catch (err) {
    await client.query("ROLLBACK");
    console.error(err);
    res.status(500).json({ error: "Erro ao adicionar a pergunta." });
  } finally {
    client.release();
  }
});

// DELETE /api/trilha/perguntas/:id
router.delete("/perguntas/:id", requireAuth, requireAdmin, async (req, res) => {
  try {
    await pool.query(`DELETE FROM trilha_perguntas WHERE id = $1`, [req.params.id]);
    res.json({ ok: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Erro ao apagar a pergunta." });
  }
});

// GET /api/trilha/modulos/:id/perguntas-admin -> pergunta + alternativas COM
// a marcação de qual é a certa (só pra tela de gerenciar conteúdo)
router.get("/modulos/:id/perguntas-admin", requireAuth, requireAdmin, async (req, res) => {
  try {
    const { rows: perguntas } = await pool.query(
      `SELECT id, question, order_index FROM trilha_perguntas WHERE modulo_id = $1 ORDER BY order_index, id`,
      [req.params.id]
    );
    const { rows: opcoes } = await pool.query(
      `SELECT id, pergunta_id, text, is_correct, order_index FROM trilha_opcoes WHERE pergunta_id = ANY($1::int[]) ORDER BY order_index, id`,
      [perguntas.map((p) => p.id)]
    );
    const opcoesPorPergunta = {};
    opcoes.forEach((o) => (opcoesPorPergunta[o.pergunta_id] ||= []).push(o));
    res.json({ perguntas: perguntas.map((p) => ({ ...p, opcoes: opcoesPorPergunta[p.id] || [] })) });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Erro ao carregar as perguntas." });
  }
});

// GET /api/trilha/admin/progresso -> tela de acompanhamento: cada pessoa,
// cada módulo, se passou ou não
router.get("/admin/progresso", requireAuth, requireAdmin, async (req, res) => {
  try {
    const { rows: pessoas } = await pool.query(`SELECT id, name, avatar_url, color FROM users WHERE active = true ORDER BY name`);
    const { rows: modulos } = await pool.query(`SELECT id, title, order_index FROM trilha_modulos ORDER BY order_index, id`);
    const { rows: progresso } = await pool.query(`SELECT user_id, modulo_id, passou, tentativas, video_assistido, concluido_em FROM trilha_progresso`);

    const chave = (u, m) => `${u}-${m}`;
    const progressoMap = new Map(progresso.map((p) => [chave(p.user_id, p.modulo_id), p]));

    const linhas = pessoas.map((pessoa) => ({
      pessoa,
      modulos: modulos.map((m) => progressoMap.get(chave(pessoa.id, m.id)) || { passou: false, tentativas: 0, video_assistido: false }),
    }));

    res.json({ modulos, linhas });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Erro ao carregar o acompanhamento." });
  }
});

module.exports = router;
