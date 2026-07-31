import { useGuardedAsyncAction } from "@vita-os/ui/hooks/use-guarded-async-action";

import { SignInForm } from "@/features/auth/sign-in/sign-in-form";
import { useSignIn } from "@/features/auth/use-sign-in";
import { useSocialProviders } from "@/features/auth/use-social-providers";

export function SignInScreen() {
  const signIn = useSignIn();
  const providers = useSocialProviders();
  const {
    run: runSignIn,
    isPending: isSigningIn,
    error: signInError,
  } = useGuardedAsyncAction(signIn, { errorToast: false });

  return (
    <SignInForm
      error={signInError ?? ""}
      loading={isSigningIn}
      providers={providers}
      onSubmit={async ({ email, password }) => {
        await runSignIn({ email, password });
      }}
    />
  );
}
