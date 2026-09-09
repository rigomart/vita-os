/**
 * PROTOTYPE — issue #314, round 2. The Thread row lab.
 *
 * Round 1 varied the page layout and every variant read as a ledger, so this
 * round holds the page still — one plain column, one thin "now" rule — and
 * varies only how a single Thread row is drawn: `?variant=R1|R2|R3|R4`.
 * `?narrow=true` constrains the viewport; `?source=live` swaps the fixture for
 * real Convex data.
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

import {
  dayDelta,
  toDashboardArea,
  toDashboardNote,
  toDashboardThread,
} from "../components/dashboard-model";
import { buildPrototypeData } from "./prototype-fixture";
import {
  areaMap,
  noteEntry,
  type PrototypeEntry,
  threadEntry,
} from "./prototype-shared";
import { PrototypeSwitcher } from "./prototype-switcher";
import { ROW_TREATMENTS } from "./row-treatments";

export const PROTOTYPE_VARIANTS: VariantMeta[] = ROW_TREATMENTS.map(
  (treatment) => ({
    key: treatment.key,
    name: treatment.name,
    stance: treatment.claim,
  }),
);

/**
 * A short, curated run. Round 1's list was long enough that length itself read
 * as density, which hid what the row was doing — so the lab shows only what a
 * treatment has to survive: two late things, today, a couple of moves, a
 * couple of resting Threads, one dated Note, one distant date.
 */
const LAB_THREADS = [
  "t-overdue-1",
  "t-overdue-2",
  "t-today-1",
  "t-near-1",
  "t-move-2",
  "t-move-3",
  "t-open-1",
  "t-open-2",
  "t-far-2",
];
const LAB_NOTES = ["n-overdue-1", "n-today-1"];

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

  const byArea = areaMap(data.areas);
  const threads =
    source === "live"
      ? data.threads
      : LAB_THREADS.map((id) =>
          data.threads.find((thread) => thread.id === id),
        ).filter((thread) => thread !== undefined);
  const notes =
    source === "live"
      ? data.notes
      : LAB_NOTES.map((id) => data.notes.find((note) => note.id === id)).filter(
          (note) => note !== undefined,
        );

  const entries: PrototypeEntry[] = [
    ...threads.map((thread) => threadEntry(thread, byArea, currentDate)),
    ...notes.map(noteEntry),
  ];

  // Two runs only: what is asking now, and what is simply open.
  const now = entries
    .filter(
      (entry) =>
        (entry.when !== undefined && dayDelta(entry.when, currentDate) <= 0) ||
        (entry.when === undefined && entry.isNextMove),
    )
    .sort((a, b) => (a.when ?? Infinity) - (b.when ?? Infinity));
  const rest = entries.filter((entry) => !now.includes(entry));

  const treatment =
    ROW_TREATMENTS.find((candidate) => candidate.key === variant) ??
    ROW_TREATMENTS[0]!;
  const { Row } = treatment;

  return (
    <>
      <div
        className={cn(
          "mx-auto pb-28",
          narrow ? "max-w-[26rem]" : "max-w-[46rem]",
        )}
      >
        <ul className={cn(treatment.listClassName, "mt-2")}>
          {now.map((entry) => (
            <Row
              key={entry.id}
              currentDate={currentDate}
              entry={entry}
              urgent
            />
          ))}
        </ul>

        {rest.length > 0 && (
          <>
            <div
              aria-hidden
              className="my-4 h-px bg-border/50"
              title="Below this rule: open, nothing asking"
            />
            <ul className={treatment.listClassName}>
              {rest.map((entry) => (
                <Row
                  key={entry.id}
                  currentDate={currentDate}
                  entry={entry}
                  urgent={false}
                />
              ))}
            </ul>
          </>
        )}
      </div>

      <PrototypeSwitcher
        current={treatment.key}
        narrow={narrow}
        source={source}
        variants={PROTOTYPE_VARIANTS}
      />
    </>
  );
}
