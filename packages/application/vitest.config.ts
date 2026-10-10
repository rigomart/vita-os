import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "jsdom",
    globals: true,
    include: ["src/**/*.test.{ts,tsx}"],
    setupFiles: ["./src/test/setup.ts"],
    // Components import the UI library's stylesheets alongside their markup.
    css: true,
    // The live-preview editor ships extensionless ESM imports, which only a
    // bundler resolves.
    server: { deps: { inline: ["@atomic-editor/editor"] } },
  },
});
