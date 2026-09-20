import { betterAuth } from "better-auth";

import type { WorkerEnv } from "./env";

export function createAuth(env: WorkerEnv) {
  return betterAuth({
    database: env.DB,
    secret: env.BETTER_AUTH_SECRET,
    baseURL: env.BETTER_AUTH_URL,
    trustedOrigins: [env.BROWSER_ORIGIN],
    emailAndPassword: { enabled: true, requireEmailVerification: false },
  });
}
