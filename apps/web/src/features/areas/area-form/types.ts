import type { AreaIcon } from "@vita-os/contracts";
import type { AreaSummary } from "@vita-os/contracts";

export type AreaFormValue = {
  name: string;
  standard?: string;
  condition: AreaSummary["condition"];
  icon: AreaIcon;
};
