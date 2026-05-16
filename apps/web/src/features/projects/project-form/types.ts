import type { Id } from "@convex/_generated/dataModel";

export type ProjectFormValue = {
  name: string;
  definitionOfDone?: string;
  areaId: Id<"areas">;
};

export type CreatedProjectResult = {
  slug: string;
  areaId: Id<"areas">;
};
