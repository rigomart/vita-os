import type { Doc } from "@convex/_generated/dataModel";
import { Button } from "@vita-os/ui/components/button";
import { Compass, Plus } from "lucide-react";
import { AreaCard } from "@/features/areas/components/area-card";

interface DashboardArea {
  area: Doc<"areas">;
  projectCount: number;
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
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {areas.map(({ area, projectCount, attentionCount }) => (
            <AreaCard
              key={area._id}
              area={area}
              projectCount={projectCount}
              attentionCount={attentionCount}
            />
          ))}
        </div>
      ) : (
        <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-border/50 py-10 text-center">
          <Compass className="mb-3 h-8 w-8 text-muted-foreground/60" />
          <p className="mb-4 max-w-xs text-sm text-muted-foreground">
            Define your life areas to organize projects by responsibility.
          </p>
          <Button variant="outline" size="sm" onClick={onCreateArea}>
            Create area
          </Button>
        </div>
      )}
    </section>
  );
}
