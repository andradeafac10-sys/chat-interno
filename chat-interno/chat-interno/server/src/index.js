require("dotenv").config();
const express = require("express");
const http = require("http");
const path = require("path");
const cors = require("cors");
const helmet = require("helmet");
const rateLimit = require("express-rate-limit");
const { Server } = require("socket.io");

const authRoutes = require("./routes/auth");
const userRoutes = require("./routes/users");
const groupRoutes = require("./routes/groups");
const conversationRoutes = require("./routes/conversations");
const announcementRoutes = require("./routes/announcements");
const monitoringRoutes = require("./routes/monitoring");
const maintenanceRoutes = require("./routes/maintenance");
const gestaoRoutes = require("./routes/gestao");
const { setupSockets } = require("./sockets");

const app = express();
const server = http.createServer(app);

const clientOrigin = process.env.CLIENT_ORIGIN || "http://localhost:5173";

const io = new Server(server, {
  cors: { origin: clientOrigin, credentials: true },
});
app.set("io", io);

app.use(helmet({ crossOriginResourcePolicy: false }));
app.use(cors({ origin: clientOrigin, credentials: true }));
app.use(express.json({ limit: "2mb" }));

// 300/min era baixo demais pra quem usa VPN corporativa (várias pessoas saem pelo
// mesmo endereço de internet, e a soma de todo mundo passava do limite — chegando
// a bloquear até o login). Bem mais folgado agora, mesmo assim protegendo contra abuso.
const limiter = rateLimit({ windowMs: 60 * 1000, max: 3000 });
app.use("/api", limiter);

// maxAge: arquivos enviados nunca mudam de conteúdo (cada envio tem nome único),
// então pode guardar em cache por bastante tempo — evita recarregar a mesma
// imagem toda vez que a tela atualiza.
app.use("/uploads", express.static(path.join(__dirname, "..", "uploads"), { maxAge: "7d", immutable: true }));

app.get("/api/health", (req, res) => res.json({ ok: true }));
// Muda toda vez que o servidor reinicia (ou seja, toda vez que sai uma atualização nova).
// O site usa isso pra avisar a pessoa "tem versão nova" sem precisar dar F5 sozinho.
const SERVER_STARTED_AT = Date.now();
app.get("/api/version", (req, res) => res.json({ version: SERVER_STARTED_AT }));
app.use("/api/auth", authRoutes);
app.use("/api/users", userRoutes);
app.use("/api/groups", groupRoutes);
app.use("/api/conversations", conversationRoutes);
app.use("/api/announcements", announcementRoutes);
app.use("/api/monitoring", monitoringRoutes);
app.use("/api/maintenance", maintenanceRoutes);
app.use("/api/gestao", gestaoRoutes);
const gestaoTasksRoutes = require("./routes/gestaoTasks");
app.use("/api/gestao/tasks", gestaoTasksRoutes);
const { router: gestaoRecurrencesRoutes, gerarTodasAsOcorrencias } = require("./routes/gestaoRecurrences");
app.use("/api/gestao/recurrences", gestaoRecurrencesRoutes);

setupSockets(io);

// Gera as ocorrências das rotinas ativas ao ligar o servidor, e depois de tempos
// em tempos (a cada 6h) — é seguro rodar várias vezes, nunca duplica.
setTimeout(() => {
  gerarTodasAsOcorrencias()
    .then((n) => n > 0 && console.log(`[rotinas] ${n} ocorrência(s) gerada(s) na inicialização.`))
    .catch((err) => console.error("[rotinas] erro ao gerar ocorrências na inicialização:", err));
}, 5000);
setInterval(() => {
  gerarTodasAsOcorrencias()
    .then((n) => n > 0 && console.log(`[rotinas] ${n} ocorrência(s) gerada(s).`))
    .catch((err) => console.error("[rotinas] erro ao gerar ocorrências:", err));
}, 6 * 60 * 60 * 1000);

const PORT = process.env.PORT || 4000;
server.listen(PORT, () => console.log(`Servidor rodando na porta ${PORT}`));
