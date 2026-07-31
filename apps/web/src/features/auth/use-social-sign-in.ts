import { useCallback } from "react";

import { getAuthErrorMessage } from "@/features/auth/auth-result";
import { authClient } from "@/lib/auth-client";

export type SocialProviderId = "github" | "google";

export function useSocialSignIn(provider: SocialProviderId) {
  return useCallback(async () => {
    const result = await authClient.signIn.social({
      provider,
    });

    const errorMessage = getAuthErrorMessage(result);
    if (errorMessage) {
      throw new Error(errorMessage);
    }
  }, [provider]);
}
