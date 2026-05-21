import type { Id } from "@convex/_generated/dataModel";

import { api } from "@convex/_generated/api";
import { useMutation } from "convex/react";

export function useCreateActivityLog() {
  const createLog = useMutation(api.activityLogs.create);

  return (value: { threadId: Id<"threads">; content: string }) =>
    createLog(value);
}
