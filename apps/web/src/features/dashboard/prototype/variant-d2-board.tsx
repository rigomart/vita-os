import { cn } from "@/lib/utils";

/**
 * PROTOTYPE — issue #314, round 3. D2: "Board".
 *
 * Density by tiling rather than by listing: every open item is a small,
 * uniform tile — Area glyph, one line of text, one date token — packed four
 * or five across. A whole life fits above the fold, and urgency is read from
 * colour and position instead of from a paragraph.
 *
 * The one piece of chrome is a status strip: five counts, no prose.
 */
import type {
  DashboardArea,
  DashboardInboxNote,
  DashboardThread,
} from "../components/dashboard-model";
import type { PrototypeEntry } from "./prototype-shared";

import { dayDelta } from "../components/dashboard-model";
import { AreaGlyph, byAttention, dateToken, dateTone } from "./dense-shared";
import { rowText } from "./dense-shared";
import { areaMap, EntryLink, noteEntry, threadEntry } from "./prototype-shared";

export const variantD2Name = "Board";

export function VariantD2Board({
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
  ].sort(byAttention(currentDate));

  const count = (test: (entry: PrototypeEntry) => boolean) =>
    entries.filter(test).length;
  const late = count(
    (entry) =>
      entry.when !== undefined && dayDelta(entry.when, currentDate) < 0,
  );
  const today = count(
    (entry) =>
      entry.when !== undefined && dayDelta(entry.when, currentDate) === 0,
  );
  const week = count((entry) => {
    if (entry.when === undefined) return false;
    const delta = dayDelta(entry.when, currentDate);
    return delta >= 1 && delta <= 6;
  });
  const moves = count((entry) => entry.when === undefined && entry.isNextMove);

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center gap-4 border-b border-border/50 pb-2">
        <Count label="Late" value={late} urgent />
        <Count label="Today" value={today} />
        <Count label="This week" value={week} />
        <Count label="Ready to move" value={moves} />
        <Count label="Open" value={entries.length} muted />
      </div>

      <ul className="grid gap-1.5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5">
        {entries.map((entry) => (
          <Tile key={entry.id} currentDate={currentDate} entry={entry} />
        ))}
      </ul>
    </div>
  );
}

function Count({
  label,
  muted,
  urgent,
  value,
}: {
  label: string;
  muted?: boolean;
  urgent?: boolean;
  value: number;
}) {
  return (
    <span className="flex items-baseline gap-1.5">
      <span
        className={cn(
          "text-lg font-semibold tabular-nums leading-none",
          urgent && value > 0 && "text-condition-attention",
          muted && "text-muted-foreground",
        )}
      >
        {value}
      </span>
      <span className="text-[10px] uppercase tracking-wider text-muted-foreground/60">
        {label}
      </span>
    </span>
  );
}

function Tile({
  currentDate,
  entry,
}: {
  currentDate: number;
  entry: PrototypeEntry;
}) {
  const delta =
    entry.when === undefined ? undefined : dayDelta(entry.when, currentDate);
  const urgent = delta !== undefined && delta <= 0;

  return (
    <li>
      <EntryLink
        entry={entry}
        className={cn(
          "flex h-full items-start gap-1.5 rounded-md border px-2 py-1.5 hover:bg-muted/50",
          urgent
            ? "border-condition-attention/40 bg-condition-attention/[0.04]"
            : "border-border/50",
        )}
      >
        <AreaGlyph entry={entry} className="mt-px" />
        <span className="min-w-0 flex-1 text-[13px] leading-tight line-clamp-2">
          {rowText(entry)}
        </span>
        {entry.when !== undefined && (
          <time
            dateTime={new Date(entry.when).toISOString()}
            className={cn(
              "shrink-0 text-[11px] tabular-nums",
              dateTone(entry.when, currentDate),
            )}
          >
            {dateToken(entry.when, currentDate)}
          </time>
        )}
      </EntryLink>
    </li>
  );
}
