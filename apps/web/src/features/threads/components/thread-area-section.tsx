import type { AreaView, ThreadView } from "@/features/threads/thread-view";

import { AreaPicker } from "@/features/areas/components/area-picker";

interface ThreadAreaSectionProps {
  areas: AreaView[];
  thread: ThreadView;
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
