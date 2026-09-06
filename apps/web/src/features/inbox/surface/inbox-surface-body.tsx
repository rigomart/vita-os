import { Button } from "@vita-os/ui/components/button";
import { X } from "lucide-react";

import { InboxScreen } from "@/features/inbox/screens/inbox-screen";
import { cn } from "@/lib/utils";

interface InboxSurfaceBodyProps {
  onClose: () => void;
  className?: string;
  bodyClassName?: string;
}

/**
 * A pinned header over the whole Inbox screen in its own scroll container.
 * Mounting the screen itself — not a copy of it — is what keeps every Inbox
 * capability alive in the summoned surface.
 */
export function InboxSurfaceBody({
  onClose,
  className,
  bodyClassName,
}: InboxSurfaceBodyProps) {
  return (
    <div className={cn("flex min-h-0 flex-1 flex-col", className)}>
      <header className="flex shrink-0 items-center justify-between gap-2 border-b px-3 py-1.5">
        <h2 className="font-heading text-sm font-semibold tracking-tight">
          Notes
        </h2>
        <Button
          variant="ghost"
          size="icon-sm"
          onClick={onClose}
          aria-label="Close notes"
        >
          <X />
        </Button>
      </header>
      <div
        className={cn(
          "min-h-0 flex-1 overflow-y-auto px-3 py-2",
          bodyClassName,
        )}
      >
        <InboxScreen />
      </div>
    </div>
  );
}
