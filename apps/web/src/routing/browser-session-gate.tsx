import { Navigate } from "@tanstack/react-router";
import { lazy, type PropsWithChildren, Suspense } from "react";

import { AuthVerifyingLoader } from "@/components/auth/auth-verifying-loader";
import { useSessionGate } from "@/lib/session";

const SharedNoteCapture = lazy(() =>
  import("../sharing/shared-note-capture").then((module) => ({
    default: module.SharedNoteCapture,
  })),
);

/**
 * The browser's answer to "is somebody here?", in front of the product.
 *
 * The shared application asks a host to wrap its authenticated screens in this;
 * everything it decides — Better Auth's session, the verifying state, and this
 * host's own sign-in address — belongs to the browser and travels no further.
 */
export function BrowserSessionGate({ children }: PropsWithChildren) {
  const { isAuthenticated, isLoading } = useSessionGate();

  if (isLoading) {
    return <AuthVerifyingLoader />;
  }

  if (!isAuthenticated) {
    return <Navigate to="/sign-in" />;
  }

  return (
    <Suspense fallback={<AuthVerifyingLoader />}>
      <SharedNoteCapture>{children}</SharedNoteCapture>
    </Suspense>
  );
}
