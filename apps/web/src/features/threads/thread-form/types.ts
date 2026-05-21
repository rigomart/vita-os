import type { Id } from "@convex/_generated/dataModel";

export type ThreadFormValue = {
  title: string;
  summary?: string;
  areaId: Id<"areas">;
};

export type CreatedThreadResult = {
  slug: string;
  areaId: Id<"areas">;
};
