import type { Doc } from "@convex/_generated/dataModel";
import type { AreaIcon } from "@convex/lib/areaIcons";

export type AreaFormValue = {
  name: string;
  standard?: string;
  condition: Doc<"areas">["condition"];
  icon: AreaIcon;
};
