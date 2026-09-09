/**
 * PROTOTYPE — issue #314.
 *
 * Settled: E1's four full-height, self-scrolling time columns (Now · This week
 * · Later · Resting); the C1 card (Next Move as the headline, Thread name
 * quiet underneath); the H2 header (Areas as status with the Quick Panel on
 * click, counts at the right).
 *
 * ...and the A1 card actions: a rail that fades in at the card's edge on hover
 * or focus. Every write is stubbed to the local state below, so finishing an
 * item removes it from the board and pushing a date really does move a card
 * into another column, with an Undo under the header.
 *
 * Settled in round 8: standalone Notes are drawn as paper rather than as Thread
 * cards (`note-paper.tsx`).
 *
 * Open — round 9: the fourth column becomes **No date**, holding unscheduled
 * Threads and Notes together instead of "Resting". `?variant=P1|P2|P3` decides
 * what "undated" may include — the last live piece of #236.
 *
 * `?narrow=true` constrains the viewport; `?source=live` swaps the fixture for
 * real Convex data. Throwaway: no tests, no error handling, read-only.
 */
import type { Condition } from "@convex/lib/condition";

import { api } from "@convex/_generated/api";
import { useQuery } from "convex-helpers/react/cache/hooks";
import { Undo2 } from "lucide-react";
import { useMemo, useState } from "react";

import { useAttentionClock } from "@/hooks/use-attention-clock";
import { cn } from "@/lib/utils";

import type { PrototypeEntry } from "./prototype-shared";
import type { VariantMeta } from "./prototype-switcher";

import {
  toDashboardArea,
  toDashboardNote,
  toDashboardThread,
} from "../components/dashboard-model";
import { ActionCard } from "./card-actions";
import { DashboardHeader } from "./headers";
import { NotePaper } from "./note-paper";
import { buildPrototypeData } from "./prototype-fixture";
import { PrototypeSwitcher } from "./prototype-switcher";
import {
  VariantE1TimeColumns,
  type NoDateMode,
} from "./variant-e1-time-columns";

const NO_DATE_MODES: (VariantMeta & { mode: NoDateMode })[] = [
  {
    key: "P1",
    name: "Strict",
    mode: "strict",
    stance:
      "One clean axis: Now holds only dates, and every unscheduled Thread and Note falls into No date. Answers #236 by saying a date outranks an undated move.",
  },
  {
    key: "P2",
    name: "Moves stay",
    mode: "moves",
    stance:
      "Undated Next Moves keep their place in Now because you can act on them today; No date takes the Threads with nothing queued, plus the Notes.",
  },
  {
    key: "P3",
    name: "Sectioned",
    mode: "sectioned",
    stance:
      "Strict, but the No date column admits its seams: Ready to move · Open · Notes, labelled inside one column.",
  },
];

export const PROTOTYPE_VARIANTS: VariantMeta[] = NO_DATE_MODES.map(
  ({ key, name, stance }) => ({ key, name, stance }),
);

/** One stubbed write, kept so the session line can undo it. */
interface Edit {
  entryId: string;
  kind: "done" | "push";
  when?: number;
}

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
  /** Every write is stubbed: it lives here, not in Convex. */
  const [conditions, setConditions] = useState<Record<string, Condition>>({});
  const [edits, setEdits] = useState<Edit[]>([]);

  const raw =
    source === "live"
      ? {
          areas: (areaDocs ?? []).map(toDashboardArea),
          threads: (threadDocs ?? []).map(toDashboardThread),
          notes: (noteDocs ?? []).map(toDashboardNote),
        }
      : fixture;

  const areas = raw.areas.map((area) =>
    conditions[area.id] ? { ...area, condition: conditions[area.id]! } : area,
  );

  // Later edits win, so a push after a push just moves the card again.
  const done = new Set(
    edits.filter((edit) => edit.kind === "done").map((edit) => edit.entryId),
  );
  const pushes = new Map(
    edits
      .filter((edit) => edit.kind === "push")
      .map((edit) => [edit.entryId, edit.when]),
  );

  const threads = raw.threads
    .filter((thread) => !done.has(thread.id))
    .map((thread) =>
      pushes.has(thread.id)
        ? { ...thread, followUp: pushes.get(thread.id) }
        : thread,
    );
  const notes = raw.notes
    .filter((note) => !done.has(note.id))
    .map((note) =>
      pushes.has(note.id) ? { ...note, when: pushes.get(note.id) } : note,
    );

  const noDate =
    NO_DATE_MODES.find((candidate) => candidate.key === variant) ??
    NO_DATE_MODES[0]!;

  const record = (edit: Edit) =>
    setEdits((previous) => [
      ...previous.filter(
        (existing) =>
          !(existing.entryId === edit.entryId && existing.kind === edit.kind),
      ),
      edit,
    ]);

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
          currentDate={currentDate}
          noDateMode={noDate.mode}
          notes={notes}
          threads={threads}
          header={(entries) => (
            <div className="flex flex-col gap-1">
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
              {edits.length > 0 && (
                <p className="flex items-center gap-2 text-2xs text-muted-foreground">
                  <span className="tabular-nums">
                    {edits.length} change{edits.length === 1 ? "" : "s"} this
                    session
                  </span>
                  <button
                    type="button"
                    onClick={() =>
                      setEdits((previous) => previous.slice(0, -1))
                    }
                    className="inline-flex items-center gap-1 rounded border border-border/60 px-1.5 py-0.5 hover:bg-muted"
                  >
                    <Undo2 className="size-3" />
                    Undo last
                  </button>
                </p>
              )}
            </div>
          )}
          renderCard={(entry: PrototypeEntry) => (
            <ActionCard
              currentDate={currentDate}
              entry={entry}
              onDone={(target) => record({ entryId: target.id, kind: "done" })}
              onPush={(target, when) =>
                record({ entryId: target.id, kind: "push", when })
              }
            />
          )}
          renderNote={(entry: PrototypeEntry) => (
            <NotePaper
              currentDate={currentDate}
              entry={entry}
              onDone={(target) => record({ entryId: target.id, kind: "done" })}
              onPush={(target, when) =>
                record({ entryId: target.id, kind: "push", when })
              }
            />
          )}
        />
      </div>

      <PrototypeSwitcher
        current={noDate.key}
        narrow={narrow}
        source={source}
        variants={PROTOTYPE_VARIANTS}
      />
    </>
  );
}
