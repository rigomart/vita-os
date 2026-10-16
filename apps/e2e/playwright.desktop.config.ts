// Drives the built desktop app (apps/desktop) through Electron; it starts no web stack.
// Throwaway desktop specs go in scratch/desktop/: `bun run test:e2e:desktop scratch/desktop/try.spec.ts`.
import { defineConfig } from "@playwright/test";

import { DESKTOP_OUT } from "./src/desktop.ts";

export default defineConfig({
  testDir: ".",
  testMatch: ["tests/desktop/**/*.spec.ts", "scratch/desktop/**/*.spec.ts"],
  globalSetup: "./src/desktop-setup.ts",
  outputDir: `${DESKTOP_OUT}/playwright/results`,
  reporter: [
    ["list"],
    [
      "html",
      { open: "never", outputFolder: `${DESKTOP_OUT}/playwright/report` },
    ],
  ],
  timeout: 60_000,
  workers: 1,
  use: {
    actionTimeout: 10_000,
    trace: "retain-on-failure",
  },
});
