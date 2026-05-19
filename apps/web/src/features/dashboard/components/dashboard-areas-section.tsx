import { type DashboardArea, DashboardAreas } from "./dashboard-areas";

interface DashboardAreasSectionProps {
  areas: DashboardArea[];
  onCreateArea: () => void;
  onCreateStarterArea: (name: string) => Promise<unknown> | unknown;
}

export function DashboardAreasSection({
  areas,
  onCreateArea,
  onCreateStarterArea,
}: DashboardAreasSectionProps) {
  return (
    <DashboardAreas
      areas={areas}
      onCreateArea={onCreateArea}
      onCreateStarterArea={onCreateStarterArea}
    />
  );
}
