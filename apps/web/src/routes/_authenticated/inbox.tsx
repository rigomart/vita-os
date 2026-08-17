import { createFileRoute } from "@tanstack/react-router";

import { RouteErrorFallback } from "@/components/error-boundary";
import { InboxDeepLinkRedirect } from "@/features/inbox/surface/inbox-deep-link-redirect";

export const Route = createFileRoute("/_authenticated/inbox")({
  errorComponent: RouteErrorFallback,
  component: InboxDeepLinkRedirect,
});
