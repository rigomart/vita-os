import { api } from "@convex/_generated/api";
import { useQuery } from "convex-helpers/react/cache/hooks";
import { DashboardAreas } from "./dashboard-areas";

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
    <DashboardAreas
      areas={(areas ?? []).map((area) => ({
        area,
        projectCount: (projects ?? []).filter(
          (project) => project.areaId === area._id,
        ).length,
        attentionCount: attention?.byArea?.[area._id] ?? 0,
      }))}
      onCreateArea={onCreateArea}
    />
  );
}
