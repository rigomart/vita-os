/// <reference types="vitest/config" />
import babel from "@rolldown/plugin-babel";
import tailwindcss from "@tailwindcss/vite";
import { tanstackRouter } from "@tanstack/router-plugin/vite";
import react, { reactCompilerPreset } from "@vitejs/plugin-react";
import { realpathSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { defineConfig, searchForWorkspaceRoot } from "vite";

const uiSrc = fileURLToPath(new URL("../../packages/ui/src", import.meta.url));

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
    // @vita-os/ui resolves to the sibling packages/ui rather than through
    // node_modules: in git worktrees node_modules is symlinked to the main
    // checkout, whose workspace link would otherwise serve the main
    // checkout's copy of the package instead of this tree's.
    alias: [
      { find: "@", replacement: "/src" },
      { find: "@convex", replacement: "/convex" },
      {
        find: "@vita-os/ui/globals.css",
        replacement: `${uiSrc}/styles/globals.css`,
      },
      {
        find: /^@vita-os\/ui\/components\/(.*)$/,
        replacement: `${uiSrc}/components/$1.tsx`,
      },
      { find: /^@vita-os\/ui\/lib\/(.*)$/, replacement: `${uiSrc}/lib/$1.ts` },
      {
        find: /^@vita-os\/ui\/hooks\/(.*)$/,
        replacement: `${uiSrc}/hooks/$1.ts`,
      },
    ],
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
