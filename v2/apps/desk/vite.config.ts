import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";

export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    port: 5174,
    // Bind IPv4 + IPv6 so http://localhost:5174 and http://127.0.0.1:5174 both work on Windows
    host: true,
    strictPort: true,
  },
  // Workspace packages export TS source — prebundling them freezes exports
  // (e.g. MorphTabs) until .vite is deleted. Serve them raw instead.
  optimizeDeps: {
    exclude: ["@hos-v2/ui", "@hos-v2/domain", "@ffmpeg/ffmpeg", "@ffmpeg/util"],
  },
  worker: {
    format: "es",
  },
  build: {
    chunkSizeWarningLimit: 900,
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (
            id.includes("node_modules/react/") ||
            id.includes("node_modules/react-dom/") ||
            id.includes("node_modules/react-router")
          ) {
            return "vendor-react";
          }
          if (id.includes("node_modules/motion")) {
            return "vendor-motion";
          }
          if (id.includes("node_modules/lucide-react")) {
            return "vendor-icons";
          }
          if (id.includes("node_modules/@tanstack")) {
            return "vendor-table";
          }
        },
      },
    },
  },
});
