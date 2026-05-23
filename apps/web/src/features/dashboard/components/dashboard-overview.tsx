import { AttentionSection } from "@/features/dashboard/components/attention-section";
import {
  type DashboardArea,
  DashboardAreasSection,
} from "@/features/dashboard/components/dashboard-areas-section";
import { DashboardOverviewSkeleton } from "@/features/dashboard/components/dashboard-overview-skeleton";

import type { AttentionListTask } from "./attention-list";

import { shouldShowAreaSetup } from "../screens/dashboard-screen-state";

export interface DashboardOverviewData {
  areas: DashboardArea[];
  attentionThreads: AttentionListTask[];
}

interface DashboardOverviewProps {
  overview: DashboardOverviewData | undefined;
  currentDate: number;
  onCreateArea: () => void;
  onCreateStarterArea: (name: string) => Promise<unknown> | unknown;
}

export function DashboardOverview({
  overview,
  currentDate,
  onCreateArea,
  onCreateStarterArea,
}: DashboardOverviewProps) {
  if (overview === undefined) {
    return <DashboardOverviewSkeleton />;
  }

  const showAreaSetup = shouldShowAreaSetup({
    areaCount: overview.areas.length,
    attentionThreadCount: overview.attentionThreads.length,
  });

  return (
    <>
      {showAreaSetup && (
        <DashboardAreasSection
          areas={overview.areas}
          onCreateArea={onCreateArea}
          onCreateStarterArea={onCreateStarterArea}
        />
      )}

      <AttentionSection
        currentDate={currentDate}
        threads={overview.attentionThreads}
      />
    </>
  );
}
