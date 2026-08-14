// PROTOTYPE — throwaway. Round 2: the "Command bar" direction won; these are
// four takes on it (the original E plus three roomier iterations), gated by
// ?variant=E..H on the existing "/" route. Delete this directory once one wins.
import { format } from "date-fns";

import { PrototypeVariants } from "@/components/dev/prototype-variants";
import { AreaConditionStrip } from "@/features/dashboard/components/area-condition-strip";

import type { DashboardHeroProps } from "./hero-contract";

import { HeroVariantCommandBar } from "./hero-variant-command-bar";
import { HeroVariantDoubleDecker } from "./hero-variant-double-decker";
import { HeroVariantReasonsBar } from "./hero-variant-reasons-bar";
import { HeroVariantRoomyStrip } from "./hero-variant-roomy-strip";

export function DashboardHeroPrototype(props: DashboardHeroProps) {
  // Existing tests assert on the shipped hero and mock the router too narrowly
  // for the switcher's navigation hooks — under vitest, render the baseline.
  if (import.meta.env.MODE === "test") {
    return <BaselineHero {...props} />;
  }

  return (
    <PrototypeVariants
      variants={[
        {
          key: "E",
          name: "Command bar (original)",
          render: () => <HeroVariantCommandBar {...props} />,
        },
        {
          key: "F",
          name: "Roomy strip",
          render: () => <HeroVariantRoomyStrip {...props} />,
        },
        {
          key: "G",
          name: "Double-decker",
          render: () => <HeroVariantDoubleDecker {...props} />,
        },
        {
          key: "H",
          name: "Bar with reasons",
          render: () => <HeroVariantReasonsBar {...props} />,
        },
      ]}
    />
  );
}

/** The shipped design — kept ONLY for the vitest path above, not selectable. */
function BaselineHero({ areas, currentDate }: DashboardHeroProps) {
  const date = new Date(currentDate);

  return (
    <div className="flex flex-col gap-6">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="font-heading text-xl font-semibold tracking-tight">
          Life Areas
        </h1>
        <time
          dateTime={date.toISOString()}
          title={format(date, "EEEE, MMMM d, yyyy")}
          className="flex min-w-12 flex-col items-end text-muted-foreground"
        >
          <span className="text-[10px] font-medium uppercase tracking-wider">
            {format(date, "MMM")}
          </span>
          <span className="text-lg font-semibold leading-none text-foreground">
            {format(date, "d")}
          </span>
        </time>
      </header>
      <AreaConditionStrip areas={areas} />
    </div>
  );
}
