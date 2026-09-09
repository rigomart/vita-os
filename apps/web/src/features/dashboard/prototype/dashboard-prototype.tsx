/**
 * PROTOTYPE — issue #314, round 3. Dense Dashboard variations.
 *
 * Round 1 varied whole-page layout (rejected: every row read as a ledger).
 * Round 2 answered "too much density" by removing information (rejected: a
 * dashboard should use the desktop, not leave it empty). Round 3 keeps the
 * density and spends it better — short tokens instead of phrases, icons
 * instead of names, ~26px rows, no summaries — across three ways of filling
 * the width: `?variant=D1|D2|D3`.
 *
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
import { buildPrototypeData } from "./prototype-fixture";
import { PrototypeSwitcher } from "./prototype-switcher";
import { VariantD1Columns, variantD1Name } from "./variant-d1-columns";
import { VariantD2Board, variantD2Name } from "./variant-d2-board";
import { VariantD3Matrix, variantD3Name } from "./variant-d3-matrix";

export const PROTOTYPE_VARIANTS: VariantMeta[] = [
  {
    key: "D1",
    name: variantD1Name,
    stance:
      "One attention run, tight rows, wrapped into columns — the width buys more of the list, not more per row.",
  },
  {
    key: "D2",
    name: variantD2Name,
    stance:
      "Uniform tiles packed 4–5 across, sorted by attention, with a five-number status strip above.",
  },
  {
    key: "D3",
    name: variantD3Name,
    stance:
      "Areas down, time across. A chip's position carries its Area and its date, so the chip is only text.",
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
          "mx-auto pb-28",
          narrow ? "max-w-[26rem]" : "max-w-[1600px]",
        )}
      >
        {variant === "D2" && <VariantD2Board {...props} />}
        {variant === "D3" && <VariantD3Matrix {...props} />}
        {variant !== "D2" && variant !== "D3" && (
          <VariantD1Columns {...props} />
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
