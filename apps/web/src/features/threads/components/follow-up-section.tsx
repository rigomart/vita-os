import type { ProjectedThread } from "@convex/lib/validators";

import { useGuardedAsyncAction } from "@vita-os/ui/hooks/use-guarded-async-action";

import { useUpdateThread } from "@/features/threads/use-update-thread";

import { FollowUp } from "./follow-up";

interface FollowUpSectionProps {
  thread: ProjectedThread;
}

export function FollowUpSection({ thread }: FollowUpSectionProps) {
  const updateThread = useUpdateThread(thread);

  const { run: saveFollowUp, isPending } = useGuardedAsyncAction(
    async (followUp: number | null) => {
      await updateThread({ id: thread._id, followUp });
    },
    { errorToast: true },
  );

  return (
    <FollowUp
      followUp={thread.followUp ?? undefined}
      onSet={(date) => void saveFollowUp(date)}
      onClear={() => void saveFollowUp(null)}
      isPending={isPending}
    />
  );
}
