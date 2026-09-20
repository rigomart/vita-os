import { cloudflareTest, readD1Migrations } from "@cloudflare/vitest-plugin";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

const projectDirectory = dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  plugins: [
    cloudflareTest(async () => ({
      wrangler: { configPath: "./wrangler.jsonc" },
      miniflare: {
        bindings: {
          BETTER_AUTH_SECRET: "test-secret-must-be-at-least-32-characters",
          BETTER_AUTH_URL: "http://api.test",
          BROWSER_ORIGIN: "http://browser.test",
          TEST_MIGRATIONS: await readD1Migrations(
            join(projectDirectory, "migrations"),
          ),
        },
      },
    })),
  ],
  test: {
    setupFiles: ["./test/apply-migrations.ts"],
  },
});
