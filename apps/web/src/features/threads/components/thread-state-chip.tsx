import type { ProjectedThread } from "@convex/lib/validators";

import { CircleCheck, CircleDashed } from "lucide-react";

import { cn } from "@/lib/utils";

/** The Thread's lifecycle state, stated in the header instead of implied. */
export function ThreadStateChip({
  state,
}: {
  state: ProjectedThread["state"];
}) {
  const isResolved = state === "resolved";

  return (
    <span
      data-slot="thread-state-chip"
      className={cn(
        "flex shrink-0 items-center gap-1.5 text-[11px]",
        isResolved ? "text-condition-healthy" : "text-muted-foreground",
      )}
    >
      {isResolved ? (
        <CircleCheck aria-hidden className="size-3" />
      ) : (
        <CircleDashed aria-hidden className="size-3" />
      )}
      {isResolved ? "Resolved" : "Open"}
    </span>
  );
}
