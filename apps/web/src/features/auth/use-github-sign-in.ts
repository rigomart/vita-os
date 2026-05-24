import { getAuthErrorMessage } from "@/features/auth/auth-result";
import { authClient } from "@/lib/auth-client";

export function useGitHubSignIn() {
  return async () => {
    const result = await authClient.signIn.social({
      provider: "github",
    });

    const errorMessage = getAuthErrorMessage(result);
    if (errorMessage) {
      throw new Error(errorMessage);
    }
  };
}
