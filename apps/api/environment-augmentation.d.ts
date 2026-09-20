import type { D1Migration } from "cloudflare:test";

declare global {
  interface Env {
    BETTER_AUTH_SECRET: string;
    BETTER_AUTH_URL: string;
    BROWSER_ORIGIN: string;
  }

  namespace Cloudflare {
    interface Env {
      BETTER_AUTH_SECRET: string;
      BETTER_AUTH_URL: string;
      BROWSER_ORIGIN: string;
      TEST_MIGRATIONS: D1Migration[];
    }
  }
}

export {};
