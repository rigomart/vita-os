import type { Condition } from "@convex/lib/condition";
import type { LucideIcon } from "lucide-react";

import { CircleCheck, OctagonAlert, TriangleAlert } from "lucide-react";

export const conditionIcons: Record<Condition, LucideIcon> = {
  healthy: CircleCheck,
  needs_attention: TriangleAlert,
  critical: OctagonAlert,
};

export const conditionTextClassName: Record<Condition, string> = {
  healthy: "text-condition-healthy",
  needs_attention: "text-condition-attention",
  critical: "text-condition-critical",
};

/** Smallest signal: a filled dot beside something that already names the Area. */
export const conditionDotClassName: Record<Condition, string> = {
  healthy: "bg-condition-healthy-fill",
  needs_attention: "bg-condition-attention-fill",
  critical: "bg-condition-critical-fill",
};

// Badge/trigger treatment: solid vivid fills — on the app's warm cream
// surfaces, low-alpha tints disappear into the background.
export const conditionPillClassName: Record<Condition, string> = {
  healthy:
    "border-transparent bg-condition-healthy-fill text-condition-healthy-fill-foreground",
  needs_attention:
    "border-transparent bg-condition-attention-fill text-condition-attention-fill-foreground",
  critical:
    "border-transparent bg-condition-critical-fill text-condition-critical-fill-foreground",
};
