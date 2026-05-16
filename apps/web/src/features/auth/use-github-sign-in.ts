import { authClient } from "@/lib/auth-client";

export function useGitHubSignIn() {
  return () =>
    authClient.signIn.social({
      provider: "github",
    });
}
