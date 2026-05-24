import { useGuardedAsyncAction } from "@vita-os/ui/hooks/use-guarded-async-action";

import { SignUpForm } from "@/features/auth/sign-up/sign-up-form";
import { useGitHubSignIn } from "@/features/auth/use-github-sign-in";
import { useSignUp } from "@/features/auth/use-sign-up";

export function SignUpScreen() {
  const signUp = useSignUp();
  const signInWithGitHub = useGitHubSignIn();
  const {
    run: runSignUp,
    isPending: isSigningUp,
    error: signUpError,
  } = useGuardedAsyncAction(signUp, { errorToast: false });
  const {
    run: runGitHubSignIn,
    isPending: isGitHubPending,
    error: githubError,
  } = useGuardedAsyncAction(signInWithGitHub, { errorToast: false });

  return (
    <SignUpForm
      error={signUpError ?? ""}
      githubError={githubError ?? ""}
      githubLoading={isGitHubPending}
      loading={isSigningUp}
      onGitHub={() => void runGitHubSignIn()}
      onSubmit={async ({ name, email, password }) => {
        await runSignUp({ name, email, password });
      }}
    />
  );
}
