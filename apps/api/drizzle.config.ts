import { defineConfig } from "drizzle-kit";

// Generate reviewed SQL only. Wrangler applies it to D1 and `@vita-os/local`
// to a desktop file; there are deliberately no credentials for push/migrate here.
export default defineConfig({
  dialect: "sqlite",
  schema: "../../packages/operations/src/platform/sqlite/schema.ts",
  out: "./migrations",
  tablesFilter: [
    "areas",
    "threads",
    "activity_log_entries",
    "notes",
    "thread_notes",
  ],
});
