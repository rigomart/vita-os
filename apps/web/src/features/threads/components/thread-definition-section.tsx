import type { ProjectedThread } from "@convex/lib/validators";

import { useUpdateThread } from "@/features/threads/use-update-thread";

import { ThreadDefinition } from "./thread-definition";

interface ThreadDefinitionSectionProps {
  thread: ProjectedThread;
}

export function ThreadDefinitionSection({
  thread,
}: ThreadDefinitionSectionProps) {
  const updateThread = useUpdateThread(thread);

  const handleSave = (summary: string) => {
    updateThread({
      id: thread._id,
      summary: summary || null,
    });
  };

  return (
    <ThreadDefinition summary={thread.summary ?? ""} onSave={handleSave} />
  );
}
