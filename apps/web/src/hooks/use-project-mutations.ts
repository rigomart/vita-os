import { api } from "@convex/_generated/api";
import type { Id } from "@convex/_generated/dataModel";
import { generateSlug } from "@convex/lib/slugs";
import { useMutation } from "convex/react";

export function useProjectMutations() {
  const updateProject = useMutation(api.projects.update).withOptimisticUpdate(
    (localStore, args) => {
      const { id, ...updates } = args;

      // Handle clearing in optimistic state
      const resolved = { ...updates };
      if (updates.clearStartDate) {
        resolved.startDate = undefined;
        resolved.endDate = undefined;
      }
      if (updates.clearEndDate) {
        resolved.endDate = undefined;
      }
      if (updates.clearAreaId) {
        resolved.areaId = undefined;
      }

      const slugUpdate =
        updates.name !== undefined ? { slug: generateSlug(updates.name) } : {};
      const fullUpdates = { ...resolved, ...slugUpdate };

      const projects = localStore.getQuery(api.projects.list, {});
      if (projects !== undefined) {
        localStore.setQuery(
          api.projects.list,
          {},
          projects.map((p) => (p._id === id ? { ...p, ...fullUpdates } : p)),
        );
      }

      const project = localStore.getQuery(api.projects.get, { id });
      if (project !== undefined && project !== null) {
        localStore.setQuery(
          api.projects.get,
          { id },
          { ...project, ...fullUpdates },
        );
      }
    },
  );

  const removeProject = useMutation(api.projects.remove).withOptimisticUpdate(
    (localStore, args) => {
      const projects = localStore.getQuery(api.projects.list, {});
      if (projects !== undefined) {
        localStore.setQuery(
          api.projects.list,
          {},
          projects.filter((p) => p._id !== args.id),
        );
      }

      localStore.setQuery(api.projects.get, { id: args.id }, null);
    },
  );

  const createProject = useMutation(api.projects.create).withOptimisticUpdate(
    (localStore, args) => {
      const projects = localStore.getQuery(api.projects.list, {});
      if (projects !== undefined) {
        const maxOrder = projects.reduce(
          (max, p) => Math.max(max, p.order),
          -1,
        );
        localStore.setQuery(api.projects.list, {}, [
          ...projects,
          {
            _id: crypto.randomUUID() as Id<"projects">,
            _creationTime: Date.now(),
            userId: "",
            name: args.name,
            slug: generateSlug(args.name),
            description: args.description,
            definitionOfDone: args.definitionOfDone,
            areaId: args.areaId,
            startDate: args.startDate,
            endDate: args.endDate,
            order: maxOrder + 1,
            isArchived: false,
            createdAt: Date.now(),
          },
        ]);
      }
    },
  );

  return { createProject, updateProject, removeProject };
}
