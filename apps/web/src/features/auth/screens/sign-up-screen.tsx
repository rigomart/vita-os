import { useState } from "react";
import { SignUpForm } from "@/features/auth/sign-up/sign-up-form";
import { useGitHubSignIn } from "@/features/auth/use-github-sign-in";
import { useSignUp } from "@/features/auth/use-sign-up";

export function SignUpScreen() {
  const signUp = useSignUp();
  const signInWithGitHub = useGitHubSignIn();
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  return (
    <SignUpForm
      error={error}
      loading={loading}
      onGitHub={() => void signInWithGitHub()}
      onSubmit={async ({ name, email, password }) => {
        setError("");
        setLoading(true);
        await signUp({
          name,
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
