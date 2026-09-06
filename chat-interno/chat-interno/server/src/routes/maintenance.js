const express = require("express");
const fs = require("fs");
const path = require("path");
const { pool } = require("../db");
const { requireAuth } = require("../middleware/auth");

const router = express.Router();

// Só o usuário "admin" (o dono do sistema) pode usar essas ações destrutivas.
function requireSuperAdmin(req, res, next) {
  if (req.user.role !== "admin" || req.user.username !== "admin") {
    return res.status(403).json({ error: "Apenas o administrador principal pode fazer isso." });
  }
  next();
}

// Remove do disco os arquivos que não são mais referenciados por nada
async function limparArquivosOrfaos() {
  const uploadDir = path.join(__dirname, "..", "..", "uploads");
  if (!fs.existsSync(uploadDir)) return;

  const emUso = new Set();
  const coletar = (rows, campo) => rows.forEach((r) => r[campo] && emUso.add(path.basename(r[campo])));

  coletar((await pool.query("SELECT file_url FROM messages WHERE file_url IS NOT NULL")).rows, "file_url");
  coletar((await pool.query("SELECT image_url FROM announcements WHERE image_url IS NOT NULL")).rows, "image_url");
  coletar((await pool.query("SELECT avatar_url FROM users WHERE avatar_url IS NOT NULL")).rows, "avatar_url");
  coletar((await pool.query("SELECT avatar_url FROM groups WHERE avatar_url IS NOT NULL")).rows, "avatar_url");
  coletar((await pool.query("SELECT file_url FROM group_attachments")).rows, "file_url");

  for (const nome of fs.readdirSync(uploadDir)) {
    if (nome.startsWith(".")) continue;
    if (!emUso.has(nome)) {
      try { fs.unlinkSync(path.join(uploadDir, nome)); } catch (err) { /* ignora */ }
    }
  }
}

// DELETE /api/maintenance/messages -> apaga TODAS as mensagens de TODAS as conversas
router.delete("/messages", requireAuth, requireSuperAdmin, async (req, res) => {
  try {
    await pool.query("DELETE FROM message_reactions");
    await pool.query("DELETE FROM messages");
    await limparArquivosOrfaos();

    const io = req.app.get("io");
    io.emit("maintenance:messages-cleared");

    res.json({ ok: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Erro ao limpar as mensagens." });
  }
});

// DELETE /api/maintenance/announcements -> apaga TODOS os comunicados
router.delete("/announcements", requireAuth, requireSuperAdmin, async (req, res) => {
  try {
    await pool.query("DELETE FROM announcement_acks");
    await pool.query("DELETE FROM announcement_targets");
    await pool.query("DELETE FROM announcements");
    await limparArquivosOrfaos();

    const io = req.app.get("io");
    io.emit("maintenance:announcements-cleared");

    res.json({ ok: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Erro ao limpar as notificações." });
  }
});

module.exports = router;
