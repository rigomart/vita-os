import { api } from "@convex/_generated/api";
import { useGuardedAsyncAction } from "@vita-os/ui/hooks/use-guarded-async-action";
import { useQuery } from "convex-helpers/react/cache/hooks";

import type { AreaView, ThreadView } from "@/features/threads/thread-view";

import { ThreadAreaSection } from "@/features/threads/components/thread-area-section";
import { useThreadPaneNav } from "@/features/threads/thread-detail/thread-pane-nav";
import { useUpdateThread } from "@/features/threads/use-update-thread";

interface ThreadAreaSectionSectionProps {
  thread: ThreadView;
  area: AreaView;
}

export function ThreadAreaSectionSection({
  thread,
  area,
}: ThreadAreaSectionSectionProps) {
  // Picker data; deduped with the palette's subscription.
  const areas = useQuery(api.areas.list);
  const { onThreadLocationChange } = useThreadPaneNav();
  const updateThread = useUpdateThread(thread, { areas: areas ?? [] });

  const { run: moveThread, isPending: isMoving } = useGuardedAsyncAction(
    async (areaId: string) => {
      if (!areas || areaId === thread.areaId) return null;

      await updateThread({ id: thread._id, areaId });
      return areas.find((candidate) => candidate._id === areaId) ?? null;
    },
    { successMessage: "Thread moved", errorToast: true },
  );

  if (!areas) return null;

  const handleMove = (areaId: string) => {
    if (areaId === thread.areaId) return;

    void moveThread(areaId).then((result) => {
      if (!result.ok || !result.value) return;

      const nextAreaSlug = result.value.slug;
      if (nextAreaSlug !== area.slug) {
        onThreadLocationChange({
          areaSlug: nextAreaSlug,
          threadSlug: thread.slug,
        });
      }
    });
  };

  return (
    <ThreadAreaSection
      areas={areas}
      thread={thread}
      onMove={handleMove}
      isMoving={isMoving}
    />
  );
}
