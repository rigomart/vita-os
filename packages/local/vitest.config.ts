import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    // These tests migrate and copy real SQLite files. On CI, beside every
    // other package's tests, one takes 2-5 seconds, past Vitest's default 5.
    testTimeout: 20_000,
  },
});
