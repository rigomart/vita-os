import type { Doc } from "@convex/_generated/dataModel";

import { Button } from "@vita-os/ui/components/button";
import { Compass, Plus } from "lucide-react";

import { AreaCard } from "@/features/areas/components/area-card";
import { flatListClassName } from "@/lib/flat-surface";

export interface DashboardArea {
  area: Doc<"areas">;
  threadCount: number;
  attentionCount: number;
}

interface DashboardAreasProps {
  areas: DashboardArea[];
  onCreateArea: () => void;
}

export function DashboardAreas({ areas, onCreateArea }: DashboardAreasProps) {
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
        <div className={flatListClassName}>
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
        <div className="flex flex-col items-center justify-center px-6 py-10 text-center">
          <Compass className="mb-3 h-8 w-8 text-muted-foreground/60" />
          <p className="mb-6 max-w-xs text-sm text-muted-foreground">
            Map your life domains as Areas, then set each Area&apos;s Condition
            when you are ready to judge how it is doing.
          </p>
          <Button variant="outline" size="sm" onClick={onCreateArea}>
            Create area
          </Button>
        </div>
      )}
    </section>
  );
}
