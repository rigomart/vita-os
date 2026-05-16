import { api } from "@convex/_generated/api";
import type { Id } from "@convex/_generated/dataModel";
import { useMutation } from "convex/react";

export function useCreateProjectLog() {
  const createLog = useMutation(api.projectLogs.create);

  return (value: { projectId: Id<"projects">; content: string }) =>
    createLog(value);
}
