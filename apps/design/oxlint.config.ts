import { defineConfig } from "oxlint";

import { sharedOxlintConfig } from "../../oxlint.config.ts";

export default defineConfig({
  extends: [sharedOxlintConfig],
});
