import {
  type DashboardArea,
  DashboardAreasSection,
} from "@/features/dashboard/components/dashboard-areas-section";
import { DashboardOverviewSkeleton } from "@/features/dashboard/components/dashboard-overview-skeleton";
import {
  DashboardThreadGroups,
  type DashboardThread,
} from "@/features/dashboard/components/dashboard-thread-groups";

import { shouldShowAreaSetup } from "../screens/dashboard-screen-state";

export interface DashboardOverviewData {
  areas: DashboardArea[];
  threads?: DashboardThread[];
  attentionThreads?: DashboardThread[];
}

interface DashboardOverviewProps {
  overview: DashboardOverviewData | undefined;
  currentDate: number;
  onCreateArea: () => void;
}

export function DashboardOverview({
  overview,
  currentDate,
  onCreateArea,
}: DashboardOverviewProps) {
  if (overview === undefined) {
    return <DashboardOverviewSkeleton />;
  }

  const threads = overview.threads ?? overview.attentionThreads ?? [];

  const showAreaSetup = shouldShowAreaSetup({
    areaCount: overview.areas.length,
    attentionThreadCount: threads.length,
  });

  return (
    <>
      {showAreaSetup && (
        <DashboardAreasSection
          areas={overview.areas}
          onCreateArea={onCreateArea}
        />
      )}

      {!showAreaSetup && (
        <DashboardThreadGroups
          areas={overview.areas}
          threads={threads}
          currentDate={currentDate}
        />
      )}
    </>
  );
}
