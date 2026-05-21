import type { Doc, Id } from "@convex/_generated/dataModel";
import { Compass } from "lucide-react";
import { AreaPicker } from "@/features/areas/components/area-picker";

interface ThreadAreaSectionProps {
  areas: Doc<"areas">[];
  thread: Doc<"threads">;
  onMove: (areaId: Id<"areas">) => void;
}

export function ThreadAreaSection({
  areas,
  thread,
  onMove,
}: ThreadAreaSectionProps) {
  return (
    <div className="flex items-start gap-3">
      <div className="flex w-36 shrink-0 items-center gap-2 pt-1 text-xs text-muted-foreground">
        <Compass className="h-3.5 w-3.5" />
        Area
      </div>
      <div className="min-w-0 flex-1">
        <AreaPicker
          areas={areas}
          selectedAreaId={thread.areaId}
          onSelect={(id) => onMove(id as Id<"areas">)}
        />
      </div>
    </div>
  );
}
