function requireEnv(name: string, value: string | undefined): string {
  if (!value) {
    throw new Error(
      `Missing environment variable ${name}. Set it in apps/web/.env.local (see apps/web/.env.example).`,
    );
  }
  return value;
}

export const CONVEX_URL = requireEnv(
  "VITE_CONVEX_URL",
  import.meta.env.VITE_CONVEX_URL,
);

export const CONVEX_SITE_URL = requireEnv(
  "VITE_CONVEX_SITE_URL",
  import.meta.env.VITE_CONVEX_SITE_URL,
);
