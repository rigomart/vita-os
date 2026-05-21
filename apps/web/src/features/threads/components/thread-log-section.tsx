import { api } from "@convex/_generated/api";
import { useQuery } from "convex-helpers/react/cache/hooks";
import { useStableQuery } from "@/hooks/use-stable-query";
import { useCreateActivityLog } from "../use-create-thread-log";
import { ActivityLog } from "./thread-log";

interface ActivityLogSectionProps {
  threadSlug: string;
}

export function ActivityLogSection({ threadSlug }: ActivityLogSectionProps) {
  const thread = useStableQuery(api.threads.getBySlug, {
    slug: threadSlug,
  });
  const logs = useQuery(
    api.activityLogs.listByThread,
    thread ? { threadId: thread._id } : "skip",
  );
  const createLog = useCreateActivityLog();

  return (
    <ActivityLog
      logs={logs}
      onAddNote={async (content) => {
        if (!thread) return;
        await createLog({ threadId: thread._id, content });
      }}
    />
  );
}
