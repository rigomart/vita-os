import { createFileRoute } from "@tanstack/react-router";

import { SignInScreen } from "@/features/auth/screens/sign-in-screen";

export const Route = createFileRoute("/_unauthenticated/sign-in")({
  head: () => ({
    meta: [
      { title: "Sign In | Vita OS" },
      {
        name: "description",
        content: "Sign in to your Vita OS account.",
      },
      { property: "og:title", content: "Sign In | Vita OS" },
      {
        property: "og:description",
        content: "Sign in to your Vita OS account.",
      },
    ],
  }),
  component: SignInRoute,
});

function SignInRoute() {
  return <SignInScreen />;
}
