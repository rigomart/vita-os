import { Button } from "@vita-os/ui/components/button";

import type { PlanActions } from "@/features/dashboard/plan/use-plan-actions";

import { PlanCanvas, PlanSchedule } from "@/features/dashboard/plan";
/* PROTOTYPE */
import { PrototypeSwitcher } from "@/features/dashboard/plan/prototype/prototype-switcher";
import { PrototypeVariantProvider } from "@/features/dashboard/plan/prototype/use-prototype-variant";
import { useIsCompact } from "@/hooks/use-mobile";

import type {
  DashboardArea,
  DashboardInboxTask,
  DashboardThread,
} from "./dashboard-model";

import { AreaStatusBar } from "./area-status-bar";

interface DashboardOverviewProps {
  areas: DashboardArea[];
  currentDate: number;
  onCreateArea: () => void;
  /** Capture scoped to an Area, raised from a Plan lane header's Quick Panel. */
  onNewThreadInArea: (areaId: string) => void;
  planActions: PlanActions;
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
  planActions,
}: DashboardOverviewProps) {
  const compact = useIsCompact();

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
    /* PROTOTYPE — variant provider + switcher wrap the real dashboard. */
    <PrototypeVariantProvider>
      <PrototypeSwitcher />
      <div className="flex flex-col gap-6">
        {/* The page's identity is the state of the Areas, not a title — the
          heading survives only for assistive tech. */}
        <h1 className="sr-only">Life Areas</h1>
        <AreaStatusBar
          areas={areas}
          threads={threads}
          currentDate={currentDate}
        />

        {/* Two shapes of the same Plan. A phone gets the vertical schedule; the
          branch is real, not a CSS switch, so only the mounted one runs its
          scroll and observer effects. */}
        {compact ? (
          <PlanSchedule
            areas={areas}
            currentDate={currentDate}
            planActions={planActions}
            tasks={tasks}
            threads={threads}
          />
        ) : (
          <PlanCanvas
            areas={areas}
            currentDate={currentDate}
            onNewThreadInArea={onNewThreadInArea}
            planActions={planActions}
            tasks={tasks}
            threads={threads}
          />
        )}
      </div>
    </PrototypeVariantProvider>
  );
}
