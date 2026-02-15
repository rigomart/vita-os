import { api } from "@convex/_generated/api";
import type { Id } from "@convex/_generated/dataModel";
import { useMutation } from "convex/react";

export function useTaskMutations(projectId?: Id<"projects">) {
  const updateTask = useMutation(api.tasks.update).withOptimisticUpdate(
    (localStore, args) => {
      const { id, ...updates } = args;

      if (projectId) {
        const tasks = localStore.getQuery(api.tasks.listByProject, {
          projectId,
        });
        if (tasks !== undefined) {
          const task = tasks.find((t) => t._id === id);
          if (task) {
            localStore.setQuery(
              api.tasks.listByProject,
              { projectId },
              tasks.map((t) => (t._id === id ? { ...task, ...updates } : t)),
            );
          }
        }
      } else {
        const tasks = localStore.getQuery(api.tasks.list, {});
        if (tasks !== undefined) {
          const task = tasks.find((t) => t._id === id);
          if (task) {
            localStore.setQuery(
              api.tasks.list,
              {},
              tasks.map((t) => (t._id === id ? { ...task, ...updates } : t)),
            );
          }
        }
      }
    },
  );

  const removeTask = useMutation(api.tasks.remove).withOptimisticUpdate(
    (localStore, args) => {
      if (projectId) {
        const tasks = localStore.getQuery(api.tasks.listByProject, {
          projectId,
        });
        if (tasks !== undefined) {
          localStore.setQuery(
            api.tasks.listByProject,
            { projectId },
            tasks.filter((t) => t._id !== args.id),
          );
        }
      } else {
        const tasks = localStore.getQuery(api.tasks.list, {});
        if (tasks !== undefined) {
          localStore.setQuery(
            api.tasks.list,
            {},
            tasks.filter((t) => t._id !== args.id),
          );
        }
      }
    },
  );

  const createTask = useMutation(api.tasks.create).withOptimisticUpdate(
    (localStore, args) => {
      if (projectId) {
        const tasks = localStore.getQuery(api.tasks.listByProject, {
          projectId,
        });
        if (tasks !== undefined) {
          const maxOrder = tasks.reduce((max, t) => Math.max(max, t.order), -1);
          localStore.setQuery(api.tasks.listByProject, { projectId }, [
            ...tasks,
            {
              _id: crypto.randomUUID() as Id<"tasks">,
              _creationTime: Date.now(),
              userId: "",
              title: args.title,
              description: args.description,
              isCompleted: false,
              dueDate: args.dueDate,
              projectId,
              order: maxOrder + 1,
              createdAt: Date.now(),
            },
          ]);
        }
      } else {
        const tasks = localStore.getQuery(api.tasks.list, {});
        if (tasks !== undefined) {
          const maxOrder = tasks.reduce((max, t) => Math.max(max, t.order), -1);
          localStore.setQuery(api.tasks.list, {}, [
            ...tasks,
            {
              _id: crypto.randomUUID() as Id<"tasks">,
              _creationTime: Date.now(),
              userId: "",
              title: args.title,
              description: args.description,
              isCompleted: false,
              dueDate: args.dueDate,
              projectId: args.projectId,
              order: maxOrder + 1,
              createdAt: Date.now(),
            },
          ]);
        }
      }
    },
  );

  return { createTask, updateTask, removeTask };
}
