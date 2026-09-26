import type { AreaId, Thread } from "@vita-os/contracts";

import { useGuardedAsyncAction } from "@vita-os/ui/hooks/use-guarded-async-action";

import { AreaPicker } from "../../areas/components/area-picker";
import { useAreas } from "../../areas/hooks";
import { useUpdateThread } from "../use-update-thread";

/**
 * The Thread's Area, as a chip in the detail header. The same picker that
 * labels a new Thread adds, changes, or removes this one's label.
 */
export function ThreadAreaChip({ thread }: { thread: Thread }) {
  const areas = useAreas().data;
  const updateThread = useUpdateThread(thread, { areas: areas ?? [] });

  const { run: relabel, isPending } = useGuardedAsyncAction(
    async (areaId: AreaId | undefined) => {
      if (areaId === thread.areaId) return;
      await updateThread({ areaId: areaId ?? null });
    },
    { errorToast: true },
  );

  return (
    <AreaPicker
      value={thread.areaId}
      onChange={async (areaId) => {
        await relabel(areaId);
      }}
      disabled={isPending}
    />
  );
}
