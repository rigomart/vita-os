import type { Id } from "@convex/_generated/dataModel";
import type { OptimisticLocalStore } from "convex/browser";
import type { FunctionReturnType } from "convex/server";

import { api } from "@convex/_generated/api";

/**
 * Optimistic patches for the dashboard query the Plan canvas reads.
 *
 * The shared Thread and Task optimistic helpers keep `threads.list`,
 * `threads.get` and `tasks.list` in step, but the canvas renders from
 * `dashboard.overview`, which they do not know about. These patch every cached
 * copy of it — the query is called with a date context, so its args are not
 * knowable from here.
 */

type Overview = FunctionReturnType<typeof api.dashboard.overview>;

function patchOverview(
  localStore: OptimisticLocalStore,
  patch: (current: Overview) => Overview,
): void {
  for (const { args, value } of localStore.getAllQueries(
    api.dashboard.overview,
  )) {
    if (value === undefined) continue;
    localStore.setQuery(api.dashboard.overview, args, patch(value));
  }
}

/** Move a Thread's Follow-up, its Area, or both, in place. */
export function optimisticallyPlanThread(
  localStore: OptimisticLocalStore,
  args: {
    areaId?: Id<"areas">;
    followUp?: null | number;
    id: Id<"threads">;
  },
): void {
  patchOverview(localStore, (overview) => ({
    ...overview,
    threads: overview.threads.map((thread) =>
      thread.id === args.id
        ? {
            ...thread,
            ...(args.areaId !== undefined && { areaId: args.areaId }),
            ...(args.followUp !== undefined && {
              followUp: args.followUp ?? undefined,
            }),
          }
        : thread,
    ),
  }));
}

/** Move a Task's When, or clear it. */
export function optimisticallyPlanTask(
  localStore: OptimisticLocalStore,
  args: { id: Id<"tasks">; when?: number },
): void {
  patchOverview(localStore, (overview) => ({
    ...overview,
    inbox: {
      ...overview.inbox,
      items: overview.inbox.items.map((task) =>
        task.id === args.id ? { ...task, when: args.when } : task,
      ),
    },
  }));
}
