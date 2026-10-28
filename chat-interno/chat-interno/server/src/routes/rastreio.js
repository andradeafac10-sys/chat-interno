// Rastreio de links de SMS (encurtador próprio).
// O SMS leva um link curto único por cliente (ex: .../r/aB3x9Q). Quando a pessoa
// clica, registramos o clique (data/hora, aparelho) e redirecionamos na hora
// pro link de destino (wa.link). Relatório sai em CSV, pronto pro Excel.
const express = require("express");
const crypto = require("crypto");
const path = require("path");
const multer = require("multer");
const { pool } = require("../db");
const { requireAuth, requireAdmin } = require("../middleware/auth");

const router = express.Router();
const uploadMem = multer({ storage: multer.memoryStorage(), limits: { fileSize: 60 * 1024 * 1024 } });

// ---------- Tabelas (idempotente) ----------
let tabelasProntas = null;
function garantirTabelas() {
  if (!tabelasProntas) {
    tabelasProntas = pool.query(`
      CREATE TABLE IF NOT EXISTS sms_links (
        codigo VARCHAR(12) PRIMARY KEY,
        campanha TEXT NOT NULL,
        destino TEXT NOT NULL,
        telefone TEXT,
        cpf TEXT,
        nome TEXT,
        extra JSONB,
        criado_por INTEGER,
        criado_em TIMESTAMPTZ NOT NULL DEFAULT now()
      );
      CREATE INDEX IF NOT EXISTS idx_sms_links_campanha ON sms_links (campanha);
      CREATE TABLE IF NOT EXISTS sms_cliques (
        id BIGSERIAL PRIMARY KEY,
        codigo VARCHAR(12) NOT NULL REFERENCES sms_links(codigo) ON DELETE CASCADE,
        clicado_em TIMESTAMPTZ NOT NULL DEFAULT now(),
        ip TEXT,
        user_agent TEXT,
        robo BOOLEAN NOT NULL DEFAULT false
      );
      CREATE INDEX IF NOT EXISTS idx_sms_cliques_codigo ON sms_cliques (codigo);
    `).catch((err) => { tabelasProntas = null; throw err; });
  }
  return tabelasProntas;
}

// ---------- Utilidades ----------
const ALFABETO = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789"; // sem 0/O/1/l/I
function gerarCodigo(tam = 6) {
  const bytes = crypto.randomBytes(tam);
  let s = "";
  for (let i = 0; i < tam; i++) s += ALFABETO[bytes[i] % ALFABETO.length];
  return s;
}

// Robôs de pré-visualização de link (não são clique de gente de verdade)
const REGEX_ROBO = /bot|crawl|spider|preview|facebookexternalhit|whatsapp|telegram|slack|discord|skype|curl|wget|python|java\/|go-http|okhttp|headless|lighthouse|scanner|monitor/i;

function normalizar(s) {
  return String(s || "").normalize("NFD").replace(/[̀-ͯ]/g, "").trim().toUpperCase();
}

// Lê CSV (separador ; ou , ou TAB — detecta sozinho), respeitando aspas
function lerCSV(texto) {
  texto = texto.replace(/^﻿/, "");
  const primeiraLinha = texto.split(/\r?\n/)[0] || "";
  const cont = (c) => primeiraLinha.split(c).length;
  const sep = [";", ",", "\t"].sort((a, b) => cont(b) - cont(a))[0];
  const linhas = [];
  let campo = "", linha = [], aspas = false;
  for (let i = 0; i < texto.length; i++) {
    const c = texto[i];
    if (aspas) {
      if (c === '"' && texto[i + 1] === '"') { campo += '"'; i++; }
      else if (c === '"') aspas = false;
      else campo += c;
    } else if (c === '"' && campo === "") aspas = true;
    else if (c === sep) { linha.push(campo); campo = ""; }
    else if (c === "\n" || c === "\r") {
      if (c === "\r" && texto[i + 1] === "\n") i++;
      linha.push(campo); campo = "";
      if (linha.some((v) => v.trim() !== "")) linhas.push(linha);
      linha = [];
    } else campo += c;
  }
  linha.push(campo);
  if (linha.some((v) => v.trim() !== "")) linhas.push(linha);
  return linhas;
}

