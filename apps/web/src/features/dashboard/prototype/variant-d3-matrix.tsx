import { conditionLabels } from "@convex/lib/condition";

import { AreaIcon } from "@/features/areas/components/area-icon";
import { conditionTextClassName } from "@/features/areas/condition-presentation";
import { cn } from "@/lib/utils";

/**
 * PROTOTYPE — issue #314, round 3. D3: "Matrix".
 *
 * The densest and the most structural: Areas down the side, time across the
 * top (Late · Today · This week · Later · No date). Every item is a chip with
 * nothing but its text, and its position IS its metadata — the row says which
 * Area, the column says when, so no chip needs to spell either out.
 *
 * This is the layout that most obviously answers "what needs attention now?"
 * at a glance: read the left-most columns, top to bottom.
 */
import type {
  DashboardArea,
  DashboardInboxNote,
  DashboardThread,
} from "../components/dashboard-model";
import type { PrototypeEntry } from "./prototype-shared";

import { dayDelta } from "../components/dashboard-model";
import { dateToken, rowText } from "./dense-shared";
import { areaMap, EntryLink, noteEntry, threadEntry } from "./prototype-shared";

export const variantD3Name = "Matrix";

type ColumnKey = "later" | "late" | "none" | "today" | "week";

const COLUMNS: { key: ColumnKey; label: string; urgent?: true }[] = [
  { key: "late", label: "Late", urgent: true },
  { key: "today", label: "Today", urgent: true },
  { key: "week", label: "This week" },
  { key: "later", label: "Later" },
  { key: "none", label: "No date" },
];

function columnOf(entry: PrototypeEntry, currentDate: number): ColumnKey {
  if (entry.when === undefined) return "none";
  const delta = dayDelta(entry.when, currentDate);
  if (delta < 0) return "late";
  if (delta === 0) return "today";
  if (delta <= 6) return "week";
  return "later";
}

export function VariantD3Matrix({
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
  const threadEntries = threads.map((thread) =>
    threadEntry(thread, byArea, currentDate),
  );
  const noteEntries = notes.map(noteEntry);

  const rows = [
    ...[...areas]
      .sort(worstFirst)
      .map((area) => ({
        area,
        entries: threadEntries.filter((entry) => entry.area?.id === area.id),
      }))
      .filter((row) => row.entries.length > 0),
    ...(noteEntries.length > 0
      ? [{ area: undefined, entries: noteEntries }]
      : []),
  ];

  return (
    <div className="overflow-x-auto">
      <div className="min-w-[52rem]">
        <div className="grid grid-cols-[9rem_repeat(5,minmax(0,1fr))] gap-x-2 border-b border-border/50 pb-1">
          <span />
          {COLUMNS.map((column) => (
            <span
              key={column.key}
              className={cn(
                "text-[10px] font-semibold uppercase tracking-wider",
                column.urgent
                  ? "text-condition-attention"
                  : "text-muted-foreground/55",
              )}
            >
              {column.label}
            </span>
          ))}
        </div>

        {rows.map((row) => (
          <div
            key={row.area?.id ?? "notes"}
            className="grid grid-cols-[9rem_repeat(5,minmax(0,1fr))] gap-x-2 border-b border-border/30 py-1"
          >
            <span className="flex min-w-0 items-center gap-1.5 pt-0.5">
              {row.area ? (
                <>
                  <span
                    className={cn(
                      "inline-flex shrink-0",
                      conditionTextClassName[row.area.condition],
                    )}
                    title={conditionLabels[row.area.condition]}
                  >
                    <AreaIcon icon={row.area.icon} className="size-3.5" />
                  </span>
                  <span className="truncate text-[13px] font-medium">
                    {row.area.name}
                  </span>
                </>
              ) : (
                <span className="truncate text-[13px] font-medium text-muted-foreground">
                  Notes
                </span>
              )}
            </span>

            {COLUMNS.map((column) => {
              const cell = row.entries
                .filter((entry) => columnOf(entry, currentDate) === column.key)
                .sort((a, b) => (a.when ?? Infinity) - (b.when ?? Infinity));

              return (
                <ul key={column.key} className="flex min-w-0 flex-col gap-0.5">
                  {cell.map((entry) => (
                    <li key={entry.id}>
                      <EntryLink
                        entry={entry}
                        className={cn(
                          "flex items-baseline gap-1 rounded px-1 py-0.5 text-[12px] leading-tight hover:bg-muted/60",
                          column.urgent && "bg-condition-attention/[0.05]",
                        )}
                      >
                        <span className="min-w-0 flex-1 truncate">
                          {rowText(entry)}
                        </span>
                        {/* Only the columns that span many days need a day. */}
                        {entry.when !== undefined &&
                          (column.key === "week" ||
                            column.key === "later" ||
                            column.key === "late") && (
                            <span className="shrink-0 text-[10px] tabular-nums text-muted-foreground/50">
                              {dateToken(entry.when, currentDate)}
                            </span>
                          )}
                      </EntryLink>
                    </li>
                  ))}
                </ul>
              );
            })}
          </div>
        ))}
      </div>
    </div>
  );
}

function worstFirst(a: DashboardArea, b: DashboardArea) {
  const rank = (area: DashboardArea) =>
    area.condition === "critical" ? 0 : area.condition === "healthy" ? 2 : 1;
  return rank(a) - rank(b) || a.order - b.order;
}
