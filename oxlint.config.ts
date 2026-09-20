import { defineConfig } from "oxlint";

export const sharedOxlintConfig = defineConfig({});

export default defineConfig({
  extends: [sharedOxlintConfig],
  ignorePatterns: ["apps/api/worker-configuration.d.ts"],
  options: {
    reportUnusedDisableDirectives: "error",
  },
});
