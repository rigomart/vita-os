/**
 * PROTOTYPE — issue #314, round 5.
 *
 * The layout is settled: E1's four full-height, self-scrolling time columns
 * (Now · This week · Later · Resting) with the stat strip above. What is still
 * open is the card, now that the **Next Move leads instead of the Thread
 * title** — specifically, how the title stays present without taking the
 * headline back.
 *
 * `?variant=C1|C2|C3` switches the card treatment inside that fixed layout;
 * `?narrow=true` constrains the viewport; `?source=live` swaps the fixture for
 * real Convex data. Throwaway: no tests, no error handling, read-only.
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
import { CARD_TREATMENTS } from "./attention-card";
import { buildPrototypeData } from "./prototype-fixture";
import { PrototypeSwitcher } from "./prototype-switcher";
import { VariantE1TimeColumns } from "./variant-e1-time-columns";

export const PROTOTYPE_VARIANTS: VariantMeta[] = CARD_TREATMENTS.map(
  (treatment) => ({
    key: treatment.key,
    name: treatment.name,
    stance: treatment.claim,
  }),
);

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

  const card =
    CARD_TREATMENTS.find((treatment) => treatment.key === variant) ??
    CARD_TREATMENTS[0]!;

  return (
    <>
      <div
        className={cn(
          "mx-auto pb-16",
          narrow ? "max-w-[26rem]" : "max-w-[1600px]",
        )}
      >
        <VariantE1TimeColumns {...data} card={card} currentDate={currentDate} />
      </div>

      <PrototypeSwitcher
        current={card.key}
        narrow={narrow}
        source={source}
        variants={PROTOTYPE_VARIANTS}
      />
    </>
  );
}
