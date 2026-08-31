import { Button } from "@vita-os/ui/components/button";

import type {
  DashboardArea,
  DashboardInboxTask,
  DashboardThread,
} from "./dashboard-model";

import { AreaStatusBar } from "./area-status-bar";
import { DashboardAttention } from "./dashboard-attention";

interface DashboardOverviewProps {
  areas: DashboardArea[];
  currentDate: number;
  onCreateArea: () => void;
  /** Capture scoped to an Area, raised from the Condition strip's Quick Panel. */
  onNewThreadInArea: (areaId: string) => void;
  tasks: DashboardInboxTask[];
  threads: DashboardThread[];
}

export function DashboardOverview({
  areas,
  threads,
  tasks,
  currentDate,
  onCreateArea,
  onNewThreadInArea,
}: DashboardOverviewProps) {
  if (areas.length === 0) {
    return (
      <div className="flex flex-col gap-6">
        <h1 className="sr-only">Life Areas</h1>
        <section className="flex min-h-64 flex-col items-center justify-center rounded-xl border border-dashed px-6 text-center">
          <h2 className="font-heading text-lg font-semibold">
            Start with a Life Area
          </h2>
          <p className="mt-1 max-w-md text-sm text-muted-foreground">
            Add the first part of life you want Vita to help you keep in view.
          </p>
          <Button className="mt-4" onClick={onCreateArea}>
            Create Life Area
          </Button>
        </section>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      {/* The page's identity is the state of the Areas, not a title — the
          heading survives only for assistive tech. */}
      <h1 className="sr-only">Life Areas</h1>
      <AreaStatusBar
        areas={areas}
        threads={threads}
        currentDate={currentDate}
        onNewThreadInArea={onNewThreadInArea}
      />
      <DashboardAttention
        areas={areas}
        currentDate={currentDate}
        tasks={tasks}
        threads={threads}
      />
    </div>
  );
}
