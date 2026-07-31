import { useGuardedAsyncAction } from "@vita-os/ui/hooks/use-guarded-async-action";

import type { SocialProviderOption } from "@/features/auth/auth-card-shell";

import { useSocialSignIn } from "@/features/auth/use-social-sign-in";

export function useSocialProviders(): SocialProviderOption[] {
  const signInWithGitHub = useSocialSignIn("github");
  const signInWithGoogle = useSocialSignIn("google");
  const {
    run: runGitHubSignIn,
    isPending: isGitHubPending,
    error: githubError,
  } = useGuardedAsyncAction(signInWithGitHub, { errorToast: false });
  const {
    run: runGoogleSignIn,
    isPending: isGooglePending,
    error: googleError,
  } = useGuardedAsyncAction(signInWithGoogle, { errorToast: false });

  return [
    {
      id: "github",
      name: "GitHub",
      error: githubError ?? "",
      loading: isGitHubPending,
      onClick: () => void runGitHubSignIn(),
    },
    {
      id: "google",
      name: "Google",
      error: googleError ?? "",
      loading: isGooglePending,
      onClick: () => void runGoogleSignIn(),
    },
  ];
}
