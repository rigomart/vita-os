import { api } from "@convex/_generated/api";
import { Button } from "@vita-os/ui/components/button";
import { useQuery } from "convex-helpers/react/cache/hooks";
import { Compass, Plus } from "lucide-react";
import { AreaCard } from "@/features/areas/components/area-card";

interface DashboardAreasSectionProps {
  onCreateArea: () => void;
}

export function DashboardAreasSection({
  onCreateArea,
}: DashboardAreasSectionProps) {
  const areas = useQuery(api.areas.list);
  const projects = useQuery(api.projects.list);
  const attention = useQuery(api.dashboard.attention);

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

      {areas && areas.length > 0 ? (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {areas.map((area) => {
            const projectCount = (projects ?? []).filter(
              (project) => project.areaId === area._id,
            ).length;

            return (
              <AreaCard
                key={area._id}
                area={area}
                projectCount={projectCount}
                attentionCount={attention?.byArea?.[area._id] ?? 0}
              />
            );
          })}
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
