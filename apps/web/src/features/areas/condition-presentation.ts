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

// Badge/trigger treatment: critical is a solid fill so it cannot be missed;
// the other two stay tinted so color marks state without shouting.
export const conditionPillClassName: Record<Condition, string> = {
  healthy:
    "border-condition-healthy/35 bg-condition-healthy/10 text-condition-healthy",
  needs_attention:
    "border-condition-attention/35 bg-condition-attention/12 text-condition-attention",
  critical:
    "border-condition-critical bg-condition-critical text-condition-critical-foreground",
};
