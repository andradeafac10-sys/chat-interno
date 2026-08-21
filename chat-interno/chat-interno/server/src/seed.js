// Cria o banco (schema) e um usuário ADM inicial + operadores de exemplo.
// Rode com: npm run seed
require("dotenv").config();
const fs = require("fs");
const path = require("path");
const bcrypt = require("bcryptjs");
const { pool } = require("./db");

async function run() {
  const schema = fs.readFileSync(path.join(__dirname, "schema.sql"), "utf8");
  await pool.query(schema);
  console.log("✔ Tabelas criadas/verificadas.");

  const { rows: existingAdmins } = await pool.query("SELECT id FROM users WHERE role = 'admin' LIMIT 1");
  if (existingAdmins.length > 0) {
    console.log("Já existe um ADM cadastrado — seed não vai duplicar usuários.");
    process.exit(0);
  }

  const adminPass = await bcrypt.hash("admin123", 10);
  await pool.query(
    `INSERT INTO users (name, username, password_hash, role, color) VALUES ($1,$2,$3,'admin',$4)`,
    ["Administrador", "admin", adminPass, "#2F6FED"]
  );
  console.log("✔ ADM criado -> usuário: admin | senha: admin123 (TROQUE essa senha depois de logar)");

  const opPass = await bcrypt.hash("operador123", 10);
  const operadoresExemplo = [
    ["Carlos Souza", "carlos", "#0EA5A5"],
    ["Bruna Alves", "bruna", "#D97706"],
  ];
  for (const [name, username, color] of operadoresExemplo) {
    await pool.query(
      `INSERT INTO users (name, username, password_hash, role, color) VALUES ($1,$2,$3,'operator',$4)
       ON CONFLICT (username) DO NOTHING`,
      [name, username, opPass, color]
    );
  }
  console.log("✔ Operadores de exemplo criados -> senha padrão: operador123");

  process.exit(0);
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
