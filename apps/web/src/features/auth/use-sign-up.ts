import { useNavigate } from "@tanstack/react-router";
import { authClient } from "@/lib/auth-client";

export function useSignUp() {
  const navigate = useNavigate();

  return (input: {
    name: string;
    email: string;
    password: string;
    onError: (message: string) => void;
  }) =>
    authClient.signUp.email(
      { name: input.name, email: input.email, password: input.password },
      {
        onSuccess: () => {
          navigate({ to: "/" });
        },
        onError: (ctx) => {
          input.onError(ctx.error.message ?? "Sign up failed");
        },
      },
    );
}
