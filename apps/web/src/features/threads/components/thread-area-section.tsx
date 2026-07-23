import type { Doc, Id } from "@convex/_generated/dataModel";

import { AreaPicker } from "@/features/areas/components/area-picker";

interface ThreadAreaSectionProps {
  areas: Doc<"areas">[];
  thread: Doc<"threads">;
  onMove: (areaId: Id<"areas">) => void;
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
      onSelect={(id) => onMove(id as Id<"areas">)}
      disabled={isMoving}
    />
  );
}
