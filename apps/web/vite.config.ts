import { cloudflare } from "@cloudflare/vite-plugin";
import babel from "@rolldown/plugin-babel";
import tailwindcss from "@tailwindcss/vite";
import react, { reactCompilerPreset } from "@vitejs/plugin-react";
import { defineConfig } from "vitest/config";

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    // No route-file plugin: the product's routes are code-based and come from
    // `@vita-os/application`, and this host defines its own beside them.
    react(),
    cloudflare(),
    babel({
      presets: [reactCompilerPreset()],
    }),
    tailwindcss(),
  ],
  resolve: {
    alias: {
      "@": "/src",
    },
  },
  test: {
    passWithNoTests: true,
    projects: [
      {
        extends: true,
        test: {
          name: "web",
          include: ["src/**/*.test.{ts,tsx}"],
          globals: true,
          environment: "jsdom",
          setupFiles: ["./src/test/setup.ts"],
          css: true,
        },
      },
    ],
  },
  preview: {
    port: 5173,
  },
});
