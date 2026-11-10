import path from "node:path";
import { fileURLToPath } from "node:url";
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

const rootDir = path.dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  plugins: [react()],
  resolve: {
    // pnpm puts react under packages/ui + packages/engine — force one copy
    dedupe: ["react", "react-dom", "react-router-dom"],
    alias: {
      react: path.resolve(rootDir, "node_modules/react"),
      "react-dom": path.resolve(rootDir, "node_modules/react-dom"),
    },
  },
  server: {
    port: 5173,
    strictPort: true,
    host: "127.0.0.1",
    proxy: {
      "/v1": "http://127.0.0.1:4100",
      "/health": "http://127.0.0.1:4100",
    },
  },
  preview: { port: 4173 },
});
