import { type DashboardArea, DashboardAreas } from "./dashboard-areas";

export type { DashboardArea };

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
