import { useNavigate } from "@tanstack/react-router";
import { authClient } from "@/lib/auth-client";

export function useSignIn() {
  const navigate = useNavigate();

  return (input: {
    email: string;
    password: string;
    onError: (message: string) => void;
  }) =>
    authClient.signIn.email(
      { email: input.email, password: input.password },
      {
        onSuccess: () => {
          navigate({ to: "/" });
        },
        onError: (ctx) => {
          input.onError(ctx.error.message ?? "Sign in failed");
        },
      },
    );
}
