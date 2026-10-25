import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// Versão do build: vai embutida no código e também num arquivo version.json.
// O navegador compara os dois e se recarrega sozinho quando sai versão nova.
const BUILD = String(Date.now());

export default defineConfig({
  plugins: [
    react(),
    {
      name: "version-json",
      generateBundle() {
        this.emitFile({ type: "asset", fileName: "version.json", source: JSON.stringify({ version: BUILD }) });
      },
    },
  ],
  define: { __APP_VERSION__: JSON.stringify(BUILD) },
  server: { port: 5173 },
  preview: { host: true, allowedHosts: true },
});
