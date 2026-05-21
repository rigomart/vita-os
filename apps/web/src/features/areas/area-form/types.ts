import type { Doc } from "@convex/_generated/dataModel";

export type AreaFormValue = {
  name: string;
  standard?: string;
  condition: Doc<"areas">["condition"];
};
