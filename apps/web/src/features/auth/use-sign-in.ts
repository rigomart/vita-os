import { useNavigate } from "@tanstack/react-router";
import { useCallback } from "react";

import { getAuthErrorMessage } from "@/features/auth/auth-result";
import { authClient } from "@/lib/auth-client";

export function useSignIn() {
  const navigate = useNavigate();

  return useCallback(
    async (input: { email: string; password: string }) => {
      const result = await authClient.signIn.email({
        email: input.email,
        password: input.password,
      });
      const errorMessage = getAuthErrorMessage(result);

      if (errorMessage) {
        throw new Error(errorMessage);
      }

      navigate({ to: "/" });
    },
    [navigate],
  );
}
