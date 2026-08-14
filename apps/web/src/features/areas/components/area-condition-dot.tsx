import type { ProjectedArea } from "@convex/lib/validators";

import { conditionLabels } from "@convex/lib/condition";

import { conditionDotClassName } from "@/features/areas/condition-presentation";
import { cn } from "@/lib/utils";

/**
 * The Area's condition at its smallest: a signal dot for rows and headers that
 * already name the Area, so the health reads without spending a line on it.
 */
export function AreaConditionDot({
  condition,
  className,
}: {
  condition: ProjectedArea["condition"];
  className?: string;
}) {
  return (
    <>
      <span
        aria-hidden
        className={cn(
          "size-1.5 shrink-0 rounded-full",
          conditionDotClassName[condition],
          className,
        )}
      />
      <span className="sr-only">{conditionLabels[condition]}</span>
    </>
  );
}
