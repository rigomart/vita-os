import type { ThreadView } from "@/features/threads/thread-view";

import { useUpdateThread } from "@/features/threads/use-update-thread";

import { ThreadDefinition } from "./thread-definition";

interface ThreadDefinitionSectionProps {
  thread: ThreadView;
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
