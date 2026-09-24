import { betterAuth } from "better-auth";

import type { WorkerEnv } from "./env";

export function createAuth(env: WorkerEnv) {
  return betterAuth({
    database: env.DB,
    secret: env.BETTER_AUTH_SECRET,
    baseURL: env.BETTER_AUTH_URL,
    trustedOrigins: [env.BROWSER_ORIGIN],
    emailAndPassword: { enabled: true, requireEmailVerification: false },
    socialProviders: getSocialProviders(env),
  });
}

export function getSocialProviders(env: WorkerEnv) {
  const github = socialCredentials(
    env.GITHUB_CLIENT_ID,
    env.GITHUB_CLIENT_SECRET,
    "GitHub",
  );
  const google = socialCredentials(
    env.GOOGLE_CLIENT_ID,
    env.GOOGLE_CLIENT_SECRET,
    "Google",
  );
  return {
    ...(github ? { github } : {}),
    ...(google
      ? { google: { ...google, prompt: "select_account" as const } }
      : {}),
  };
}

function socialCredentials(
  clientId: string | undefined,
  clientSecret: string | undefined,
  provider: string,
) {
  if (!clientId && !clientSecret) return undefined;
  if (!clientId || !clientSecret) {
    throw new Error(
      `${provider} authentication requires both client ID and secret.`,
    );
  }
  return { clientId, clientSecret };
}
