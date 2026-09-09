/**
 * PROTOTYPE — issue #314.
 *
 * Settled so far: E1's four full-height, self-scrolling time columns (Now ·
 * This week · Later · Resting); the C1 card (Next Move as the headline, Thread
 * name quiet underneath); and the H2 header — one row, Areas drawn as status
 * on the left with the Quick Panel on click, the five counts on the right.
 *
 * Nothing varies right now: the next round is inline card actions. Area
 * Condition writes are stubbed to local state — the fixture's ids are not real
 * and a prototype has no business writing.
 *
 * `?narrow=true` constrains the viewport; `?source=live` swaps the fixture for
 * real Convex data. Throwaway: no tests, no error handling, read-only.
 */
import type { Condition } from "@convex/lib/condition";

import { api } from "@convex/_generated/api";
import { useQuery } from "convex-helpers/react/cache/hooks";
import { useMemo, useState } from "react";

import { useAttentionClock } from "@/hooks/use-attention-clock";
import { cn } from "@/lib/utils";

import type { VariantMeta } from "./prototype-switcher";

import {
  toDashboardArea,
  toDashboardNote,
  toDashboardThread,
} from "../components/dashboard-model";
import { CARD_TREATMENTS } from "./attention-card";
import { DashboardHeader } from "./headers";
import { buildPrototypeData } from "./prototype-fixture";
import { PrototypeSwitcher } from "./prototype-switcher";
import { VariantE1TimeColumns } from "./variant-e1-time-columns";

export const PROTOTYPE_VARIANTS: VariantMeta[] = [
  {
    key: "H2",
    name: "Merged bar",
    stance:
      "Settled: one row — Areas as status (icon, name, pending count; click for the Quick Panel), the five counts at the right end.",
  },
];

/** The card is settled at C1; only the header varies this round. */
const CARD = CARD_TREATMENTS[0]!;

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
  /** Condition writes are stubbed: they live here, not in Convex. */
  const [conditions, setConditions] = useState<Record<string, Condition>>({});

  const data =
    source === "live"
      ? {
          areas: (areaDocs ?? []).map(toDashboardArea),
          threads: (threadDocs ?? []).map(toDashboardThread),
          notes: (noteDocs ?? []).map(toDashboardNote),
        }
      : fixture;

  const areas = data.areas.map((area) =>
    conditions[area.id] ? { ...area, condition: conditions[area.id]! } : area,
  );

  void variant;

  return (
    <>
      <div
        className={cn(
          "mx-auto pb-16",
          narrow ? "max-w-[26rem]" : "max-w-[1600px]",
        )}
      >
        <VariantE1TimeColumns
          areas={areas}
          card={CARD}
          currentDate={currentDate}
          notes={data.notes}
          threads={data.threads}
          header={(entries) => (
            <DashboardHeader
              areas={areas}
              currentDate={currentDate}
              entries={entries}
              onConditionChange={(areaId, condition) =>
                setConditions((previous) => ({
                  ...previous,
                  [areaId]: condition,
                }))
              }
            />
          )}
        />
      </div>

      <PrototypeSwitcher
        current="H2"
        narrow={narrow}
        source={source}
        variants={PROTOTYPE_VARIANTS}
      />
    </>
  );
}
