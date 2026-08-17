// PROTOTYPE (issue #291) — THROWAWAY CODE, do not ship.
//
// The shared innards of every candidate surface: a compact header with a close
// button, and the whole `InboxScreen` under it in its own scroll container.
// Mounting the real screen — not a copy — is what buys full capability parity
// (processing dialog, inline text/When/done/discard, Done history + Load more).

import { Button } from "@vita-os/ui/components/button";
import { X } from "lucide-react";

import { InboxScreen } from "@/features/inbox/screens/inbox-screen";
import { cn } from "@/lib/utils";

export function InboxSurfaceBody({
  onClose,
  className,
  bodyClassName,
}: {
  onClose: () => void;
  className?: string;
  bodyClassName?: string;
}) {
  return (
    <div className={cn("flex min-h-0 flex-1 flex-col", className)}>
      <header className="flex shrink-0 items-center justify-between gap-2 border-b px-4 py-2.5">
        <h2 className="font-heading text-sm font-semibold tracking-tight">
          Inbox
        </h2>
        <Button
          variant="ghost"
          size="icon-sm"
          onClick={onClose}
          aria-label="Close inbox"
        >
          <X />
        </Button>
      </header>
      <div
        className={cn(
          "min-h-0 flex-1 overflow-y-auto px-4 py-3",
          bodyClassName,
        )}
      >
        <InboxScreen embedded />
      </div>
    </div>
  );
}
