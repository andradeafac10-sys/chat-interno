const express = require("express");
const fs = require("fs");
const path = require("path");
const { pool } = require("../db");
const { requireAuth, requireAdmin } = require("../middleware/auth");
const { uploadVideo, uploadDir } = require("../middleware/upload");

const router = express.Router();

// Cada treinamento (vídeo ou avaliação) tem EXATAMENTE 4 perguntas com 4
// alternativas cada uma — cada pergunta vale 25%. Cada pergunta tem no
// máximo 2 tentativas; depois disso o resultado dela é definitivo. Não é
// preciso acertar tudo pra "concluir" — concluído = terminou todas as
// perguntas (não importa a nota). O que muda é a nota registrada.

// ---------------------------------------------------------------
// GET /api/trilha/modulos -> lista os treinamentos em ordem, com o MEU
// progresso em cada um, e se está bloqueado (só libera depois de concluir o anterior)
// ---------------------------------------------------------------
router.get("/modulos", requireAuth, async (req, res) => {
  try {
    const { rows: modulos } = await pool.query(
      `SELECT m.id, m.title, m.description, m.tipo, m.video_url, m.video_name, m.order_index,
              (SELECT COUNT(*)::int FROM trilha_perguntas p WHERE p.modulo_id = m.id) AS total_perguntas
       FROM trilha_modulos m
       WHERE $2 = true
          OR NOT EXISTS (SELECT 1 FROM trilha_modulo_destinatarios d WHERE d.modulo_id = m.id)
          OR EXISTS (SELECT 1 FROM trilha_modulo_destinatarios d WHERE d.modulo_id = m.id AND d.user_id = $1)
       ORDER BY m.order_index, m.id`,
      [req.user.id, req.user.role === "admin"]
    );
    const { rows: progresso } = await pool.query(
      `SELECT modulo_id, video_assistido, passou, ultima_nota, concluido_em
       FROM trilha_progresso WHERE user_id = $1`,
      [req.user.id]
    );
    const progressoPorModulo = new Map(progresso.map((p) => [p.modulo_id, p]));

    let anteriorConcluido = true; // o primeiro treinamento (que essa pessoa vê) nunca fica bloqueado
    const lista = modulos.map((m) => {
      const meuProgresso = progressoPorModulo.get(m.id) || { video_assistido: false, passou: false, ultima_nota: null, concluido_em: null };
      const bloqueado = !anteriorConcluido;
      anteriorConcluido = !!meuProgresso.concluido_em;
      return { ...m, progresso: meuProgresso, bloqueado };
    });

    res.json({ modulos: lista });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Erro ao carregar a trilha." });
  }
});

// ---------------------------------------------------------------
// GET /api/trilha/pendentes-count -> quantos treinamentos ainda faltam
// concluir (pra notificação "treinamento pendente" na tela do chat)
// ---------------------------------------------------------------
router.get("/pendentes-count", requireAuth, async (req, res) => {
  try {
    const { rows } = await pool.query(
      `SELECT COUNT(*)::int AS count
       FROM trilha_modulos m
       WHERE (
         NOT EXISTS (SELECT 1 FROM trilha_modulo_destinatarios d WHERE d.modulo_id = m.id)
         OR EXISTS (SELECT 1 FROM trilha_modulo_destinatarios d WHERE d.modulo_id = m.id AND d.user_id = $1)
       )
       AND NOT EXISTS (SELECT 1 FROM trilha_progresso p WHERE p.modulo_id = m.id AND p.user_id = $1 AND p.concluido_em IS NOT NULL)`,
      [req.user.id]
    );
    res.json({ count: rows[0].count });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Erro ao contar treinamentos pendentes." });
  }
});

