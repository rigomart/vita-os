/// <reference types="vitest/config" />
import babel from "@rolldown/plugin-babel";
import tailwindcss from "@tailwindcss/vite";
import { tanstackRouter } from "@tanstack/router-plugin/vite";
import react, { reactCompilerPreset } from "@vitejs/plugin-react";
import { defineConfig } from "vite";

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
      {
        // Convex functions run in the Convex runtime, which convex-test
        // approximates with the edge runtime rather than jsdom.
        extends: true,
        test: {
          name: "convex",
          include: ["convex/**/*.test.ts"],
          globals: true,
          environment: "edge-runtime",
          server: {
            // Both ship raw TypeScript that Vite has to transform, and
            // `@convex-dev/better-auth/test` needs `import.meta.glob`.
            deps: { inline: ["convex-test", "@convex-dev/better-auth"] },
          },
        },
      },
    ],
  },
  preview: {
    port: 5173,
  },
});
