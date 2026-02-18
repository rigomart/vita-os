import { api } from "@convex/_generated/api";
import type { Id } from "@convex/_generated/dataModel";
import { generateSlug } from "@convex/lib/slugs";
import { useMutation } from "convex/react";

export function useAreaMutations() {
  const createArea = useMutation(api.areas.create).withOptimisticUpdate(
    (localStore, args) => {
      const areas = localStore.getQuery(api.areas.list, {});
      if (areas !== undefined) {
        const maxOrder = areas.reduce((max, a) => Math.max(max, a.order), -1);
        localStore.setQuery(api.areas.list, {}, [
          ...areas,
          {
            _id: crypto.randomUUID() as Id<"areas">,
            _creationTime: Date.now(),
            userId: "",
            name: args.name,
            slug: generateSlug(args.name),
            standard: args.standard,
            healthStatus: args.healthStatus,
            order: maxOrder + 1,
            createdAt: Date.now(),
          },
        ]);
      }
    },
  );

  const updateArea = useMutation(api.areas.update).withOptimisticUpdate(
    (localStore, args) => {
      const { id, ...updates } = args;

      const resolved = { ...updates };
      if (updates.clearStandard) {
        resolved.standard = undefined;
      }

      const slugUpdate =
        updates.name !== undefined ? { slug: generateSlug(updates.name) } : {};
      const fullUpdates = { ...resolved, ...slugUpdate };

      const areas = localStore.getQuery(api.areas.list, {});
      if (areas !== undefined) {
        localStore.setQuery(
          api.areas.list,
          {},
          areas.map((a) => (a._id === id ? { ...a, ...fullUpdates } : a)),
        );
      }

      const area = localStore.getQuery(api.areas.get, { id });
      if (area !== undefined && area !== null) {
        localStore.setQuery(api.areas.get, { id }, { ...area, ...fullUpdates });
      }
    },
  );

  const removeArea = useMutation(api.areas.remove).withOptimisticUpdate(
    (localStore, args) => {
      const areas = localStore.getQuery(api.areas.list, {});
      if (areas !== undefined) {
        localStore.setQuery(
          api.areas.list,
          {},
          areas.filter((a) => a._id !== args.id),
        );
      }

      localStore.setQuery(api.areas.get, { id: args.id }, null);

      // Unassign projects from this area
      const projects = localStore.getQuery(api.projects.list, {});
      if (projects !== undefined) {
        localStore.setQuery(
          api.projects.list,
          {},
          projects.map((p) =>
            p.areaId === args.id ? { ...p, areaId: undefined } : p,
          ),
        );
      }
    },
  );

  const reorderAreas = useMutation(api.areas.reorder).withOptimisticUpdate(
    (localStore, args) => {
      const areas = localStore.getQuery(api.areas.list, {});
      if (areas !== undefined) {
        const orderMap = new Map(
          args.items.map((item) => [item.id, item.order]),
        );
        const updated = areas.map((a) => {
          const newOrder = orderMap.get(a._id);
          return newOrder !== undefined ? { ...a, order: newOrder } : a;
        });
        updated.sort((a, b) => a.order - b.order);
        localStore.setQuery(api.areas.list, {}, updated);
      }
    },
  );

  return { createArea, updateArea, removeArea, reorderAreas };
}
