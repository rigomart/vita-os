import type { D1Migration } from "cloudflare:test";

declare global {
  interface Env {
    BETTER_AUTH_SECRET: string;
    BETTER_AUTH_URL: string;
    BROWSER_ORIGIN: string;
    GITHUB_CLIENT_ID?: string;
    GITHUB_CLIENT_SECRET?: string;
    GOOGLE_CLIENT_ID?: string;
    GOOGLE_CLIENT_SECRET?: string;
  }

  namespace Cloudflare {
    interface Env {
      BETTER_AUTH_SECRET: string;
      BETTER_AUTH_URL: string;
      BROWSER_ORIGIN: string;
      GITHUB_CLIENT_ID?: string;
      GITHUB_CLIENT_SECRET?: string;
      GOOGLE_CLIENT_ID?: string;
      GOOGLE_CLIENT_SECRET?: string;
      TEST_MIGRATIONS: D1Migration[];
    }
  }
}

export {};
