import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import { apiMiddleware } from "./vite-api-plugin.js";

export default defineConfig({
  plugins: [react(), tailwindcss(), apiMiddleware()],
  server: {
    host: true,
    allowedHosts: true,
    port: 5173,
    strictPort: true,
  },
});
