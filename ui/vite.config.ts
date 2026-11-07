/// <reference types="vitest/config" />
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// pages are served by the go binary from web/dist; in dev, vite serves the
// pages and forwards the api to a running savolbor
export default defineConfig({
  plugins: [react()],
  build: {
    outDir: "../web/dist",
    emptyOutDir: true,
    rollupOptions: { input: { index: "index.html", host: "host.html" } },
  },
  server: {
    proxy: {
      "/api": "http://localhost:8080",
      "/qr.png": "http://localhost:8080",
    },
  },
  test: {
    environment: "jsdom",
    globals: true,
    restoreMocks: true,
  },
});
