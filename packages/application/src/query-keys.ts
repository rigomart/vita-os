import type { ThreadId } from "@vita-os/contracts";

/**
 * Every cached read, named.
 *
 * Keys are nested so a mutation can invalidate a whole family — every Area read,
 * or every page of one Thread's Activity Log — without listing its members. A
 * paged read carries its page size in the key, because two sizes are two
 * different accumulations of the same history.
 */
export const queryKeys = {
  areas: {
    all: ["areas"] as const,
    list: () => ["areas", "list"] as const,
    detail: (slug: string) => ["areas", "detail", slug] as const,
    details: () => ["areas", "detail"] as const,
  },
  threads: {
    all: ["threads"] as const,
    open: () => ["threads", "open"] as const,
    detail: (slug: string) => ["threads", "detail", slug] as const,
    details: () => ["threads", "detail"] as const,
    activity: (threadId: ThreadId) =>
      ["threads", "activity", threadId] as const,
    activityPage: (threadId: ThreadId, limit: number) =>
      ["threads", "activity", threadId, limit] as const,
  },
  notes: {
    all: ["notes"] as const,
    open: () => ["notes", "open"] as const,
    openCount: () => ["notes", "open-count"] as const,
    done: (limit: number) => ["notes", "done", limit] as const,
    doneAll: () => ["notes", "done"] as const,
  },
  threadNotes: {
    all: ["thread-notes"] as const,
    open: (threadId: ThreadId) => ["thread-notes", "open", threadId] as const,
    done: (threadId: ThreadId, limit: number) =>
      ["thread-notes", "done", threadId, limit] as const,
    doneAll: (threadId: ThreadId) =>
      ["thread-notes", "done", threadId] as const,
  },
};

/**
 * The Thread proof's keys, under their original name.
 *
 * Kept so the Thread rail and its tests read unchanged while the rest of the
 * application moves over.
 */
export const threadQueryKeys = {
  all: queryKeys.threads.all,
  detail: queryKeys.threads.detail,
  activity: queryKeys.threads.activity,
  activityPage: queryKeys.threads.activityPage,
};
