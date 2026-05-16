import { createFileRoute } from "@tanstack/react-router";
import { SignUpScreen } from "@/features/auth/screens/sign-up-screen";

export const Route = createFileRoute("/_unauthenticated/sign-up")({
  head: () => ({
    meta: [
      { title: "Sign Up | Vita OS" },
      {
        name: "description",
        content: "Create a Vita OS account to get started.",
      },
      { property: "og:title", content: "Sign Up | Vita OS" },
      {
        property: "og:description",
        content: "Create a Vita OS account to get started.",
      },
    ],
  }),
  component: SignUpRoute,
});

function SignUpRoute() {
  return <SignUpScreen />;
}