// ---------------------------------------------------------------
// GET /api/trilha/modulos/:id -> detalhe de um treinamento (vídeo + perguntas,
// SEM revelar qual alternativa é a certa) + meu progresso pergunta a pergunta
// ---------------------------------------------------------------
router.get("/modulos/:id", requireAuth, async (req, res) => {
  try {
    const { rows: modRows } = await pool.query(
      `SELECT id, title, description, tipo, video_url, video_name, order_index FROM trilha_modulos WHERE id = $1`,
      [req.params.id]
    );
    const modulo = modRows[0];
    if (!modulo) return res.status(404).json({ error: "Treinamento não encontrado." });

    const isAdm = req.user.role === "admin";
    if (!isAdm) {
      const { rows: acesso } = await pool.query(
        `SELECT 1 WHERE NOT EXISTS (SELECT 1 FROM trilha_modulo_destinatarios d WHERE d.modulo_id = $1)
         UNION SELECT 1 FROM trilha_modulo_destinatarios d WHERE d.modulo_id = $1 AND d.user_id = $2`,
        [modulo.id, req.user.id]
      );
      if (acesso.length === 0) return res.status(403).json({ error: "Esse treinamento não é pra você." });
    }

    // Confere se os treinamentos anteriores (que essa pessoa também pode ver) já foram concluídos
    const { rows: anteriores } = await pool.query(
      `SELECT m.id FROM trilha_modulos m
       WHERE (m.order_index < $1 OR (m.order_index = $1 AND m.id < $2))
         AND ($4 = true
              OR NOT EXISTS (SELECT 1 FROM trilha_modulo_destinatarios d WHERE d.modulo_id = m.id)
              OR EXISTS (SELECT 1 FROM trilha_modulo_destinatarios d WHERE d.modulo_id = m.id AND d.user_id = $3))`,
      [modulo.order_index, modulo.id, req.user.id, isAdm]
    );
    if (anteriores.length > 0) {
      const { rows: concluidos } = await pool.query(
        `SELECT COUNT(*)::int AS total FROM trilha_progresso
         WHERE user_id = $1 AND modulo_id = ANY($2::int[]) AND concluido_em IS NOT NULL`,
        [req.user.id, anteriores.map((a) => a.id)]
      );
      if (concluidos[0].total < anteriores.length) {
        return res.status(403).json({ error: "Termine os treinamentos anteriores primeiro." });
      }
    }

    const { rows: perguntasOrdenadas } = await pool.query(
      `SELECT id, question, order_index FROM trilha_perguntas WHERE modulo_id = $1 ORDER BY order_index, id`,
      [modulo.id]
    );
    // Embaralha também a ORDEM das perguntas (não só as alternativas) — cada
    // vez que a pessoa abre o treinamento, a sequência das 6 perguntas vem
    // diferente, além das 4 alternativas de cada uma.
    const perguntas = [...perguntasOrdenadas].sort(() => Math.random() - 0.5);
    const { rows: opcoes } = await pool.query(
      `SELECT id, pergunta_id, text FROM trilha_opcoes WHERE pergunta_id = ANY($1::int[])`,
      [perguntas.map((p) => p.id)]
    );
    const opcoesPorPergunta = {};
    opcoes.forEach((o) => (opcoesPorPergunta[o.pergunta_id] ||= []).push({ id: o.id, text: o.text }));
    // Embaralha a ordem das alternativas a cada carregamento — o front recebe
    // sempre numa ordem nova, mas o certo continua sendo validado pelo ID lá
    // no backend, nunca pela posição.
    Object.values(opcoesPorPergunta).forEach((lista) => lista.sort(() => Math.random() - 0.5));

    const { rows: tentativasRows } = await pool.query(
      `SELECT pergunta_id, tentativas, acertou, finalizada FROM trilha_pergunta_tentativas
       WHERE user_id = $1 AND pergunta_id = ANY($2::int[])`,
      [req.user.id, perguntas.map((p) => p.id)]
    );
    const tentativasPorPergunta = new Map(tentativasRows.map((t) => [t.pergunta_id, t]));

    const { rows: progRows } = await pool.query(
      `SELECT video_assistido, passou, ultima_nota, concluido_em FROM trilha_progresso WHERE user_id = $1 AND modulo_id = $2`,
      [req.user.id, modulo.id]
    );
    const meuProgresso = progRows[0] || { video_assistido: false, passou: false, ultima_nota: null, concluido_em: null };

    const { rows: anotacaoRows } = await pool.query(
      `SELECT texto FROM trilha_anotacoes WHERE user_id = $1 AND modulo_id = $2`,
      [req.user.id, modulo.id]
    );

    res.json({
      modulo,
      perguntas: perguntas.map((p) => ({
        ...p,
        opcoes: opcoesPorPergunta[p.id] || [],
        minhaTentativa: tentativasPorPergunta.get(p.id) || { tentativas: 0, acertou: false, finalizada: false },
      })),
      progresso: meuProgresso,
      anotacao: anotacaoRows[0]?.texto || "",
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Erro ao carregar o treinamento." });
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
// POST /api/trilha/perguntas/:perguntaId/responder -> responde UMA pergunta
// por vez. Até 2 tentativas; depois disso, fica definitiva.
// body: { opcaoId }
// ---------------------------------------------------------------
router.post("/perguntas/:perguntaId/responder", requireAuth, async (req, res) => {
  try {
    const { rows: pRows } = await pool.query(
      `SELECT p.id, p.modulo_id, m.tipo FROM trilha_perguntas p JOIN trilha_modulos m ON m.id = p.modulo_id WHERE p.id = $1`,
      [req.params.perguntaId]
    );
    const pergunta = pRows[0];
    if (!pergunta) return res.status(404).json({ error: "Pergunta não encontrada." });

    if (pergunta.tipo === "video") {
      const { rows: progRows } = await pool.query(
        `SELECT video_assistido FROM trilha_progresso WHERE user_id = $1 AND modulo_id = $2`,
        [req.user.id, pergunta.modulo_id]
      );
      if (!progRows[0]?.video_assistido) {
        return res.status(403).json({ error: "Assista o vídeo até o fim antes de responder." });
      }
    }

    const { rows: atualRows } = await pool.query(
      `SELECT tentativas, acertou, finalizada FROM trilha_pergunta_tentativas WHERE user_id = $1 AND pergunta_id = $2`,
      [req.user.id, req.params.perguntaId]
    );
    const atual = atualRows[0] || { tentativas: 0, acertou: false, finalizada: false };
    if (atual.finalizada) {
      return res.status(400).json({ error: "Essa pergunta já foi respondida o máximo de vezes permitido." });
    }

    const { rows: corretaRows } = await pool.query(
      `SELECT id FROM trilha_opcoes WHERE pergunta_id = $1 AND is_correct = true`,
      [req.params.perguntaId]
    );
    const correto = Number(req.body?.opcaoId) === corretaRows[0]?.id;
    const novasTentativas = atual.tentativas + 1;
    const finalizada = correto || novasTentativas >= 2; // acertou, ou já eram as 2 tentativas

    await pool.query(
      `INSERT INTO trilha_pergunta_tentativas (user_id, pergunta_id, tentativas, acertou, finalizada)
       VALUES ($1, $2, $3, $4, $5)
       ON CONFLICT (user_id, pergunta_id) DO UPDATE SET tentativas = $3, acertou = $4, finalizada = $5`,
      [req.user.id, req.params.perguntaId, novasTentativas, correto, finalizada]
    );

    res.json({ correto, tentativas: novasTentativas, finalizada, podeTentarDeNovo: !finalizada });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Erro ao registrar sua resposta." });
  }
});

// ---------------------------------------------------------------
// POST /api/trilha/modulos/:id/concluir -> fecha o treinamento depois que
// todas as perguntas já estão finalizadas, calcula a nota (25% cada) e salva.
// ---------------------------------------------------------------
router.post("/modulos/:id/concluir", requireAuth, async (req, res) => {
  try {
    const { rows: perguntas } = await pool.query(`SELECT id FROM trilha_perguntas WHERE modulo_id = $1`, [req.params.id]);
    if (perguntas.length === 0) {
      // Treinamento sem prova cadastrada: concluir direto (ex: só vídeo, sem perguntas)
      await pool.query(
        `INSERT INTO trilha_progresso (user_id, modulo_id, passou, ultima_nota, concluido_em)
         VALUES ($1, $2, true, 100, now())
         ON CONFLICT (user_id, modulo_id) DO UPDATE SET passou = true, ultima_nota = 100, concluido_em = now()`,
        [req.user.id, req.params.id]
      );
      return res.json({ nota: 100, acertos: 0, erros: 0, total: 0 });
    }

    const { rows: tentativas } = await pool.query(
      `SELECT pergunta_id, acertou, finalizada FROM trilha_pergunta_tentativas WHERE user_id = $1 AND pergunta_id = ANY($2::int[])`,
      [req.user.id, perguntas.map((p) => p.id)]
    );
    const tentativasPorPergunta = new Map(tentativas.map((t) => [t.pergunta_id, t]));
    const naoFinalizadas = perguntas.filter((p) => !tentativasPorPergunta.get(p.id)?.finalizada);
    if (naoFinalizadas.length > 0) {
      return res.status(400).json({ error: "Ainda tem pergunta sem responder." });
    }

    const acertos = perguntas.filter((p) => tentativasPorPergunta.get(p.id)?.acertou).length;
    const total = perguntas.length;
    const nota = Math.round((acertos / total) * 100); // 4 perguntas = 25% cada

    await pool.query(
      `INSERT INTO trilha_progresso (user_id, modulo_id, passou, ultima_nota, concluido_em)
       VALUES ($1, $2, true, $3, now())
       ON CONFLICT (user_id, modulo_id) DO UPDATE SET passou = true, ultima_nota = $3, concluido_em = now()`,
      [req.user.id, req.params.id, nota]
    );

    res.json({ nota, acertos, erros: total - acertos, total });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Erro ao concluir o treinamento." });
  }
});

// ---------------------------------------------------------------
// GET/PUT /api/trilha/modulos/:id/anotacao -> anotação pessoal e livre sobre
// o treinamento — continua disponível mesmo depois de concluído
// ---------------------------------------------------------------
router.get("/modulos/:id/anotacao", requireAuth, async (req, res) => {
  try {
    const { rows } = await pool.query(`SELECT texto FROM trilha_anotacoes WHERE user_id = $1 AND modulo_id = $2`, [req.user.id, req.params.id]);
    res.json({ texto: rows[0]?.texto || "" });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Erro ao carregar a anotação." });
  }
});
router.put("/modulos/:id/anotacao", requireAuth, async (req, res) => {
  try {
    await pool.query(
      `INSERT INTO trilha_anotacoes (user_id, modulo_id, texto, atualizado_em) VALUES ($1, $2, $3, now())
       ON CONFLICT (user_id, modulo_id) DO UPDATE SET texto = $3, atualizado_em = now()`,
      [req.user.id, req.params.id, req.body?.texto || ""]
    );
    res.json({ ok: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Erro ao salvar a anotação." });
  }
});

// =================================================================
// Administração — criar/editar conteúdo e ver o acompanhamento da equipe
// =================================================================

// Se o vídeo passar do limite (2GB por padrão), o multer dá um erro antes
// mesmo de chegar na rota. Também apaga qualquer pedaço de arquivo que já
// tinha sido escrito no disco antes do erro — sem isso, um upload que falha
// no meio do caminho fica ocupando espaço pra sempre, até o servidor lotar
// (foi exatamente isso que já aconteceu aqui uma vez).
function uploadVideoComErroAmigavel(req, res, next) {
  uploadVideo.single("video")(req, res, (err) => {
    if (err) {
      if (req.file) fs.unlink(path.join(uploadDir, req.file.filename), () => {});
      if (err.code === "LIMIT_FILE_SIZE") {
        return res.status(413).json({ error: "Esse vídeo é grande demais. Tente um arquivo menor ou comprimido." });
      }
      console.error(err);
      return res.status(500).json({ error: "Erro ao enviar o vídeo." });
    }
    next();
  });
}

// POST /api/trilha/modulos -> cria um treinamento novo (vídeo ou avaliação),
// já com destinatários e as perguntas (cada uma com EXATAMENTE 4 alternativas)
router.post("/modulos", requireAuth, requireAdmin, uploadVideoComErroAmigavel, async (req, res) => {
  const { title, description, tipo } = req.body || {};
  const tipoFinal = tipo === "avaliacao" ? "avaliacao" : "video";

  if (!title?.trim()) {
    if (req.file) fs.unlink(path.join(uploadDir, req.file.filename), () => {});
    return res.status(400).json({ error: "Escreva um título." });
  }
  if (tipoFinal === "video" && !req.file) {
    return res.status(400).json({ error: "Escolha o vídeo (ou mude o tipo para Avaliação)." });
  }

  let userIds = [];
  let perguntas = [];
  try {
    if (req.body.userIds) userIds = JSON.parse(req.body.userIds);
    if (req.body.perguntas) perguntas = JSON.parse(req.body.perguntas);
  } catch {
    if (req.file) fs.unlink(path.join(uploadDir, req.file.filename), () => {});
    return res.status(400).json({ error: "Dados de destinatários ou perguntas inválidos." });
  }
  // Cada pergunta precisa ter exatamente 4 alternativas, com uma marcada como certa
  if (perguntas.length > 6) {
    if (req.file) fs.unlink(path.join(uploadDir, req.file.filename), () => {});
    return res.status(400).json({ error: "No máximo 6 perguntas por treinamento." });
  }
  for (const p of perguntas) {
    if (!p.question?.trim() || !Array.isArray(p.opcoes) || p.opcoes.length !== 4 || !p.opcoes.some((o) => o.isCorrect) || p.opcoes.some((o) => !o.text?.trim())) {
      if (req.file) fs.unlink(path.join(uploadDir, req.file.filename), () => {});
      return res.status(400).json({ error: "Cada pergunta precisa de texto, exatamente 4 alternativas preenchidas e uma marcada como certa." });
    }
  }

  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const { rows: maxRows } = await client.query(`SELECT COALESCE(MAX(order_index), -1) + 1 AS proximo FROM trilha_modulos`);
    const { rows } = await client.query(
      `INSERT INTO trilha_modulos (title, description, tipo, video_url, video_name, order_index, created_by)
       VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING id`,
      [
        title.trim(), description?.trim() || null, tipoFinal,
        req.file ? `/uploads/${req.file.filename}` : null,
        req.file ? req.file.originalname : null,
        maxRows[0].proximo, req.user.id,
      ]
    );
    const moduloId = rows[0].id;

    for (const userId of userIds) {
      await client.query(`INSERT INTO trilha_modulo_destinatarios (modulo_id, user_id) VALUES ($1, $2)`, [moduloId, userId]);
    }

    for (let i = 0; i < perguntas.length; i++) {
      const p = perguntas[i];
      const { rows: pRows } = await client.query(
        `INSERT INTO trilha_perguntas (modulo_id, question, order_index) VALUES ($1, $2, $3) RETURNING id`,
        [moduloId, p.question.trim(), i]
      );
      const perguntaId = pRows[0].id;
      for (let j = 0; j < p.opcoes.length; j++) {
        await client.query(
          `INSERT INTO trilha_opcoes (pergunta_id, text, is_correct, order_index) VALUES ($1, $2, $3, $4)`,
          [perguntaId, p.opcoes[j].text, !!p.opcoes[j].isCorrect, j]
        );
      }
    }

    await client.query("COMMIT");
    res.status(201).json({ id: moduloId });
  } catch (err) {
    await client.query("ROLLBACK");
    if (req.file) fs.unlink(path.join(uploadDir, req.file.filename), () => {});
    console.error(err);
    res.status(500).json({ error: "Erro ao criar o treinamento." });
  } finally {
    client.release();
  }
});

// DELETE /api/trilha/modulos/:id
router.delete("/modulos/:id", requireAuth, requireAdmin, async (req, res) => {
  try {
    await pool.query(`DELETE FROM trilha_modulos WHERE id = $1`, [req.params.id]);
    res.json({ ok: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Erro ao apagar o treinamento." });
  }
});

// POST /api/trilha/modulos/:id/perguntas -> adiciona uma pergunta (4 alternativas)
router.post("/modulos/:id/perguntas", requireAuth, requireAdmin, async (req, res) => {
  const { question, opcoes } = req.body || {};
  if (!question?.trim() || !Array.isArray(opcoes) || opcoes.length !== 4 || !opcoes.some((o) => o.isCorrect) || opcoes.some((o) => !o.text?.trim())) {
    return res.status(400).json({ error: "Escreva a pergunta, as 4 alternativas e marque a correta." });
  }
  const { rows: contagemRows } = await pool.query(`SELECT COUNT(*)::int AS total FROM trilha_perguntas WHERE modulo_id = $1`, [req.params.id]);
  if (contagemRows[0].total >= 6) {
    return res.status(400).json({ error: "Esse treinamento já tem 6 perguntas — esse é o máximo permitido." });
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

// GET /api/trilha/admin/progresso -> tela de acompanhamento detalhada: cada
// pessoa, cada treinamento, status/data/nota/acertos/erros
router.get("/admin/progresso", requireAuth, requireAdmin, async (req, res) => {
  try {
    const { rows: pessoas } = await pool.query(`SELECT id, name, avatar_url, color FROM users WHERE active = true ORDER BY name`);
    const { rows: modulos } = await pool.query(`SELECT id, title, tipo, order_index FROM trilha_modulos ORDER BY order_index, id`);
    const { rows: progresso } = await pool.query(
      `SELECT user_id, modulo_id, passou, ultima_nota, video_assistido, concluido_em FROM trilha_progresso`
    );
    const { rows: destinatarios } = await pool.query(`SELECT modulo_id, user_id FROM trilha_modulo_destinatarios`);
    // acertos/erros por pessoa+treinamento, pra mostrar na tela
    const { rows: contagens } = await pool.query(
      `SELECT p.modulo_id, t.user_id,
              COUNT(*) FILTER (WHERE t.acertou)::int AS acertos,
              COUNT(*) FILTER (WHERE NOT t.acertou AND t.finalizada)::int AS erros
       FROM trilha_pergunta_tentativas t
       JOIN trilha_perguntas p ON p.id = t.pergunta_id
       GROUP BY p.modulo_id, t.user_id`
    );

    const chave = (u, m) => `${u}-${m}`;
    const progressoMap = new Map(progresso.map((p) => [chave(p.user_id, p.modulo_id), p]));
    const contagemMap = new Map(contagens.map((c) => [chave(c.user_id, c.modulo_id), c]));

    const destinatariosPorModulo = new Map();
    destinatarios.forEach((d) => {
      if (!destinatariosPorModulo.has(d.modulo_id)) destinatariosPorModulo.set(d.modulo_id, new Set());
      destinatariosPorModulo.get(d.modulo_id).add(d.user_id);
    });

    const modulosComDestino = modulos.map((m) => ({
      ...m,
      restritoA: destinatariosPorModulo.has(m.id) ? [...destinatariosPorModulo.get(m.id)] : null,
    }));

    const linhas = pessoas.map((pessoa) => ({
      pessoa,
      modulos: modulosComDestino.map((m) => {
        if (m.restritoA && !m.restritoA.includes(pessoa.id)) return null; // não era pra essa pessoa
        const prog = progressoMap.get(chave(pessoa.id, m.id));
        const cont = contagemMap.get(chave(pessoa.id, m.id)) || { acertos: 0, erros: 0 };
        return {
          concluido: !!prog?.concluido_em,
          concluidoEm: prog?.concluido_em || null,
          nota: prog?.ultima_nota ?? null,
          acertos: cont.acertos,
          erros: cont.erros,
        };
      }),
    }));

    // Médias e % de conclusão por treinamento, pra tela de acompanhamento geral
    const resumoModulos = modulosComDestino.map((m) => {
      const pessoasAlvo = m.restritoA ? pessoas.filter((p) => m.restritoA.includes(p.id)) : pessoas;
      const concluidos = pessoasAlvo.filter((p) => progressoMap.get(chave(p.id, m.id))?.concluido_em);
      const notas = concluidos.map((p) => progressoMap.get(chave(p.id, m.id))?.ultima_nota).filter((n) => n != null);
      return {
        moduloId: m.id,
        totalPessoas: pessoasAlvo.length,
        concluidos: concluidos.length,
        percentualConclusao: pessoasAlvo.length > 0 ? Math.round((concluidos.length / pessoasAlvo.length) * 100) : 0,
        mediaNota: notas.length > 0 ? Math.round(notas.reduce((a, b) => a + b, 0) / notas.length) : null,
      };
    });

    res.json({ modulos: modulosComDestino, linhas, resumoModulos });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Erro ao carregar o acompanhamento." });
  }
});

module.exports = router;
