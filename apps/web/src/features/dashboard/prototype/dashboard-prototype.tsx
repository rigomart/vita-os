/**
 * PROTOTYPE — issue #314. Four Dashboard variations on the real Dashboard
 * route, switchable via `?variant=`, plus `?narrow=true` for a constrained
 * viewport and `?source=live` to run the variant against real Convex data
 * instead of the fixture.
 *
 * Throwaway: no tests, no error handling, read-only. Clicking a Thread row
 * still opens the Thread in place; a Note row opens the Notes surface.
 */
import { api } from "@convex/_generated/api";
import { useQuery } from "convex-helpers/react/cache/hooks";
import { useMemo } from "react";

import { useAttentionClock } from "@/hooks/use-attention-clock";
import { cn } from "@/lib/utils";

import type { VariantMeta } from "./prototype-switcher";

import { AreaStatusBar } from "../components/area-status-bar";
import {
  toDashboardArea,
  toDashboardNote,
  toDashboardThread,
} from "../components/dashboard-model";
import { buildPrototypeData } from "./prototype-fixture";
import { PrototypeSwitcher } from "./prototype-switcher";
import { VariantANowAhead, variantAName } from "./variant-a-now-ahead";
import { VariantBBands, variantBName } from "./variant-b-bands";
import { VariantCRibbon, variantCName } from "./variant-c-ribbon";
import { VariantDLanes, variantDName } from "./variant-d-lanes";

export const PROTOTYPE_VARIANTS: VariantMeta[] = [
  {
    key: "A",
    name: variantAName,
    stance:
      "Actionability wins outright — every future date leaves the main run and becomes a forward agenda beside it.",
  },
  {
    key: "B",
    name: variantBName,
    stance:
      "No global rule: today's band holds dated-today and undated Next Moves together; future dates sit in quieter bands.",
  },
  {
    key: "C",
    name: variantCName,
    stance:
      "The in-between: only Follow-ups within two days outrank Next Moves; distant dates drop to a shelf and live on the ribbon.",
  },
  {
    key: "D",
    name: variantDName,
    stance:
      "The question dissolves — only the top strip is attention-ordered; below it space is organised by Area, not by time.",
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
          "pb-24",
          narrow ? "mx-auto max-w-[26rem]" : "mx-auto max-w-[1600px]",
        )}
      >
        <div className="flex flex-col gap-6">
          {/* The real condition strip stays, so each variant is judged against
              the rest of the page rather than in a vacuum. */}
          <AreaStatusBar
            areas={data.areas}
            threads={data.threads}
            currentDate={currentDate}
            onNewThreadInArea={() => {}}
          />

          {variant === "B" && <VariantBBands {...props} />}
          {variant === "C" && <VariantCRibbon {...props} />}
          {variant === "D" && <VariantDLanes {...props} />}
          {variant !== "B" && variant !== "C" && variant !== "D" && (
            <VariantANowAhead {...props} />
          )}
        </div>
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
