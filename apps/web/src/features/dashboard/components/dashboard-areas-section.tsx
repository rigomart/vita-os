import type { Doc } from "@convex/_generated/dataModel";
import { DashboardAreas } from "./dashboard-areas";

interface DashboardArea {
  area: Doc<"areas">;
  projectCount: number;
  attentionCount: number;
}

interface DashboardAreasSectionProps {
  areas: DashboardArea[];
  onCreateArea: () => void;
}

export function DashboardAreasSection({
  areas,
  onCreateArea,
}: DashboardAreasSectionProps) {
  return <DashboardAreas areas={areas} onCreateArea={onCreateArea} />;
}
