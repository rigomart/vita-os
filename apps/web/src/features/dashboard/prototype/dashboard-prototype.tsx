/**
 * PROTOTYPE — issue #314, round 6.
 *
 * Settled: E1's four full-height, self-scrolling time columns (Now · This week
 * · Later · Resting), and the C1 card — Next Move as the headline with the
 * Thread name quiet underneath.
 *
 * Open: the header band. The Dashboard wants two summaries at once — the
 * time-shaped counts and the space-shaped Area conditions — and the columns
 * are full-height, so every rem the header takes comes off the board.
 * `?variant=H1|H2|H3` swaps the band; clicking an Area opens the Quick Panel
 * (condition segments + capture), with both writes stubbed to local state.
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
import { HEADER_VARIANTS } from "./headers";
import { buildPrototypeData } from "./prototype-fixture";
import { PrototypeSwitcher } from "./prototype-switcher";
import { VariantE1TimeColumns } from "./variant-e1-time-columns";

export const PROTOTYPE_VARIANTS: VariantMeta[] = HEADER_VARIANTS.map(
  (header) => ({
    key: header.key,
    name: header.name,
    stance: header.claim,
  }),
);

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

  const header =
    HEADER_VARIANTS.find((candidate) => candidate.key === variant) ??
    HEADER_VARIANTS[0]!;
  const { Header } = header;

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
            <Header
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
        current={header.key}
        narrow={narrow}
        source={source}
        variants={PROTOTYPE_VARIANTS}
      />
    </>
  );
}
