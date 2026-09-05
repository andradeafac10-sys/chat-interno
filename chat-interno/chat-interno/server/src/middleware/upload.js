const path = require("path");
const fs = require("fs");
const multer = require("multer");

const uploadDir = path.join(__dirname, "..", "..", "uploads");
fs.mkdirSync(uploadDir, { recursive: true });

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, uploadDir),
  filename: (req, file, cb) => {
    const safe = Date.now() + "-" + Math.round(Math.random() * 1e9) + path.extname(file.originalname);
    cb(null, safe);
  },
});

const upload = multer({
  storage,
  limits: { fileSize: Number(process.env.MAX_UPLOAD_SIZE || 20 * 1024 * 1024) },
});

// Upload de vídeo precisa de um limite bem maior que o padrão de anexo comum
// (20MB não dá nem pra 1 minuto de vídeo decente). 500MB por padrão, dá pra
// ajustar depois via variável de ambiente sem mexer no código.
const uploadVideo = multer({
  storage,
  limits: { fileSize: Number(process.env.MAX_VIDEO_UPLOAD_SIZE || 500 * 1024 * 1024) },
});

module.exports = { upload, uploadVideo, uploadDir };
