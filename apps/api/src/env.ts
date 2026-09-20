export type WorkerEnv = Pick<
  Env,
  "BETTER_AUTH_SECRET" | "BETTER_AUTH_URL" | "BROWSER_ORIGIN" | "DB"
>;
