import { createFileRoute } from "@tanstack/react-router";

import { RouteErrorFallback } from "@/components/error-boundary";
import { InboxScreen } from "@/features/inbox/screens/inbox-screen";

export const Route = createFileRoute("/_authenticated/inbox")({
  head: () => ({
    meta: [{ title: "Inbox | Vita OS" }],
  }),
  errorComponent: RouteErrorFallback,
  component: InboxRoute,
});

function InboxRoute() {
  return <InboxScreen />;
}
