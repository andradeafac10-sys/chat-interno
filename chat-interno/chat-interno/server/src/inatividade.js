const { pool } = require("./db");

// Dias úteis (seg-sex) sem acesso: conta os dias úteis entre o último acesso e hoje,
// sem contar o dia do último acesso nem o dia de hoje.
function diasUteisSemAcesso(ultimo, agora = new Date()) {
  const d = new Date(ultimo.getFullYear(), ultimo.getMonth(), ultimo.getDate() + 1);
  const hoje = new Date(agora.getFullYear(), agora.getMonth(), agora.getDate());
  let n = 0;
  while (d < hoje) {
    const w = d.getDay();
    if (w >= 1 && w <= 5) n++;
    d.setDate(d.getDate() + 1);
  }
  return n;
}

const LIMITE_DIAS_UTEIS = 3;

// Administrador master: nunca é desativado automaticamente
const norm = (t) => String(t || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().trim().replace(/\s+/g, " ");
const ehMaster = (u) => norm(u.name).startsWith("andre andrade");

async function desativarInativos() {
  const { rows } = await pool.query(
    "SELECT id, name, role, last_seen_at FROM users WHERE active = true AND last_seen_at IS NOT NULL ORDER BY (role = 'admin'), id"
  );
  let admins = rows.filter((u) => u.role === "admin").length;
  let feitos = 0;
  for (const u of rows) {
    if (ehMaster(u)) continue;
    if (diasUteisSemAcesso(new Date(u.last_seen_at)) < LIMITE_DIAS_UTEIS) continue;
    if (u.role === "admin") {
      if (admins <= 1) continue; // nunca deixa o painel sem administrador ativo
      admins--;
    }
    await pool.query("UPDATE users SET active = false, auto_inativado_em = now() WHERE id = $1", [u.id]);
    console.log(`[inatividade] ${u.name} desativado (sem acesso desde ${new Date(u.last_seen_at).toLocaleDateString("pt-BR")}).`);
    feitos++;
  }
  return feitos;
}

module.exports = { desativarInativos, diasUteisSemAcesso };
