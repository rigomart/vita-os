import { createAuthClient } from "better-auth/react";

export function createBrowserAuthClient(apiBaseUrl: string) {
  return createAuthClient({ baseURL: apiBaseUrl });
}
