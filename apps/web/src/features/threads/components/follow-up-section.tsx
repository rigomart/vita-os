import type { Doc } from "@convex/_generated/dataModel";

import { useGuardedAsyncAction } from "@vita-os/ui/hooks/use-guarded-async-action";

import { useUpdateThread } from "@/features/threads/use-update-thread";

import { FollowUp } from "./follow-up";

interface FollowUpSectionProps {
  thread: Doc<"threads">;
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
