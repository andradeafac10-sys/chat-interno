import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  server: { port: 5173 },
  preview: { host: true, allowedHosts: true },
  // Desligado temporariamente: a minificação estava causando um erro real no
  // navegador ("Cannot access before initialization") que não aparecia no
  // código original, só depois de compactado. O site fica um pouco mais
  // pesado pra carregar, mas funciona certinho enquanto investigamos a causa
  // exata com mais calma.
  build: { minify: false },
});
