interface Env {
  DB: D1Database;
  BETTER_AUTH_SECRET: string;
  BETTER_AUTH_URL: string;
  BROWSER_ORIGIN: string;
  TEST_MIGRATIONS: D1Migration[];
}
