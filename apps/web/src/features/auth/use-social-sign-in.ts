import { useCallback } from "react";

import { getAuthErrorMessage } from "@/features/auth/auth-result";
import { authClient } from "@/lib/auth-client";

export type SocialProviderId = "github" | "google";

export function useSocialSignIn(provider: SocialProviderId) {
  return useCallback(async () => {
    // Better Auth resolves relative callbacks against the API origin, so the
    // provider would return to the API instead of this app.
    const origin = window.location.origin;
    const result = await authClient.signIn.social({
      provider,
      callbackURL: `${origin}/`,
      errorCallbackURL: `${origin}/sign-in`,
    });

    const errorMessage = getAuthErrorMessage(result);
    if (errorMessage) {
      throw new Error(errorMessage);
    }
  }, [provider]);
}
