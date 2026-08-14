// PROTOTYPE — throwaway. Five switchable takes on the dashboard hero (the
// "Life Areas" header + area condition section), gated by ?variant=A..E on the
// existing "/" route. Delete this directory once a direction wins.
import { format } from "date-fns";

import { PrototypeVariants } from "@/components/dev/prototype-variants";
import { AreaConditionStrip } from "@/features/dashboard/components/area-condition-strip";

import type { DashboardHeroProps } from "./hero-contract";

import { HeroVariantBriefing } from "./hero-variant-briefing";
import { HeroVariantCommandBar } from "./hero-variant-command-bar";
import { HeroVariantLedger } from "./hero-variant-ledger";
import { HeroVariantScoreboard } from "./hero-variant-scoreboard";

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
          key: "A",
          name: "Current header + strip",
          render: () => <BaselineHero {...props} />,
        },
        {
          key: "B",
          name: "Scoreboard",
          render: () => <HeroVariantScoreboard {...props} />,
        },
        {
          key: "C",
          name: "Briefing",
          render: () => <HeroVariantBriefing {...props} />,
        },
        {
          key: "D",
          name: "Attention ledger",
          render: () => <HeroVariantLedger {...props} />,
        },
        {
          key: "E",
          name: "Command bar",
          render: () => <HeroVariantCommandBar {...props} />,
        },
      ]}
    />
  );
}

/** Variant A — the shipped design, duplicated here so the real code stays untouched. */
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