function csvCelula(v) {
  const s = v === null || v === undefined ? "" : String(v);
  return /[";\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}
function enviarCSV(res, nome, cabecalho, linhas) {
  const corpo = [cabecalho, ...linhas].map((l) => l.map(csvCelula).join(";")).join("\r\n");
  res.setHeader("Content-Type", "text/csv; charset=utf-8");
  res.setHeader("Content-Disposition", `attachment; filename="${nome}"`);
  res.send("﻿" + corpo);
}

function acharColuna(cab, opcoes) {
  const n = cab.map(normalizar);
  for (const o of opcoes) { const i = n.indexOf(o); if (i >= 0) return i; }
  for (const o of opcoes) { const i = n.findIndex((c) => c.includes(o)); if (i >= 0) return i; }
  return -1;
}

function dataBR(d) {
  if (!d) return "";
  return new Date(d).toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo" }).replace(",", "");
}

function baseUrl(req) {
  return (process.env.RASTREIO_BASE_URL || `${req.protocol}://${req.get("host")}`).replace(/\/+$/, "");
}

// ---------- Redirecionamento público: GET /r/:codigo ----------
async function redirecionar(req, res) {
  const codigo = String(req.params.codigo || "").slice(0, 12);
  try {
    await garantirTabelas();
    const { rows } = await pool.query("SELECT destino FROM sms_links WHERE codigo = $1", [codigo]);
    if (!rows[0]) return res.status(404).send("Link inválido ou expirado.");
    const ua = String(req.get("user-agent") || "").slice(0, 500);
    pool.query(
      "INSERT INTO sms_cliques (codigo, ip, user_agent, robo) VALUES ($1, $2, $3, $4)",
      [codigo, req.ip, ua, !ua || REGEX_ROBO.test(ua)]
    ).catch((err) => console.error("[rastreio] erro ao gravar clique:", err.message));
    res.setHeader("Cache-Control", "no-store");
    return res.redirect(302, rows[0].destino);
  } catch (err) {
    console.error("[rastreio] erro no redirecionamento:", err);
    return res.status(500).send("Erro ao abrir o link. Tente novamente.");
  }
}

// ---------- Página do rastreio (login ADM + upload + relatório) ----------
function pagina(req, res) {
  res.setHeader(
    "Content-Security-Policy",
    "default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; connect-src 'self'; img-src 'self' data:"
  );
  res.sendFile(path.join(__dirname, "..", "rastreio.html"));
}

// ---------- API (só ADM) ----------
router.use(requireAuth, requireAdmin);

// Gera os links curtos a partir do CSV de disparo
// Campos: arquivo (CSV), campanha (texto), destino (link padrão, se o CSV não tiver coluna LINK)
router.post("/gerar", uploadMem.single("arquivo"), async (req, res) => {
  try {
    await garantirTabelas();
    const campanha = String(req.body.campanha || "").trim();
    const destinoPadrao = String(req.body.destino || "").trim();
    if (!campanha) return res.status(400).json({ error: "Informe o nome da campanha." });
    if (!req.file) return res.status(400).json({ error: "Envie o arquivo CSV do disparo." });

    if (req.file.buffer.slice(0, 2).toString() === "PK") {
      return res.status(400).json({ error: "Esse arquivo é Excel (.xlsx). Salve como CSV e envie de novo." });
    }
    // CSV do Excel BR às vezes vem em Latin-1 (acentos quebrados) — detecta e converte
    let texto = req.file.buffer.toString("utf8");
    if (texto.includes("\uFFFD")) texto = req.file.buffer.toString("latin1");
    const linhas = lerCSV(texto);
    if (linhas.length < 2) return res.status(400).json({ error: "Arquivo vazio ou sem cabeçalho." });
    const cab = linhas[0].map((c) => c.trim());
    const iTel = acharColuna(cab, ["TELEFONE", "CELULAR", "FONE", "NUMERO", "WHATSAPP", "PHONE", "TEL"]);
    const iCpf = acharColuna(cab, ["CPF/CNPJ", "CPF_CNPJ", "CPFCNPJ", "CPF", "CNPJ", "DOCUMENTO", "DOC"]);
    const iNome = acharColuna(cab, ["NOME", "CLIENTE", "RAZAO SOCIAL", "NAME"]);
    const iLink = acharColuna(cab, ["LINK", "URL", "DESTINO"]);
    if (iTel < 0) return res.status(400).json({ error: "Não achei a coluna de TELEFONE no arquivo." });
    if (iLink < 0 && !/^https?:\/\//i.test(destinoPadrao)) {
      return res.status(400).json({ error: "Informe o link de destino (ou coloque uma coluna LINK no arquivo)." });
    }

    const registros = [];
    for (const l of linhas.slice(1)) {
      const tel = String(l[iTel] || "").replace(/\D/g, "");
      if (!tel) continue;
      let destino = iLink >= 0 ? String(l[iLink] || "").trim() : "";
      if (!/^https?:\/\//i.test(destino)) destino = destinoPadrao;
      if (!/^https?:\/\//i.test(destino)) continue;
      registros.push({
        linha: l,
        telefone: tel,
        cpf: iCpf >= 0 ? String(l[iCpf] || "").trim() : "",
        nome: iNome >= 0 ? String(l[iNome] || "").trim() : "",
        destino,
      });
    }
    if (!registros.length) return res.status(400).json({ error: "Nenhuma linha válida (telefone + link) no arquivo." });

    // Grava em lotes; se algum código repetir (raríssimo), gera outro
    const LOTE = 500;
    for (let ini = 0; ini < registros.length; ini += LOTE) {
      let pendentes = registros.slice(ini, ini + LOTE);
      for (let tentativa = 0; pendentes.length && tentativa < 5; tentativa++) {
        pendentes.forEach((r) => (r.codigo = gerarCodigo()));
        const vals = [], params = [];
        pendentes.forEach((r, k) => {
          const b = k * 7;
          vals.push(`($${b + 1},$${b + 2},$${b + 3},$${b + 4},$${b + 5},$${b + 6},$${b + 7})`);
          params.push(r.codigo, campanha, r.destino, r.telefone, r.cpf, r.nome, req.user.id);
        });
        const { rows } = await pool.query(
          `INSERT INTO sms_links (codigo, campanha, destino, telefone, cpf, nome, criado_por)
           VALUES ${vals.join(",")} ON CONFLICT (codigo) DO NOTHING RETURNING codigo`,
          params
        );
        const ok = new Set(rows.map((r) => r.codigo));
        pendentes = pendentes.filter((r) => !ok.has(r.codigo));
      }
      if (pendentes.length) throw new Error("Falha ao gerar códigos únicos.");
    }

    const base = baseUrl(req);
    const nomeArq = `SMS_${normalizar(campanha).replace(/[^A-Z0-9]+/g, "_")}_LINKS.csv`;
    enviarCSV(res, nomeArq, [...cab, "LINK_RASTREIO"], registros.map((r) => [...r.linha, `${base}/r/${r.codigo}`]));
  } catch (err) {
    console.error("[rastreio] erro ao gerar:", err);
    res.status(500).json({ error: "Erro ao gerar os links." });
  }
});

// Lista de campanhas com resumo
router.get("/campanhas", async (req, res) => {
  try {
    await garantirTabelas();
    const { rows } = await pool.query(`
      SELECT l.campanha,
             MIN(l.criado_em) AS criada_em,
             COUNT(DISTINCT l.codigo) AS enviados,
             COUNT(DISTINCT c.codigo) FILTER (WHERE c.robo = false) AS clicaram,
             COUNT(c.id) FILTER (WHERE c.robo = false) AS cliques
      FROM sms_links l
      LEFT JOIN sms_cliques c ON c.codigo = l.codigo
      GROUP BY l.campanha
      ORDER BY MIN(l.criado_em) DESC
    `);
    res.json(rows);
  } catch (err) {
    console.error("[rastreio] erro ao listar:", err);
    res.status(500).json({ error: "Erro ao listar campanhas." });
  }
});

// Relatório CSV por cliente (?campanha=X ; vazio = todas)
router.get("/relatorio", async (req, res) => {
  try {
    await garantirTabelas();
    const campanha = String(req.query.campanha || "").trim();
    const { rows } = await pool.query(`
      SELECT l.campanha, l.nome, l.cpf, l.telefone, l.destino, l.codigo, l.criado_em,
             COUNT(c.id) FILTER (WHERE c.robo = false) AS cliques,
             MIN(c.clicado_em) FILTER (WHERE c.robo = false) AS primeiro,
             MAX(c.clicado_em) FILTER (WHERE c.robo = false) AS ultimo,
             COUNT(c.id) FILTER (WHERE c.robo = true) AS robos
      FROM sms_links l
      LEFT JOIN sms_cliques c ON c.codigo = l.codigo
      WHERE ($1 = '' OR l.campanha = $1)
      GROUP BY l.codigo
      ORDER BY (COUNT(c.id) FILTER (WHERE c.robo = false) > 0) DESC, MIN(c.clicado_em) ASC NULLS LAST, l.nome
    `, [campanha]);
    const base = baseUrl(req);
    const nomeArq = `RASTREIO_SMS_${campanha ? normalizar(campanha).replace(/[^A-Z0-9]+/g, "_") : "TODAS"}.csv`;
    enviarCSV(res, nomeArq,
      ["CAMPANHA", "NOME", "CPF/CNPJ", "TELEFONE", "CLICOU", "QTD CLIQUES", "PRIMEIRO CLIQUE", "ULTIMO CLIQUE", "LINK DESTINO", "LINK ENVIADO", "GERADO EM", "PREVIAS (ROBO)"],
      rows.map((r) => [
        r.campanha, r.nome, r.cpf, r.telefone,
        Number(r.cliques) > 0 ? "SIM" : "NAO", r.cliques,
        dataBR(r.primeiro), dataBR(r.ultimo),
        r.destino, `${base}/r/${r.codigo}`, dataBR(r.criado_em), r.robos,
      ])
    );
  } catch (err) {
    console.error("[rastreio] erro no relatório:", err);
    res.status(500).json({ error: "Erro ao gerar relatório." });
  }
});

// Log bruto de cada clique (?campanha=X)
router.get("/cliques", async (req, res) => {
  try {
    await garantirTabelas();
    const campanha = String(req.query.campanha || "").trim();
    const { rows } = await pool.query(`
      SELECT l.campanha, l.nome, l.cpf, l.telefone, l.destino, c.clicado_em, c.robo, c.user_agent
      FROM sms_cliques c JOIN sms_links l ON l.codigo = c.codigo
      WHERE ($1 = '' OR l.campanha = $1)
      ORDER BY c.clicado_em
    `, [campanha]);
    enviarCSV(res, "CLIQUES_SMS_DETALHADO.csv",
      ["CAMPANHA", "NOME", "CPF/CNPJ", "TELEFONE", "DATA/HORA", "TIPO", "LINK DESTINO", "APARELHO"],
      rows.map((r) => [r.campanha, r.nome, r.cpf, r.telefone, dataBR(r.clicado_em), r.robo ? "PREVIA (ROBO)" : "CLIQUE", r.destino, r.user_agent])
    );
  } catch (err) {
    console.error("[rastreio] erro no log de cliques:", err);
    res.status(500).json({ error: "Erro ao gerar log de cliques." });
  }
});

module.exports = { router, redirecionar, pagina, garantirTabelas };
