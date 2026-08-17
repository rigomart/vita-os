import { Button } from "@vita-os/ui/components/button";
import { X } from "lucide-react";

import { InboxScreen } from "@/features/inbox/screens/inbox-screen";
import { cn } from "@/lib/utils";

interface InboxSurfaceBodyProps {
  onClose: () => void;
  className?: string;
  bodyClassName?: string;
  /** `compact` tightens container spacing for the narrow popover panel. */
  density?: "default" | "compact";
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
  density = "default",
}: InboxSurfaceBodyProps) {
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
      <div
        className={cn(
          "min-h-0 flex-1 overflow-y-auto",
          compact ? "px-3 py-2" : "px-4 py-3",
          bodyClassName,
        )}
      >
        <InboxScreen density={density} />
      </div>
    </div>
  );
}
