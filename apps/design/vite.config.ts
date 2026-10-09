import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vitest/config";

export default defineConfig({
  plugins: [react(), tailwindcss()],
  // The product's screens load the browser host's assets, like its logo.
  publicDir: "../web/public",
  resolve: {
    alias: {
      "@": "/src",
    },
  },
  test: {
    include: ["src/**/*.test.ts"],
    environment: "node",
  },
  server: {
    port: 5174,
  },
  preview: {
    port: 5174,
  },
});
