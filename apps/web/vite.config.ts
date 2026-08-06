/// <reference types="vitest/config" />
import babel from "@rolldown/plugin-babel";
import tailwindcss from "@tailwindcss/vite";
import { tanstackRouter } from "@tanstack/router-plugin/vite";
import react, { reactCompilerPreset } from "@vitejs/plugin-react";
import { realpathSync } from "node:fs";
import { defineConfig, searchForWorkspaceRoot } from "vite";

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    tanstackRouter({
      target: "react",
      autoCodeSplitting: true,
    }),
    react(),
    babel({
      presets: [reactCompilerPreset()],
    }),
    tailwindcss(),
  ],
  resolve: {
    alias: {
      "@": "/src",
      "@convex": "/convex",
    },
  },
  test: {
    globals: true,
    environment: "jsdom",
    setupFiles: ["./src/test/setup.ts"],
    css: true,
    passWithNoTests: true,
  },
  server: {
    fs: {
      // Worktrees symlink node_modules to the main checkout; allow serving
      // assets (fonts) from the resolved location outside the worktree.
      allow: [
        searchForWorkspaceRoot(process.cwd()),
        realpathSync(`${searchForWorkspaceRoot(process.cwd())}/node_modules`),
      ],
    },
  },
  preview: {
    port: 5173,
  },
});
