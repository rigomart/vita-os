import type { Doc } from "@convex/_generated/dataModel";

export type AreaFormValue = {
  name: string;
  standard?: string;
  healthStatus: Doc<"areas">["healthStatus"];
};
