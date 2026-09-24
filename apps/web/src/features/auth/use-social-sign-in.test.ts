import { renderHook } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { useSocialSignIn } from "./use-social-sign-in";

const social = vi.hoisted(() => vi.fn());

vi.mock("@/lib/auth-client", () => ({
  authClient: { signIn: { social } },
}));

describe("useSocialSignIn", () => {
  it("returns from the provider to this app, not the API origin", async () => {
    social.mockResolvedValue({ data: { redirect: true }, error: null });
    const { result } = renderHook(() => useSocialSignIn("google"));

    await result.current();

    expect(social).toHaveBeenCalledWith({
      provider: "google",
      callbackURL: `${window.location.origin}/`,
      errorCallbackURL: `${window.location.origin}/sign-in`,
    });
  });
});
