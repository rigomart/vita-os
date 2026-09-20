function requireEnv(name: string, value: string | undefined): string {
  if (!value) {
    throw new Error(
      `Missing environment variable ${name}. Set it in apps/web/.env.local (see apps/web/.env.example).`,
    );
  }
  return value;
}

/**
 * Where the Vita OS API lives.
 *
 * One origin serves both Better Auth's browser routes and the application
 * operations, so the browser host needs exactly this one piece of runtime
 * configuration.
 */
export const API_BASE_URL = requireEnv(
  "VITE_API_BASE_URL",
  import.meta.env.VITE_API_BASE_URL,
);
