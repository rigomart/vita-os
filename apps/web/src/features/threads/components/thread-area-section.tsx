import type { AreaSummary, Thread } from "@vita-os/contracts";

import { AreaPicker } from "@/features/areas/components/area-picker";

interface ThreadAreaSectionProps {
  areas: AreaSummary[];
  thread: Thread;
  onMove: (areaId: string) => void;
  isMoving?: boolean;
}

export function ThreadAreaSection({
  areas,
  thread,
  onMove,
  isMoving = false,
}: ThreadAreaSectionProps) {
  return (
    <AreaPicker
      areas={areas}
      selectedAreaId={thread.areaId}
      onSelect={onMove}
      disabled={isMoving}
    />
  );
}
