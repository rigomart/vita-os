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
  density = "default",
}: {
  onClose: () => void;
  className?: string;
  bodyClassName?: string;
  /** `compact` tightens container spacing for the small popover panel only. */
  density?: "default" | "compact";
}) {
  const compact = density === "compact";

  return (
    <div className={cn("flex min-h-0 flex-1 flex-col", className)}>
      <header
        className={cn(
          "flex shrink-0 items-center justify-between gap-2 border-b",
          compact ? "px-3 py-1.5" : "px-4 py-2.5",
        )}
      >
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
      {/* The compact rules reach one level into the embedded screen — the task
          list's own root > (header, sections) — so the panel can be tightened
          without changing the shared list for the other forms. */}
      <div
        className={cn(
          "min-h-0 flex-1 overflow-y-auto",
          compact
            ? "px-3 py-2 [&>div>div]:gap-4 [&>div>header]:mb-2"
            : "px-4 py-3",
          bodyClassName,
        )}
      >
        <InboxScreen embedded />
      </div>
    </div>
  );
}
