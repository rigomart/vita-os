import { createAuthClient } from "better-auth/react";

import { API_BASE_URL } from "@/lib/env";

import { versionAwareFetch } from "./version-aware-fetch";

/**
 * Better Auth in the browser.
 *
 * It talks to the API Worker's own auth routes, and the session cookie it keeps
 * is what authenticates every application request. Authentication lives here, in
 * the browser host: the shared application knows only that it was handed an
 * already-authenticated client.
 */
export const authClient = createAuthClient({
  baseURL: API_BASE_URL,
  fetchOptions: { customFetchImpl: versionAwareFetch.fetch },
});
