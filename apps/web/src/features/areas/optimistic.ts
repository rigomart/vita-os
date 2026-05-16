import { api } from "@convex/_generated/api";
import type { Doc, Id } from "@convex/_generated/dataModel";
import { nullsToUndefined } from "@convex/lib/patch";
import type { OptimisticLocalStore } from "convex/browser";
import { nextOrder, patchById, removeById } from "@/features/shared/optimistic";

type Area = Doc<"areas">;

type CreateAreaArgs = {
  name: string;
  standard?: string;
  healthStatus: Area["healthStatus"];
};

type NullablePatch<T> = {
  [K in keyof T]?: T[K] | null;
};

type AreaPatch = NullablePatch<
  Pick<Area, "name" | "standard" | "healthStatus">
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
    healthStatus: args.healthStatus,
    order: options.order,
    createdAt: options.now,
  };
}

export function optimisticallyCreateArea(
  localStore: OptimisticLocalStore,
  args: CreateAreaArgs,
): void {
  const current = localStore.getQuery(api.areas.list, {});
  if (current === undefined) return;

  localStore.setQuery(api.areas.list, {}, [
    ...current,
    buildOptimisticArea(args, {
      id: crypto.randomUUID() as Id<"areas">,
      now: Date.now(),
      order: nextOrder(current),
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

  const current = localStore.getQuery(api.areas.list, {});
  if (current !== undefined) {
    localStore.setQuery(api.areas.list, {}, patchById(current, id, patch));
  }

  const single = localStore.getQuery(api.areas.get, { id });
  if (single !== undefined && single !== null) {
    localStore.setQuery(api.areas.get, { id }, { ...single, ...patch });
  }

  const bySlug = localStore.getQuery(api.areas.getBySlug, {
    slug: options.areaSlug,
  });
  if (bySlug !== undefined && bySlug !== null) {
    localStore.setQuery(
      api.areas.getBySlug,
      { slug: options.areaSlug },
      {
        ...bySlug,
        ...patch,
      },
    );
  }
}

export function optimisticallyRemoveArea(
  localStore: OptimisticLocalStore,
  args: { id: Id<"areas"> },
  options: { areaSlug: string },
): void {
  const current = localStore.getQuery(api.areas.list, {});
  if (current !== undefined) {
    localStore.setQuery(api.areas.list, {}, removeById(current, args.id));
  }
  localStore.setQuery(api.areas.get, { id: args.id }, null);
  localStore.setQuery(api.areas.getBySlug, { slug: options.areaSlug }, null);
}
