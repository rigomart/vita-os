/**
 * PROTOTYPE — issue #314, round 2. Four ways to draw ONE Thread row.
 *
 * Round 1 prototyped page layouts and the verdict was that the row itself is
 * the problem: it reads like a ledger — a date rail, a title column, a detail
 * column, a quiet counter and an Area column, all competing on one line. So
 * this round holds the page still and varies only the row, and every treatment
 * is under a hard budget: at most two pieces of metadata visible at rest.
 *
 * The four disagree about *where the metadata goes*: R1 drops it, R2 folds it
 * into prose, R3 gives it a second surface, R4 hides it until you look.
 */
import { ArrowRight } from "lucide-react";

import { AreaIcon } from "@/features/areas/components/area-icon";
import { conditionTextClassName } from "@/features/areas/condition-presentation";
import { cn } from "@/lib/utils";

import type { PrototypeEntry } from "./prototype-shared";

import { dayDelta, relativeDayLabel } from "../components/dashboard-model";
import { EntryLink } from "./prototype-shared";

export interface RowTreatment {
  /** What this treatment does with everything that used to be a column. */
  claim: string;
  Row: (props: RowProps) => React.ReactElement;
  key: string;
  name: string;
  /** Rows are laid out by the treatment, not by the lab. */
  listClassName: string;
}

export interface RowProps {
  currentDate: number;
  entry: PrototypeEntry;
  /** True for the run above the fold — the treatment may show more here. */
  urgent: boolean;
}

/** The only date phrasing any treatment uses: short, and only when it earns it. */
function dateWord(when: number | undefined, currentDate: number) {
  if (when === undefined) return undefined;
  const delta = dayDelta(when, currentDate);
  if (delta < -1) return `${-delta} days late`;
  if (delta === -1) return "yesterday";
  if (delta === 0) return "today";
  if (delta === 1) return "tomorrow";
  return relativeDayLabel(when, currentDate);
}

function isPressing(when: number | undefined, currentDate: number) {
  return when !== undefined && dayDelta(when, currentDate) <= 1;
}

function AreaDot({ entry }: { entry: PrototypeEntry }) {
  if (entry.kind === "note") {
    return (
      <span
        aria-hidden
        title="Note"
        className="size-1.5 shrink-0 rounded-full border border-muted-foreground/50"
      />
    );
  }
  if (!entry.area) return null;
  return (
    <span
      aria-hidden
      title={entry.area.name}
      className={cn(
        "size-1.5 shrink-0 rounded-full bg-current",
        conditionTextClassName[entry.area.condition],
      )}
    />
  );
}

/* ── R1 · Quiet lines ─────────────────────────────────────────────────────
   One line per Thread. The title carries the row; the only other thing on it
   is a date, and only when the date is pressing. The Next Move gets a second
   line for urgent rows only — everywhere else the title is the whole row. */
function QuietLineRow({ currentDate, entry, urgent }: RowProps) {
  const word = dateWord(entry.when, currentDate);
  const pressing = isPressing(entry.when, currentDate);

  return (
    <li>
      <EntryLink
        entry={entry}
        className="-mx-2 rounded-lg px-2 py-2.5 hover:bg-muted/50"
      >
        <div className="flex items-baseline gap-2.5">
          <AreaDot entry={entry} />
          <span className="min-w-0 flex-1 truncate text-[15px] leading-relaxed">
            {entry.title}
          </span>
          {word && pressing && (
            <span
              className={cn(
                "shrink-0 text-xs",
                dayDelta(entry.when ?? 0, currentDate) < 0
                  ? "text-condition-attention"
                  : "text-muted-foreground",
              )}
            >
              {word}
            </span>
          )}
          {word && !pressing && (
            <span className="shrink-0 text-xs text-muted-foreground/50">
              {word}
            </span>
          )}
        </div>
        {urgent && entry.detail && (
          <p className="mt-0.5 truncate pl-4 text-[13px] text-muted-foreground">
            {entry.detail}
          </p>
        )}
      </EntryLink>
    </li>
  );
}

/* ── R2 · Sentences ───────────────────────────────────────────────────────
   No chips, no columns, no rail — the row is a sentence a person could say
   out loud. The Next Move IS the row (the Thread title becomes the quiet
   half), and the date is the tail of the sentence rather than a coordinate. */
function SentenceRow({ currentDate, entry }: RowProps) {
  const word = dateWord(entry.when, currentDate);
  const lead = entry.isNextMove && entry.detail ? entry.detail : entry.title;
  const trail = entry.isNextMove && entry.detail ? entry.title : undefined;
  const late =
    entry.when !== undefined && dayDelta(entry.when, currentDate) < 0;

  return (
    <li>
      <EntryLink
        entry={entry}
        className="-mx-2 rounded-lg px-2 py-2 hover:bg-muted/50"
      >
        <p className="text-[15px] leading-relaxed">
          <span className="text-foreground">{lead}</span>
          {trail && (
            <span className="text-muted-foreground/70"> — {trail}</span>
          )}
          {word && (
            <span
              className={cn(
                late ? "text-condition-attention" : "text-muted-foreground/70",
              )}
            >
              , {word}
            </span>
          )}
        </p>
      </EntryLink>
    </li>
  );
}

