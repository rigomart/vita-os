import type { ThreadId } from "@vita-os/contracts";

export const threadQueryKeys = {
  all: ["thread"] as const,
  detail: (slug: string) => ["thread", "detail", slug] as const,
  activity: (threadId: ThreadId) => ["thread", "activity", threadId] as const,
  activityPage: (threadId: ThreadId, limit: number) =>
    ["thread", "activity", threadId, limit] as const,
};
