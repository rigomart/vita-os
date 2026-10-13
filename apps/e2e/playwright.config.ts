// End-to-end specs for Vita OS, against an isolated verify instance (VITA_INSTANCE, default main) that global setup
// starts, or reuses when it is already up; it stays up afterwards (`bun run verify down` stops it).
//
// Specs live in tests/. Throwaway specs for exploring go in scratch/ (gitignored, not type-checked) and run the same
// way: `bun run test:e2e scratch/try.spec.ts`. Results, traces, and the HTML report go to
// .verify/instances/<name>/playwright/.
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
  // One at a time: concurrent `wrangler d1 execute --local` reads of one instance fail with "internal error".
  workers: 1,
  use: {
    channel: "chrome",
    actionTimeout: 10_000,
    viewport: { width: 1440, height: 900 },
    screenshot: "only-on-failure",
    trace: "retain-on-failure",
  },
});
