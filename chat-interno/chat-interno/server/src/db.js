const { Pool } = require("pg");

// Railway/Render exigem SSL em produção; em desenvolvimento local geralmente não precisa.
const useSSL = (process.env.DATABASE_URL || "").includes("render.com") ||
               (process.env.DATABASE_URL || "").includes("railway") ||
               process.env.PGSSL === "true";

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: useSSL ? { rejectUnauthorized: false } : false,
});

module.exports = { pool };
