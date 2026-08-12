import type { AreaIcon } from "@convex/lib/areaIcons";
import type { ProjectedArea } from "@convex/lib/validators";

export type AreaFormValue = {
  name: string;
  standard?: string;
  condition: ProjectedArea["condition"];
  icon: AreaIcon;
};
