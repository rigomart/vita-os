import type { Thread } from "@vita-os/contracts";

import { useUpdateThread } from "@/features/threads/use-update-thread";

import { ThreadDefinition } from "./thread-definition";

interface ThreadDefinitionSectionProps {
  thread: Thread;
}

export function ThreadDefinitionSection({
  thread,
}: ThreadDefinitionSectionProps) {
  const updateThread = useUpdateThread(thread);

  const handleSave = (summary: string) => {
    updateThread({
      summary: summary || null,
    });
  };

  return (
    <ThreadDefinition summary={thread.summary ?? ""} onSave={handleSave} />
  );
}
