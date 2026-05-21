import { api } from "@convex/_generated/api";
import { useUpdateThread } from "@/features/threads/use-update-thread";
import { useStableQuery } from "@/hooks/use-stable-query";
import { FollowUp } from "./follow-up";

interface FollowUpSectionProps {
  threadSlug: string;
}

export function FollowUpSection({ threadSlug }: FollowUpSectionProps) {
  const thread = useStableQuery(api.threads.getBySlug, {
    slug: threadSlug,
  });
  const updateThread = useUpdateThread(threadSlug);

  const handleSet = (date: number) => {
    if (!thread) return;
    updateThread({ id: thread._id, followUp: date });
  };

  const handleClear = () => {
    if (!thread) return;
    updateThread({ id: thread._id, followUp: null });
  };

  return (
    <FollowUp
      followUp={thread?.followUp ?? undefined}
      onSet={handleSet}
      onClear={handleClear}
    />
  );
}
