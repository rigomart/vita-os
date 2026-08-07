import { useDroppable } from "@dnd-kit/core";
import { cn } from "@vita-os/ui/lib/utils";
import { Inbox } from "lucide-react";
import { type ReactNode } from "react";

/**
 * The undated tray.
 *
 * Undated Threads are perfectly valid, so this is a peer of the board rather
 * than a seventh cramped column: a full-width shelf that is both a drag source
 * (schedule these) and a drop target (clear a Follow-up).
 */

export interface NoDateTrayProps {
  children: ReactNode;
  count: number;
}

export function NoDateTray({ children, count }: NoDateTrayProps) {
  const { isOver, setNodeRef } = useDroppable({ id: "horizon:none" });

  return (
    <section
      aria-label="No date"
      ref={setNodeRef}
      className={cn(
        "mt-3 rounded-xl border border-dashed transition-colors",
        isOver
          ? "border-primary/60 bg-primary/6"
          : "border-border/70 bg-surface-2/30",
      )}
    >
      <header className="flex flex-wrap items-baseline gap-x-2 gap-y-1 px-3.5 pt-3 pb-2.5">
        <Inbox className="size-3.5 translate-y-0.5 text-muted-foreground/70" />
        <h3 className="font-heading text-[13px] font-semibold tracking-tight">
          No date
        </h3>
        <span className="text-xs text-muted-foreground tabular-nums">
          {count}
        </span>
        <p className="ml-auto text-[11px] text-muted-foreground/70">
          {isOver
            ? "Drop to clear the Follow-up"
            : "Still valid — drag one onto a horizon when you're ready to re-engage."}
        </p>
      </header>

      {count === 0 ? (
        <p className="px-3.5 pb-4 text-[11px] text-muted-foreground/45">
          Everything has a horizon.
        </p>
      ) : (
        <div className="grid max-h-56 grid-cols-1 gap-2 overflow-y-auto px-3 pb-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {children}
        </div>
      )}
    </section>
  );
}
