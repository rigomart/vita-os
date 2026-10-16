import babel from "@rolldown/plugin-babel";
import tailwindcss from "@tailwindcss/vite";
import react, { reactCompilerPreset } from "@vitejs/plugin-react";
import { defineConfig } from "vitest/config";

// Builds the renderer only; scripts/build-main.ts builds main and the preload.
export default defineConfig({
  plugins: [
    react(),
    babel({
      presets: [reactCompilerPreset()],
    }),
    tailwindcss(),
  ],
  // The product's screens load the browser host's assets, like its logo.
  publicDir: "../web/public",
  build: {
    outDir: "dist/renderer",
    emptyOutDir: true,
  },
  test: {
    include: ["src/**/*.test.ts"],
    environment: "node",
  },
  server: {
    port: 5175,
    strictPort: true,
  },
});
