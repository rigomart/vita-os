import { api } from "@convex/_generated/api";
import type { Doc, Id } from "@convex/_generated/dataModel";
import { nullsToUndefined } from "@convex/lib/patch";
import type { OptimisticLocalStore } from "convex/browser";

type Area = Doc<"areas">;
type Project = Doc<"projects">;
type ActionQueueItem = { id: string; text: string };

type CreateAreaArgs = {
  name: string;
  standard?: string;
  healthStatus: Area["healthStatus"];
};

type CreateProjectArgs = {
  name: string;
  definitionOfDone?: string;
  areaId: Id<"areas">;
};

type NullablePatch<T> = {
  [K in keyof T]?: T[K] | null;
};

type AreaPatch = NullablePatch<
  Pick<Area, "name" | "standard" | "healthStatus">
>;

type ProjectPatch = NullablePatch<
  Pick<
    Project,
    "name" | "definitionOfDone" | "areaId" | "status" | "actionQueue" | "state"
  >
>;

export function patchById<T extends { _id: string }>(
  items: T[],
  id: string,
  patch: Partial<T>,
): T[] {
  return items.map((item) => (item._id === id ? { ...item, ...patch } : item));
}

export function removeById<T extends { _id: string }>(
  items: T[],
  id: string,
): T[] {
  return items.filter((item) => item._id !== id);
}

export function completeNextAction<
  T extends { actionQueue?: ActionQueueItem[] },
>(project: T): T {
  return { ...project, actionQueue: (project.actionQueue ?? []).slice(1) };
}

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

export function buildOptimisticProject(
  args: CreateProjectArgs,
  options: { id: Id<"projects">; now: number; order: number },
): Project {
  return {
    _id: options.id,
    _creationTime: options.now,
    userId: "",
    name: args.name,
    definitionOfDone: args.definitionOfDone,
    areaId: args.areaId,
    order: options.order,
    state: "active",
    createdAt: options.now,
  };
}

export function nextOrder(items: Array<{ order: number }>): number {
  return items.reduce((max, item) => Math.max(max, item.order), -1) + 1;
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

export function optimisticallyCreateProjectInList(
  localStore: OptimisticLocalStore,
  args: CreateProjectArgs,
): void {
  const current = localStore.getQuery(api.projects.list, {});
  if (current === undefined) return;

  localStore.setQuery(api.projects.list, {}, [
    ...current,
    buildOptimisticProject(args, {
      id: crypto.randomUUID() as Id<"projects">,
      now: Date.now(),
      order: nextOrder(current),
    }),
  ]);
}

export function optimisticallyCreateProjectInArea(
  localStore: OptimisticLocalStore,
  args: CreateProjectArgs,
  options: { areaId: Id<"areas"> },
): void {
  const current = localStore.getQuery(api.projects.listByArea, {
    areaId: options.areaId,
  });
  if (current === undefined) return;

  localStore.setQuery(api.projects.listByArea, { areaId: options.areaId }, [
    ...current,
    buildOptimisticProject(args, {
      id: crypto.randomUUID() as Id<"projects">,
      now: Date.now(),
      order: nextOrder(current),
    }),
  ]);
}

export function optimisticallyUpdateProject(
  localStore: OptimisticLocalStore,
  args: { id: Id<"projects"> } & ProjectPatch,
  options: { projectSlug: string },
): void {
  const { id, ...updates } = args;
  const patch = nullsToUndefined(updates);

  const current = localStore.getQuery(api.projects.list, {});
  if (current !== undefined) {
    localStore.setQuery(api.projects.list, {}, patchById(current, id, patch));
  }

  const single = localStore.getQuery(api.projects.get, { id });
  if (single !== undefined && single !== null) {
    localStore.setQuery(api.projects.get, { id }, { ...single, ...patch });
  }

  const bySlug = localStore.getQuery(api.projects.getBySlug, {
    slug: options.projectSlug,
  });
  if (bySlug !== undefined && bySlug !== null) {
    localStore.setQuery(
      api.projects.getBySlug,
      { slug: options.projectSlug },
      { ...bySlug, ...patch },
    );
  }
}

export function optimisticallyRemoveProject(
  localStore: OptimisticLocalStore,
  args: { id: Id<"projects"> },
  options: { projectSlug?: string; areaId?: Id<"areas"> } = {},
): void {
  const current = localStore.getQuery(api.projects.list, {});
  if (current !== undefined) {
    localStore.setQuery(api.projects.list, {}, removeById(current, args.id));
  }

  if (options.areaId !== undefined) {
    const areaProjects = localStore.getQuery(api.projects.listByArea, {
      areaId: options.areaId,
    });
    if (areaProjects !== undefined) {
      localStore.setQuery(api.projects.listByArea, { areaId: options.areaId }, [
        ...removeById(areaProjects, args.id),
      ]);
    }
  }

  localStore.setQuery(api.projects.get, { id: args.id }, null);
  if (options.projectSlug !== undefined) {
    localStore.setQuery(
      api.projects.getBySlug,
      { slug: options.projectSlug },
      null,
    );
  }
}

export function optimisticallyCompleteNextAction(
  localStore: OptimisticLocalStore,
  args: { id: Id<"projects"> },
  options: { projectSlug: string },
): void {
  const current = localStore.getQuery(api.projects.list, {});
  if (current !== undefined) {
    localStore.setQuery(
      api.projects.list,
      {},
      current.map((project) =>
        project._id === args.id ? completeNextAction(project) : project,
      ),
    );
  }

  const single = localStore.getQuery(api.projects.get, { id: args.id });
  if (single !== undefined && single !== null) {
    localStore.setQuery(
      api.projects.get,
      { id: args.id },
      completeNextAction(single),
    );
  }

  const bySlug = localStore.getQuery(api.projects.getBySlug, {
    slug: options.projectSlug,
  });
  if (bySlug !== undefined && bySlug !== null) {
    localStore.setQuery(
      api.projects.getBySlug,
      { slug: options.projectSlug },
      completeNextAction(bySlug),
    );
  }
}
