import { api } from "@convex/_generated/api";
import { useQuery } from "convex-helpers/react/cache/hooks";
import { useState } from "react";

import {
  PrototypeSwitcher,
  PrototypeVariantGate,
  type PrototypeVariantKey,
} from "@/components/prototype-switcher";
import { CreateAreaDialog } from "@/features/areas/area-form/create-area-dialog";
import { DashboardOverview } from "@/features/dashboard/components/dashboard-overview";
import { DashboardOverviewSkeleton } from "@/features/dashboard/components/dashboard-overview-skeleton";
import { VariantA } from "@/features/dashboard/prototype/variant-a";
import { VariantB } from "@/features/dashboard/prototype/variant-b";
import { VariantC } from "@/features/dashboard/prototype/variant-c";

export function DashboardScreen() {
  const [dateContext] = useState(() => {
    const currentDate = Date.now();
    return {
      currentDate,
      timezoneOffsetMinutes: new Date(currentDate).getTimezoneOffset(),
    };
  });
  const overview = useQuery(api.dashboard.overview, dateContext);
  const [showCreateArea, setShowCreateArea] = useState(false);

  // PROTOTYPE: `?variant=` swaps the dashboard body between the throwaway
  // direction prototypes (see features/dashboard/prototype/README.md). The
  // empty-areas onboarding state always uses the current component.
  const renderDashboard = (variant: PrototypeVariantKey | undefined) => {
    if (overview === undefined) return <DashboardOverviewSkeleton />;

    if (variant !== undefined && overview.areas.length > 0) {
      const props = { overview, currentDate: dateContext.currentDate };
      if (variant === "a") return <VariantA {...props} />;
      if (variant === "b") return <VariantB {...props} />;
      return <VariantC {...props} />;
    }

    return (
      <DashboardOverview
        overview={overview}
        currentDate={dateContext.currentDate}
        onCreateArea={() => setShowCreateArea(true)}
      />
    );
  };

  return (
    <div className="mx-auto max-w-7xl pb-16">
      <PrototypeVariantGate>{renderDashboard}</PrototypeVariantGate>

      <PrototypeSwitcher />

      <CreateAreaDialog
        open={showCreateArea}
        onOpenChange={setShowCreateArea}
      />
    </div>
  );
}
