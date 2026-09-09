import { cn } from "@/lib/utils";

/**
 * PROTOTYPE — issue #314, round 3. D1: "Wrapped run".
 *
 * Round 2's R1 row, kept and tightened, then made to fill the desktop: one
 * continuous attention run flowing top-to-bottom and wrapping into two or
 * three columns, so the width is used by MORE of the list rather than by more
 * decoration per row. Rows are ~26px; a row is one move (or title), one date
 * token, one Area glyph. Nothing else.
 *
 * Group headers are the only text on the page that isn't a Thread.
 */
import type {
  DashboardArea,
  DashboardInboxNote,
  DashboardThread,
} from "../components/dashboard-model";
import type { PrototypeEntry } from "./prototype-shared";

import { dayDelta } from "../components/dashboard-model";
import { AreaGlyph, DateToken, rowText } from "./dense-shared";
import { areaMap, EntryLink, noteEntry, threadEntry } from "./prototype-shared";

export const variantD1Name = "Wrapped run";

export function VariantD1Columns({
  areas,
  currentDate,
  notes,
  threads,
}: {
  areas: DashboardArea[];
  currentDate: number;
  notes: DashboardInboxNote[];
  threads: DashboardThread[];
}) {
  const byArea = areaMap(areas);
  const entries = [
    ...threads.map((thread) => threadEntry(thread, byArea, currentDate)),
    ...notes.map(noteEntry),
  ];

  const groups: {
    entries: PrototypeEntry[];
    label: string;
    urgent?: boolean;
  }[] = [
    {
      label: "Late",
      urgent: true,
      entries: entries
        .filter(
          (entry) =>
            entry.when !== undefined && dayDelta(entry.when, currentDate) < 0,
        )
        .sort((a, b) => (a.when ?? 0) - (b.when ?? 0)),
    },
    {
      label: "Today",
      urgent: true,
      entries: entries
        .filter(
          (entry) =>
            entry.when !== undefined && dayDelta(entry.when, currentDate) === 0,
        )
        .sort((a, b) => (a.when ?? 0) - (b.when ?? 0)),
    },
    {
      label: "Can move now",
      entries: entries.filter(
        (entry) => entry.when === undefined && entry.isNextMove,
      ),
    },
    {
      label: "This week",
      entries: entries
        .filter((entry) => {
          if (entry.when === undefined) return false;
          const delta = dayDelta(entry.when, currentDate);
          return delta >= 1 && delta <= 6;
        })
        .sort((a, b) => (a.when ?? 0) - (b.when ?? 0)),
    },
    {
      label: "Later",
      entries: entries
        .filter(
          (entry) =>
            entry.when !== undefined && dayDelta(entry.when, currentDate) > 6,
        )
        .sort((a, b) => (a.when ?? 0) - (b.when ?? 0)),
    },
    {
      label: "Open",
      entries: entries.filter(
        (entry) =>
          entry.kind === "thread" &&
          entry.when === undefined &&
          !entry.isNextMove,
      ),
    },
  ].filter((group) => group.entries.length > 0);

  return (
    <div className="columns-1 gap-x-8 md:columns-2 xl:columns-3 [&>*]:break-inside-avoid">
      {groups.map((group) => (
        <section key={group.label} className="mb-4">
          <h2
            className={cn(
              "flex items-center gap-2 pb-0.5 text-[10px] font-semibold uppercase tracking-wider",
              group.urgent
                ? "text-condition-attention"
                : "text-muted-foreground/60",
            )}
          >
            {group.label}
            <span className="tabular-nums opacity-60">
              {group.entries.length}
            </span>
            <span aria-hidden className="h-px flex-1 bg-border/40" />
          </h2>
          <ul>
            {group.entries.map((entry) => (
              <DenseRow
                key={entry.id}
                currentDate={currentDate}
                entry={entry}
              />
            ))}
          </ul>
        </section>
      ))}
    </div>
  );
}

function DenseRow({
  currentDate,
  entry,
}: {
  currentDate: number;
  entry: PrototypeEntry;
}) {
  return (
    <li>
      <EntryLink
        entry={entry}
        className="-mx-1.5 flex items-center gap-2 rounded px-1.5 py-1 hover:bg-muted/60"
      >
        <AreaGlyph entry={entry} />
        <span className="min-w-0 flex-1 truncate text-[13px] leading-tight">
          {rowText(entry)}
        </span>
        <DateToken currentDate={currentDate} when={entry.when} />
      </EntryLink>
    </li>
  );
}