/* ── R3 · Cards ───────────────────────────────────────────────────────────
   The metadata stops sharing a line with the title: the title owns the top of
   a small card, the Next Move sits under it, and the date and Area sit alone
   on a quiet footer. Fewer rows fit on screen — that is the trade being
   tested. */
function CardRow({ currentDate, entry }: RowProps) {
  const word = dateWord(entry.when, currentDate);
  const late =
    entry.when !== undefined && dayDelta(entry.when, currentDate) < 0;

  return (
    <li>
      <EntryLink
        entry={entry}
        className="h-full rounded-xl border border-border/60 p-3.5 hover:border-border hover:bg-muted/30"
      >
        <p className="truncate text-[15px] font-medium">{entry.title}</p>
        {entry.detail && (
          <p className="mt-1 flex items-baseline gap-1 text-[13px] text-muted-foreground">
            {entry.isNextMove && (
              <ArrowRight aria-hidden className="size-3 shrink-0" />
            )}
            <span className="truncate">{entry.detail}</span>
          </p>
        )}
        <p className="mt-2.5 flex items-center gap-1.5 text-xs text-muted-foreground/60">
          {entry.kind === "note" ? (
            <span>Note</span>
          ) : (
            entry.area && (
              <>
                <AreaIcon icon={entry.area.icon} className="size-3.5" />
                <span>{entry.area.name}</span>
              </>
            )
          )}
          {word && (
            <>
              <span aria-hidden>·</span>
              <span className={cn(late && "text-condition-attention")}>
                {word}
              </span>
            </>
          )}
        </p>
      </EntryLink>
    </li>
  );
}

/* ── R4 · Peek ────────────────────────────────────────────────────────────
   At rest every row is a bare title — the calmest possible list. Date, Next
   Move, Area and last activity only appear on the row you are actually
   looking at (hover or keyboard focus), so density is a function of attention
   rather than of how much a Thread happens to have on it. */
function PeekRow({ currentDate, entry }: RowProps) {
  const word = dateWord(entry.when, currentDate);
  const late =
    entry.when !== undefined && dayDelta(entry.when, currentDate) < 0;

  return (
    <li>
      <EntryLink
        entry={entry}
        className="group -mx-2 rounded-lg px-2 py-2 hover:bg-muted/50"
      >
        <div className="flex items-baseline gap-2.5">
          <span className="min-w-0 flex-1 truncate text-[15px] leading-relaxed">
            {entry.title}
          </span>
          {/* Late is the one thing that cannot wait to be looked at. */}
          {late && (
            <span className="shrink-0 text-xs text-condition-attention">
              {word}
            </span>
          )}
        </div>
        <div className="grid grid-rows-[0fr] transition-all duration-150 group-hover:grid-rows-[1fr] group-focus-visible:grid-rows-[1fr]">
          <div className="overflow-hidden">
            <p className="flex items-baseline gap-1.5 pt-0.5 text-[13px] text-muted-foreground">
              {entry.detail && <span className="truncate">{entry.detail}</span>}
              {entry.detail && <span aria-hidden>·</span>}
              {entry.kind === "note" ? (
                <span className="shrink-0">Note</span>
              ) : (
                <span className="shrink-0">{entry.area?.name}</span>
              )}
              {word && !late && (
                <>
                  <span aria-hidden>·</span>
                  <span className="shrink-0">{word}</span>
                </>
              )}
            </p>
          </div>
        </div>
      </EntryLink>
    </li>
  );
}

export const ROW_TREATMENTS: RowTreatment[] = [
  {
    key: "R1",
    name: "Quiet lines",
    claim:
      "One line, one piece of metadata. The date shows only when it is pressing; the Next Move only for rows that need you now.",
    Row: QuietLineRow,
    listClassName: "flex flex-col",
  },
  {
    key: "R2",
    name: "Sentences",
    claim:
      "No columns at all — the Next Move becomes the row and the Thread title and date are folded into the sentence.",
    Row: SentenceRow,
    listClassName: "flex flex-col",
  },
  {
    key: "R3",
    name: "Cards",
    claim:
      "Metadata leaves the title's line entirely and sits alone on a card footer. Costs vertical space; buys a calm title.",
    Row: CardRow,
    listClassName: "grid gap-2.5 sm:grid-cols-2 xl:grid-cols-3",
  },
  {
    key: "R4",
    name: "Peek",
    claim:
      "Bare titles at rest; everything but a late date appears only on the row you are looking at.",
    Row: PeekRow,
    listClassName: "flex flex-col",
  },
];
