import { createFileRoute } from "@tanstack/react-router";
import { RouteErrorFallback } from "@vita-os/application";
import { InboxDeepLinkRedirect } from "@vita-os/application";

export const Route = createFileRoute("/_authenticated/inbox")({
  errorComponent: RouteErrorFallback,
  component: InboxDeepLinkRedirect,
});
