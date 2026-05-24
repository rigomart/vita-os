import { useGuardedAsyncAction } from "@vita-os/ui/hooks/use-guarded-async-action";

import { SignInForm } from "@/features/auth/sign-in/sign-in-form";
import { useGitHubSignIn } from "@/features/auth/use-github-sign-in";
import { useSignIn } from "@/features/auth/use-sign-in";

export function SignInScreen() {
  const signIn = useSignIn();
  const signInWithGitHub = useGitHubSignIn();
  const {
    run: runSignIn,
    isPending: isSigningIn,
    error: signInError,
  } = useGuardedAsyncAction(signIn, { errorToast: false });
  const {
    run: runGitHubSignIn,
    isPending: isGitHubPending,
    error: githubError,
  } = useGuardedAsyncAction(signInWithGitHub, { errorToast: false });

  return (
    <SignInForm
      error={signInError ?? ""}
      githubError={githubError ?? ""}
      githubLoading={isGitHubPending}
      loading={isSigningIn}
      onGitHub={() => void runGitHubSignIn()}
      onSubmit={async ({ email, password }) => {
        await runSignIn({ email, password });
      }}
    />
  );
}
