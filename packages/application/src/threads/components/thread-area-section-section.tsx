import type { AreaSummary, Thread } from "@vita-os/contracts";

import { useGuardedAsyncAction } from "@vita-os/ui/hooks/use-guarded-async-action";

import { useAreas } from "../../areas/hooks";
import { useThreadPaneNav } from "../thread-detail/thread-pane-nav";
import { useUpdateThread } from "../use-update-thread";
import { ThreadAreaSection } from "./thread-area-section";

interface ThreadAreaSectionSectionProps {
  thread: Thread;
  area: AreaSummary;
}

export function ThreadAreaSectionSection({
  thread,
  area,
}: ThreadAreaSectionSectionProps) {
  // Picker data; the same read the palette and the shell already hold.
  const areas = useAreas().data;
  const { onThreadLocationChange } = useThreadPaneNav();
  const updateThread = useUpdateThread(thread, { areas: areas ?? [] });

  const { run: moveThread, isPending: isMoving } = useGuardedAsyncAction(
    async (areaId: string) => {
      if (!areas || areaId === thread.areaId) return null;

      await updateThread({ areaId });
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
