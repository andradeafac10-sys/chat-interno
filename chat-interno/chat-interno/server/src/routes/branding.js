const express = require("express");
const multer = require("multer");
const { pool } = require("../db");
const { requireAuth, requireAdmin } = require("../middleware/auth");

const router = express.Router();

// Logo fica guardada no próprio banco (não em disco) pra não sumir quando o
// servidor reinicia/atualiza. Limite de 2MB, só imagem.
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 2 * 1024 * 1024 } });

let tabelaPronta = false;
async function garantirTabela() {
  if (tabelaPronta) return;
  await pool.query(`CREATE TABLE IF NOT EXISTS app_settings (key TEXT PRIMARY KEY, value TEXT, updated_at TIMESTAMPTZ NOT NULL DEFAULT now())`);
  tabelaPronta = true;
}

function requireSuperAdmin(req, res, next) {
  if (req.user.role !== "admin" || req.user.username !== "admin") {
    return res.status(403).json({ error: "Apenas o administrador principal pode fazer isso." });
  }
  next();
}

// GET /api/branding -> público (a tela de login também usa)
router.get("/", async (req, res) => {
  try {
    await garantirTabela();
    const { rows } = await pool.query("SELECT value FROM app_settings WHERE key = 'logo'");
    res.set("Cache-Control", "no-cache");
    res.json({ logo: rows[0]?.value || null });
  } catch (err) {
    console.error(err);
    res.json({ logo: null });
  }
});

// POST /api/branding/logo -> sobe/troca a logo
router.post("/logo", requireAuth, requireAdmin, requireSuperAdmin, (req, res) => {
  upload.single("logo")(req, res, async (err) => {
    if (err) return res.status(400).json({ error: err.code === "LIMIT_FILE_SIZE" ? "A logo passa de 2MB. Use uma imagem menor." : "Não foi possível receber a imagem." });
    const f = req.file;
    if (!f) return res.status(400).json({ error: "Escolha uma imagem." });
    if (!/^image\/(png|jpe?g|webp|svg\+xml)$/.test(f.mimetype)) return res.status(400).json({ error: "Use uma imagem PNG, JPG, WEBP ou SVG." });
    try {
      await garantirTabela();
      const dataUrl = `data:${f.mimetype};base64,${f.buffer.toString("base64")}`;
      await pool.query(
        `INSERT INTO app_settings (key, value, updated_at) VALUES ('logo', $1, now())
         ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = now()`,
        [dataUrl]
      );
      const io = req.app.get("io");
      io?.emit("branding:updated");
      res.json({ logo: dataUrl });
    } catch (e) {
      console.error(e);
      res.status(500).json({ error: "Erro ao salvar a logo." });
    }
  });
});

// DELETE /api/branding/logo -> remove a logo
router.delete("/logo", requireAuth, requireAdmin, requireSuperAdmin, async (req, res) => {
  try {
    await garantirTabela();
    await pool.query("DELETE FROM app_settings WHERE key = 'logo'");
    req.app.get("io")?.emit("branding:updated");
    res.json({ ok: true });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: "Erro ao remover a logo." });
  }
});

module.exports = router;
