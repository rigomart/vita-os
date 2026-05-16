import { useState } from "react";
import { SignInForm } from "@/features/auth/sign-in/sign-in-form";
import { useGitHubSignIn } from "@/features/auth/use-github-sign-in";
import { useSignIn } from "@/features/auth/use-sign-in";

export function SignInScreen() {
  const signIn = useSignIn();
  const signInWithGitHub = useGitHubSignIn();
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  return (
    <SignInForm
      error={error}
      loading={loading}
      onGitHub={() => void signInWithGitHub()}
      onSubmit={async ({ email, password }) => {
        setError("");
        setLoading(true);
        await signIn({
          email,
          password,
          onError: (message) => {
            setError(message);
            setLoading(false);
          },
        });
      }}
    />
  );
}
