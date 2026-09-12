import type { AreaSummary, Thread } from "@vita-os/contracts";

/** Contract-shaped values that can also receive not-yet-migrated Convex data. */
export type ThreadView = Omit<Thread, "_id" | "areaId"> & {
  _id: string;
  areaId: string;
};

export type AreaView = Omit<AreaSummary, "_id"> & {
  _id: string;
};
