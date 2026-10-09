import { defineConfig } from "drizzle-kit";

// Generate reviewed SQL only. Wrangler remains the sole migration runner;
// there are deliberately no connection credentials for push/migrate here.
export default defineConfig({
  dialect: "sqlite",
  schema: "./src/platform/d1/schema.ts",
  out: "./migrations",
  tablesFilter: [
    "areas",
    "threads",
    "activity_log_entries",
    "notes",
    "thread_notes",
  ],
});
