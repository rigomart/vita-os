import type { Doc, Id } from "@convex/_generated/dataModel";
import type { OptimisticLocalStore } from "convex/browser";
import type { FunctionReturnType } from "convex/server";

import { api } from "@convex/_generated/api";
import { nullsToUndefined } from "@convex/lib/patch";

import {
  nextOrder,
  patchAllQueries,
  patchById,
  patchQuery,
  removeById,
} from "@/features/shared/optimistic";

type Area = Doc<"areas">;

type AreaDetail = NonNullable<
  FunctionReturnType<typeof api.areas.detailBySlug>
>;

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

/**
 * Patch every cached `areas.detailBySlug` holding this Area. The composite is
 * keyed by slug while mutations name their target by `_id`, so the match runs
 * on the cached document instead of the args.
 */
export function patchAreaDetail(
  localStore: OptimisticLocalStore,
  areaId: Id<"areas">,
  patch: (detail: AreaDetail) => AreaDetail,
): void {
  patchAllQueries(localStore, api.areas.detailBySlug, (detail) =>
    detail.area._id === areaId ? patch(detail) : detail,
  );
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
): void {
  const { id, ...updates } = args;
  const patch = nullsToUndefined(updates);

  patchQuery(localStore, api.areas.list, {}, (areas) =>
    patchById(areas, id, patch),
  );
  patchAreaDetail(localStore, id, (detail) => ({
    ...detail,
    area: { ...detail.area, ...patch },
  }));
}

export function optimisticallyRemoveArea(
  localStore: OptimisticLocalStore,
  args: { id: Id<"areas"> },
): void {
  patchQuery(localStore, api.areas.list, {}, (areas) =>
    removeById(areas, args.id),
  );
  patchAllQueries(localStore, api.areas.detailBySlug, (detail) =>
    detail.area._id === args.id ? null : detail,
  );
}
