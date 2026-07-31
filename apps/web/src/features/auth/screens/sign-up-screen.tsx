import { useGuardedAsyncAction } from "@vita-os/ui/hooks/use-guarded-async-action";

import { SignUpForm } from "@/features/auth/sign-up/sign-up-form";
import { useSignUp } from "@/features/auth/use-sign-up";
import { useSocialProviders } from "@/features/auth/use-social-providers";

export function SignUpScreen() {
  const signUp = useSignUp();
  const providers = useSocialProviders();
  const {
    run: runSignUp,
    isPending: isSigningUp,
    error: signUpError,
  } = useGuardedAsyncAction(signUp, { errorToast: false });

  return (
    <SignUpForm
      error={signUpError ?? ""}
      loading={isSigningUp}
      providers={providers}
      onSubmit={async ({ name, email, password }) => {
        await runSignUp({ name, email, password });
      }}
    />
  );
}
