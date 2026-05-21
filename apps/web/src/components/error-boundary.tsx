import type { ErrorComponentProps } from "@tanstack/react-router";

import { Button } from "@vita-os/ui/components/button";

export function RouteErrorFallback({ reset }: ErrorComponentProps) {
  return (
    <div className="py-16 text-center">
      <p className="text-sm text-muted-foreground">Something went wrong.</p>
      <Button variant="outline" size="sm" className="mt-3" onClick={reset}>
        Try again
      </Button>
    </div>
  );
}
