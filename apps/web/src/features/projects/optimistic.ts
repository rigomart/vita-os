import { api } from "@convex/_generated/api";
import type { Doc, Id } from "@convex/_generated/dataModel";
import { nullsToUndefined } from "@convex/lib/patch";
import type { OptimisticLocalStore } from "convex/browser";
import { nextOrder, patchById, removeById } from "@/features/shared/optimistic";

type Project = Doc<"projects">;

type CreateProjectArgs = {
  name: string;
  definitionOfDone?: string;
  areaId: Id<"areas">;
};

type NullablePatch<T> = {
  [K in keyof T]?: T[K] | null;
};

type ProjectPatch = NullablePatch<
  Pick<
    Project,
    "name" | "definitionOfDone" | "areaId" | "status" | "nextMove" | "state"
  >
>;

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

export function completeNextMove<T extends { nextMove?: string }>(
  project: T,
): T {
  return { ...project, nextMove: undefined };
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

  if (patch.areaId !== undefined && bySlug !== undefined && bySlug !== null) {
    const previousAreaId = bySlug.areaId;
    if (previousAreaId !== patch.areaId) {
      const previousAreaProjects = localStore.getQuery(
        api.projects.listByArea,
        {
          areaId: previousAreaId,
        },
      );
      if (previousAreaProjects !== undefined) {
        localStore.setQuery(
          api.projects.listByArea,
          { areaId: previousAreaId },
          removeById(previousAreaProjects, id),
        );
      }

      const nextAreaProjects = localStore.getQuery(api.projects.listByArea, {
        areaId: patch.areaId,
      });
      if (nextAreaProjects !== undefined) {
        localStore.setQuery(api.projects.listByArea, { areaId: patch.areaId }, [
          ...nextAreaProjects,
          { ...bySlug, ...patch },
        ]);
      }
    }
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
      localStore.setQuery(
        api.projects.listByArea,
        { areaId: options.areaId },
        removeById(areaProjects, args.id),
      );
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

export function optimisticallyCompleteNextMove(
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
        project._id === args.id ? completeNextMove(project) : project,
      ),
    );
  }

  const single = localStore.getQuery(api.projects.get, { id: args.id });
  if (single !== undefined && single !== null) {
    localStore.setQuery(
      api.projects.get,
      { id: args.id },
      completeNextMove(single),
    );
  }

  const bySlug = localStore.getQuery(api.projects.getBySlug, {
    slug: options.projectSlug,
  });
  if (bySlug !== undefined && bySlug !== null) {
    localStore.setQuery(
      api.projects.getBySlug,
      { slug: options.projectSlug },
      completeNextMove(bySlug),
    );
  }
}
