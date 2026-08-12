import type { Doc, Id } from "@convex/_generated/dataModel";
import type { OptimisticLocalStore } from "convex/browser";

import { api } from "@convex/_generated/api";
import { nullsToUndefined } from "@convex/lib/patch";

import {
  nextOrder,
  patchById,
  patchQuery,
  removeById,
} from "@/features/shared/optimistic";

type Area = Doc<"areas">;

type CreateAreaArgs = {
  name: string;
  standard?: string;
  condition: Area["condition"];
  icon: NonNullable<Area["icon"]>;
};

type NullablePatch<T> = {
  [K in keyof T]?: T[K] | null;
};

type AreaPatch = NullablePatch<
  Pick<Area, "name" | "standard" | "condition" | "icon">
>;

export function buildOptimisticArea(
  args: CreateAreaArgs,
  options: { id: Id<"areas">; now: number; order: number },
): Area {
  return {
    _id: options.id,
    _creationTime: options.now,
    userId: "",
    name: args.name,
    standard: args.standard,
    condition: args.condition,
    icon: args.icon,
    order: options.order,
    createdAt: options.now,
  };
}

export function optimisticallyCreateArea(
  localStore: OptimisticLocalStore,
  args: CreateAreaArgs,
): void {
  patchQuery(localStore, api.areas.list, {}, (areas) => [
    ...areas,
    buildOptimisticArea(args, {
      id: crypto.randomUUID() as Id<"areas">,
      now: Date.now(),
      order: nextOrder(areas),
    }),
  ]);
}

export function optimisticallyUpdateArea(
  localStore: OptimisticLocalStore,
  args: { id: Id<"areas"> } & AreaPatch,
  options: { areaSlug: string },
): void {
  const { id, ...updates } = args;
  const patch = nullsToUndefined(updates);

  patchQuery(localStore, api.areas.list, {}, (areas) =>
    patchById(areas, id, patch),
  );
  patchQuery(localStore, api.areas.get, { id }, (area) => ({
    ...area,
    ...patch,
  }));
  patchQuery(
    localStore,
    api.areas.getBySlug,
    { slug: options.areaSlug },
    (area) => ({ ...area, ...patch }),
  );
}

export function optimisticallyRemoveArea(
  localStore: OptimisticLocalStore,
  args: { id: Id<"areas"> },
  options: { areaSlug: string },
): void {
  patchQuery(localStore, api.areas.list, {}, (areas) =>
    removeById(areas, args.id),
  );
  localStore.setQuery(api.areas.get, { id: args.id }, null);
  localStore.setQuery(api.areas.getBySlug, { slug: options.areaSlug }, null);
}
