import { createFileRoute, Navigate } from "@tanstack/react-router";

import { RouteErrorFallback } from "@/components/error-boundary";
// PROTOTYPE (issue #291): remove.
import { useInboxPrototype } from "@/components/layout/prototype/inbox-prototype-context";
import { InboxScreen } from "@/features/inbox/screens/inbox-screen";

export const Route = createFileRoute("/_authenticated/inbox")({
  head: () => ({
    meta: [{ title: "Inbox | Vita OS" }],
  }),
  errorComponent: RouteErrorFallback,
  component: InboxRoute,
});

function InboxRoute() {
  // PROTOTYPE (issue #291): remove — /inbox survives as a deep link by landing
  // on the Dashboard with the summoned surface already open.
  const { summons } = useInboxPrototype();
  if (summons) {
    // Functional updater so /inbox?thread=abc keeps the Thread rail open.
    return (
      <Navigate to="/" search={(prev) => ({ ...prev, inbox: true })} replace />
    );
  }

  return <InboxScreen />;
}
