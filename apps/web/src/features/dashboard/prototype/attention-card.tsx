import { cn } from "@/lib/utils";

/**
 * PROTOTYPE — issue #314, round 5. Three card treatments inside the fixed E1
 * layout.
 *
 * The decision so far: E1's four full-height time columns are the base, and
 * the **Next Move is the most relevant thing on a card** — not the Thread
 * title. But round 4 also established that dropping the title entirely is
 * disorienting, so the open question is only *how the title stays present*
 * while the move leads. Each treatment answers that differently:
 *
 *   C1 — title on a quiet second line under the move.
 *   C2 — title as a small eyebrow above the move.
 *   C3 — title folded inline after the move, one line total.
 *
 * A Thread with no Next Move falls back to its title as the headline in all
 * three: there is nothing more relevant to show. A standalone Note has only
 * its body, so it renders as a headline with no title line.
 */
import type { PrototypeEntry } from "./prototype-shared";

import { dayDelta } from "../components/dashboard-model";
import { AreaGlyph, DateToken } from "./dense-shared";
import { EntryLink } from "./prototype-shared";

export interface CardTreatment {
  Card: (props: CardProps) => React.ReactElement;
  /** What it does with the Thread title now that the move leads. */
  claim: string;
  key: string;
  name: string;
}

export interface CardProps {
  currentDate: number;
  entry: PrototypeEntry;
}

/** The move leads when there is one; otherwise the Thread speaks for itself. */
function headline(entry: PrototypeEntry) {
  return entry.isNextMove && entry.detail ? entry.detail : entry.title;
}

/** Present only when the headline is a move — then it names the Thread. */
function context(entry: PrototypeEntry) {
  return entry.isNextMove && entry.detail ? entry.title : undefined;
}

function shellClassName(entry: PrototypeEntry, currentDate: number) {
  const late =
    entry.when !== undefined && dayDelta(entry.when, currentDate) < 0;
  return cn(
    "h-full rounded-lg px-2.5 py-2 transition-colors hover:bg-muted/60",
    late && "bg-condition-attention/[0.06]",
  );
}

/* ── C1 · Move over title ─────────────────────────────────────────────────
   The move is the headline; the Thread name sits under it, quiet and small,
   with the Area glyph. Reads as "do this — on that Thread". */
function MoveOverTitle({ currentDate, entry }: CardProps) {
  const under = context(entry);

  return (
    <EntryLink entry={entry} className={shellClassName(entry, currentDate)}>
      <div className="flex items-start gap-2">
        <span className="min-w-0 flex-1 text-sm font-medium leading-snug line-clamp-2">
          {headline(entry)}
        </span>
        <DateToken
          className="mt-0.5"
          currentDate={currentDate}
          when={entry.when}
        />
      </div>
      <p className="mt-0.5 flex items-center gap-1.5 text-[12px] leading-snug text-muted-foreground/75">
        <AreaGlyph entry={entry} />
        <span className="truncate">{under ?? entry.area?.name ?? "Note"}</span>
      </p>
    </EntryLink>
  );
}

/* ── C2 · Eyebrow ─────────────────────────────────────────────────────────
   The Thread name goes above the move as a small eyebrow — you know where you
   are before you read what to do, without the title competing for weight. */
function EyebrowTitle({ currentDate, entry }: CardProps) {
  const above = context(entry);

  return (
    <EntryLink entry={entry} className={shellClassName(entry, currentDate)}>
      <div className="flex items-center gap-1.5">
        <AreaGlyph entry={entry} />
        <span className="min-w-0 flex-1 truncate text-[11px] uppercase tracking-wide text-muted-foreground/70">
          {above ?? entry.area?.name ?? "Note"}
        </span>
        <DateToken currentDate={currentDate} when={entry.when} />
      </div>
      <p className="mt-0.5 text-sm font-medium leading-snug line-clamp-2">
        {headline(entry)}
      </p>
    </EntryLink>
  );
}

/* ── C3 · Inline ──────────────────────────────────────────────────────────
   One line: the move, then the Thread name trailing behind it in muted text.
   The densest of the three — twice as many cards per column — at the cost of
   the title being easy to miss. */
function InlineTitle({ currentDate, entry }: CardProps) {
  const trail = context(entry);

  return (
    <EntryLink entry={entry} className={shellClassName(entry, currentDate)}>
      <div className="flex items-start gap-2">
        <AreaGlyph entry={entry} className="mt-1" />
        <p className="min-w-0 flex-1 text-[13px] leading-snug line-clamp-2">
          <span className="font-medium">{headline(entry)}</span>
          {trail && (
            <span className="text-muted-foreground/70"> · {trail}</span>
          )}
        </p>
        <DateToken
          className="mt-0.5"
          currentDate={currentDate}
          when={entry.when}
        />
      </div>
    </EntryLink>
  );
}

export const CARD_TREATMENTS: CardTreatment[] = [
  {
    key: "C1",
    name: "Move over title",
    claim:
      "Move is the headline; the Thread name sits under it in quiet small text with the Area glyph.",
    Card: MoveOverTitle,
  },
  {
    key: "C2",
    name: "Eyebrow",
    claim:
      "Thread name rides above the move as a small eyebrow — context first, then the action, without competing for weight.",
    Card: EyebrowTitle,
  },
  {
    key: "C3",
    name: "Inline",
    claim:
      "One line: move first, Thread name trailing in muted text. Twice the cards per column; the title is easier to miss.",
    Card: InlineTitle,
  },
];
