/**
 * PROTOTYPE — issue #314, round 7: inline card actions.
 *
 * Settled: E1's four full-height, self-scrolling time columns (Now · This week
 * · Later · Resting); the C1 card (Next Move as the headline, Thread name
 * quiet underneath); the H2 header (Areas as status with the Quick Panel on
 * click, counts at the right).
 *
 * Open: how the verbs reach a card — `?variant=A1|A2|A3`. Every write is
 * stubbed to the local state below, so finishing an item removes it from the
 * board and pushing a date really does move a card into another column. A
 * session line under the header counts what you changed and undoes the last
 * one.
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
import { ACTION_TREATMENTS } from "./card-actions";
import { DashboardHeader } from "./headers";
import { buildPrototypeData } from "./prototype-fixture";
import { PrototypeSwitcher } from "./prototype-switcher";
import { VariantE1TimeColumns } from "./variant-e1-time-columns";

export const PROTOTYPE_VARIANTS: VariantMeta[] = ACTION_TREATMENTS.map(
  (treatment) => ({
    key: treatment.key,
    name: treatment.name,
    stance: treatment.claim,
  }),
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

  const treatment =
    ACTION_TREATMENTS.find((candidate) => candidate.key === variant) ??
    ACTION_TREATMENTS[0]!;
  const { Card } = treatment;

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
            <Card
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
        current={treatment.key}
        narrow={narrow}
        source={source}
        variants={PROTOTYPE_VARIANTS}
      />
    </>
  );
}
