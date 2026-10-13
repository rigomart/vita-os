// Runs against the verify instance global setup starts or reuses; it stays up (`bun run verify down` stops it).
// Throwaway specs go in scratch/ (gitignored): `bun run test:e2e scratch/try.spec.ts`.
import { defineConfig } from "@playwright/test";

import { instanceName, instancePaths } from "./src/instance.ts";

const out = instancePaths(instanceName()).playwrightDir;

export default defineConfig({
  testDir: ".",
  testMatch: ["tests/**/*.spec.ts", "scratch/**/*.spec.ts"],
  globalSetup: "./src/global-setup.ts",
  outputDir: `${out}/results`,
  reporter: [
    ["list"],
    ["html", { open: "never", outputFolder: `${out}/report` }],
  ],
  timeout: 60_000,
  // Concurrent `wrangler d1 execute --local` reads of one instance fail with "internal error".
  workers: 1,
  use: {
    channel: "chrome",
    actionTimeout: 10_000,
    viewport: { width: 1440, height: 900 },
    screenshot: "only-on-failure",
    trace: "retain-on-failure",
  },
});
