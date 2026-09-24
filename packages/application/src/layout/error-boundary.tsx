import type { ErrorComponentProps } from "@tanstack/react-router";
import type { ErrorInfo, ReactNode } from "react";

import { Button } from "@vita-os/ui/components/button";
import { Component } from "react";

/** Inline recovery for a route body that failed while the app chrome around it still works. */
export function RouteErrorFallback({ reset }: ErrorComponentProps) {
  return (
    <div role="alert" className="py-16 text-center">
      <p className="text-sm text-muted-foreground">Something went wrong.</p>
      <Button variant="outline" size="sm" className="mt-3" onClick={reset}>
        Try again
      </Button>
    </div>
  );
}

function reloadPage() {
  window.location.reload();
}

/**
 * Full-page branded recovery for failures that take the whole page with them:
 * the root route, unauthenticated routes, and the provider stack above the router.
 */
export function AppErrorScreen({ onRetry }: { onRetry?: () => void }) {
  return (
    <div
      role="alert"
      className="flex min-h-svh flex-col items-center justify-center gap-6 px-4 text-center"
    >
      <div className="flex items-center gap-2">
        <img
          src="/vita-logo.svg"
          alt=""
          className="size-8 shrink-0 rounded-lg shadow-sm ring-1 ring-border"
        />
        <span className="flex items-baseline gap-1 leading-none">
          <span className="font-heading text-lg font-semibold tracking-tight">
            vita
          </span>
          <span className="text-2xs font-semibold tracking-[0.18em] text-muted-foreground uppercase">
            OS
          </span>
        </span>
      </div>
      <div className="space-y-1">
        <h1 className="font-heading text-xl font-semibold tracking-tight">
          Something went wrong
        </h1>
        <p className="max-w-sm text-sm text-muted-foreground">
          Vita OS hit an unexpected error. Reloading usually clears it — your
          data is safe.
        </p>
      </div>
      <div className="flex items-center gap-2">
        {onRetry ? (
          <Button variant="outline" onClick={onRetry}>
            Try again
          </Button>
        ) : null}
        <Button onClick={reloadPage}>Reload</Button>
      </div>
    </div>
  );
}

/** Router `errorComponent` for routes that render the whole viewport. */
export function AppErrorFallback({ reset }: ErrorComponentProps) {
  return <AppErrorScreen onRetry={reset} />;
}

interface AppErrorBoundaryState {
  hasError: boolean;
}

/**
 * The provider stack above `RouterProvider` sits outside the router's own
 * CatchBoundary, so a crash there blanks the page unless something catches it.
 */
export class AppErrorBoundary extends Component<
  { children: ReactNode },
  AppErrorBoundaryState
> {
  state: AppErrorBoundaryState = { hasError: false };

  static getDerivedStateFromError(): AppErrorBoundaryState {
    return { hasError: true };
  }

  componentDidCatch(error: unknown, info: ErrorInfo) {
    console.error("Unhandled error above the router", error, info);
  }

  render() {
    if (this.state.hasError) {
      // No retry: the crash is in the providers, so only a reload rebuilds them.
      return <AppErrorScreen />;
    }
    return this.props.children;
  }
}
