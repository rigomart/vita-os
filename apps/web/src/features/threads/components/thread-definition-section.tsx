import { api } from "@convex/_generated/api";
import { useUpdateThread } from "@/features/threads/use-update-thread";
import { useStableQuery } from "@/hooks/use-stable-query";
import { ThreadDefinition } from "./thread-definition";

interface ThreadDefinitionSectionProps {
  threadSlug: string;
}

export function ThreadDefinitionSection({
  threadSlug,
}: ThreadDefinitionSectionProps) {
  const thread = useStableQuery(api.threads.getBySlug, {
    slug: threadSlug,
  });
  const updateThread = useUpdateThread(threadSlug);

  const handleSave = (summary: string) => {
    if (!thread) return;
    updateThread({
      id: thread._id,
      summary: summary || null,
    });
  };

  return (
    <ThreadDefinition summary={thread?.summary ?? ""} onSave={handleSave} />
  );
}
