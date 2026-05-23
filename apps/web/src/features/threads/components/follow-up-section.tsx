import { api } from "@convex/_generated/api";
import { useGuardedAsyncAction } from "@vita-os/ui/hooks/use-guarded-async-action";

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

  const { run: saveFollowUp, isPending } = useGuardedAsyncAction(
    async (followUp: number | null) => {
      if (!thread) return;
      await updateThread({ id: thread._id, followUp });
    },
    { errorToast: true },
  );

  const handleSet = (date: number) => {
    if (!thread) return;
    void saveFollowUp(date);
  };

  const handleClear = () => {
    if (!thread) return;
    void saveFollowUp(null);
  };

  return (
    <FollowUp
      followUp={thread?.followUp ?? undefined}
      onSet={handleSet}
      onClear={handleClear}
      isPending={isPending}
    />
  );
}
