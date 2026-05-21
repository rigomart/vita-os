import type { Doc } from "@convex/_generated/dataModel";

import { Button } from "@vita-os/ui/components/button";
import { Compass, Plus } from "lucide-react";

import { AreaCard } from "@/features/areas/components/area-card";
import { StarterAreasSuggestions } from "@/features/areas/components/starter-areas-suggestions";

export interface DashboardArea {
  area: Doc<"areas">;
  threadCount: number;
  attentionCount: number;
}

interface DashboardAreasProps {
  areas: DashboardArea[];
  onCreateArea: () => void;
  onCreateStarterArea: (name: string) => Promise<unknown> | unknown;
}

export function DashboardAreas({
  areas,
  onCreateArea,
  onCreateStarterArea,
}: DashboardAreasProps) {
  return (
    <section>
      <div className="mb-4 flex items-center justify-between">
        <h2 className="text-sm font-medium uppercase tracking-wider text-muted-foreground">
          Areas
        </h2>
        <Button
          variant="ghost"
          size="sm"
          className="h-7 gap-1.5 text-xs text-muted-foreground"
          onClick={onCreateArea}
        >
          <Plus className="h-3.5 w-3.5" />
          New area
        </Button>
      </div>

      {areas.length > 0 ? (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {areas.map(({ area, threadCount, attentionCount }) => (
            <AreaCard
              key={area._id}
              area={area}
              threadCount={threadCount}
              attentionCount={attentionCount}
            />
          ))}
        </div>
      ) : (
        <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-border/50 px-6 py-10 text-center">
          <Compass className="mb-3 h-8 w-8 text-muted-foreground/60" />
          <p className="mb-6 max-w-xs text-sm text-muted-foreground">
            Map your life domains as Areas, then set each Area&apos;s Condition
            when you are ready to judge how it is doing.
          </p>
          <StarterAreasSuggestions onSelect={onCreateStarterArea} />
          <Button
            variant="outline"
            size="sm"
            className="mt-6"
            onClick={onCreateArea}
          >
            Create custom area
          </Button>
        </div>
      )}
    </section>
  );
}
