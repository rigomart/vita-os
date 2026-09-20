import { authClient } from "@/lib/auth-client";

/**
 * Whether somebody is signed in, and whether we know yet.
 *
 * The route layouts gate on this: while the session is still being established
 * they show the verifying state rather than deciding, so a reload never flashes
 * the sign-in screen at somebody who is already signed in.
 */
export function useSessionGate(): {
  isAuthenticated: boolean;
  isLoading: boolean;
} {
  const { data, isPending } = authClient.useSession();

  return {
    isAuthenticated: data !== null && data !== undefined,
    isLoading: isPending,
  };
}
