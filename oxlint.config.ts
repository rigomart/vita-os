import { defineConfig } from "oxlint";

export const sharedOxlintConfig = defineConfig({});

export default defineConfig({
  extends: [sharedOxlintConfig],
  options: {
    reportUnusedDisableDirectives: "error",
  },
});
