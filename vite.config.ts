import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import path from "node:path";
import { fileURLToPath } from "node:url";

const dirname = path.dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  server: { allowedHosts: true },
  root: path.resolve(dirname, "client"),
  plugins: [react()],
  resolve: {
    alias: {
      "@": path.resolve(dirname, "client/src"),
      "@shared": path.resolve(dirname, "shared"),
    },
  },
  build: { outDir: path.resolve(dirname, "dist/public"), emptyOutDir: true, chunkSizeWarningLimit: 900 },
});
