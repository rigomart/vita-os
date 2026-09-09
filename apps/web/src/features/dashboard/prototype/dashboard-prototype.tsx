/**
 * PROTOTYPE — issue #314, round 4.
 *
 * Rounds so far: 1 varied page layout (rows read as a ledger), 2 varied the
 * row and removed information (wrong — the desktop should be used), 3 went
 * dense but showed the Next Move *instead of* the Thread title (disorienting)
 * and left vertical dead space.
 *
 * Round 4 keeps the parts that worked — cards and the stat strip — restores
 * the Thread title above its Next Move, and asks one question three ways:
 * where does TIME live if the page must not become a plan view?
 *
 * `?variant=D2|E1|E2|E3`, `?narrow=true`, `?source=live`. Throwaway.
 */
import { api } from "@convex/_generated/api";
import { useQuery } from "convex-helpers/react/cache/hooks";
import { useMemo } from "react";

import { useAttentionClock } from "@/hooks/use-attention-clock";
import { cn } from "@/lib/utils";

import type { VariantMeta } from "./prototype-switcher";

import {
  toDashboardArea,
  toDashboardNote,
  toDashboardThread,
} from "../components/dashboard-model";
import { buildPrototypeData } from "./prototype-fixture";
import { PrototypeSwitcher } from "./prototype-switcher";
import { VariantD2Board, variantD2Name } from "./variant-d2-board";
import { VariantE1TimeColumns, variantE1Name } from "./variant-e1-time-columns";
import {
  VariantE2TimelineBoard,
  variantE2Name,
} from "./variant-e2-timeline-board";
import { VariantE3AgendaSpine, variantE3Name } from "./variant-e3-agenda-spine";

export const PROTOTYPE_VARIANTS: VariantMeta[] = [
  {
    key: "E1",
    name: variantE1Name,
    stance:
      "Time IS the layout: four full-height columns (Now · This week · Later · Resting), each scrolling itself so no column leaves a hole.",
  },
  {
    key: "E2",
    name: variantE2Name,
    stance:
      "Time is a chart: a 28-day bar strip over an attention-ordered board. Click a day to filter; the board is never reorganised by date.",
  },
  {
    key: "E3",
    name: variantE3Name,
    stance:
      "Time is a spine: cards keep the width, a narrow chronological agenda runs full height down the right.",
  },
  {
    key: "D2",
    name: variantD2Name,
    stance:
      "Baseline — round 3's board with the title restored and no time axis at all, so the other three can be judged against it.",
  },
];

export function DashboardPrototype({
  narrow,
  source,
  variant,
}: {
  narrow: boolean;
  source: "fixture" | "live";
  variant: string;
}) {
  const currentDate = useAttentionClock();
  const areaDocs = useQuery(api.areas.list);
  const threadDocs = useQuery(api.threads.list);
  const noteDocs = useQuery(api.notes.list);

  const fixture = useMemo(() => buildPrototypeData(currentDate), [currentDate]);

  const data =
    source === "live"
      ? {
          areas: (areaDocs ?? []).map(toDashboardArea),
          threads: (threadDocs ?? []).map(toDashboardThread),
          notes: (noteDocs ?? []).map(toDashboardNote),
        }
      : fixture;

  const props = { ...data, currentDate };

  return (
    <>
      <div
        className={cn(
          "mx-auto pb-16",
          narrow ? "max-w-[26rem]" : "max-w-[1600px]",
        )}
      >
        {variant === "E2" && <VariantE2TimelineBoard {...props} />}
        {variant === "E3" && <VariantE3AgendaSpine {...props} />}
        {variant === "D2" && <VariantD2Board {...props} />}
        {variant !== "E2" && variant !== "E3" && variant !== "D2" && (
          <VariantE1TimeColumns {...props} />
        )}
      </div>

      <PrototypeSwitcher
        current={variant}
        narrow={narrow}
        source={source}
        variants={PROTOTYPE_VARIANTS}
      />
    </>
  );
}
