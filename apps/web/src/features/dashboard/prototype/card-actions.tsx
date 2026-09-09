/**
 * PROTOTYPE — issue #314, round 7. Three ways to reach a card's actions.
 *
 * The Dashboard can say what needs attention but not yet let you clear it, so
 * every correction happens somewhere else and the board is always slightly
 * wrong. The verbs are small: **complete the move**, **push the Follow-up**,
 * and for a Note, **done**. The question is where they live.
 *
 *   A1 — a rail that appears on the card's edge on hover or focus.
 *   A2 — always visible: the leading tick and the date token are the controls.
 *   A3 — nothing at rest; clicking the card opens an action menu, and
 *        "Open Thread" becomes one item in it.
 *
 * A Thread with no Next Move has nothing to complete, so it offers only the
 * date; a standalone Note offers Done and its date. Every write is stubbed to
 * the prototype's local state — pushing a date really does move the card into
 * another column, which is the thing worth feeling.
 */
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@vita-os/ui/components/popover";
import { ArrowUpRight, CalendarClock, Check, X } from "lucide-react";

import { cn } from "@/lib/utils";

import type { PrototypeEntry } from "./prototype-shared";

import { DAY, startOfLocalDay } from "../components/dashboard-model";
import { AreaGlyph, DateToken } from "./dense-shared";
import { EntryLink } from "./prototype-shared";

export interface ActionTreatment {
  Card: (props: ActionCardProps) => React.ReactElement;
  claim: string;
  key: string;
  name: string;
}

export interface ActionCardProps {
  currentDate: number;
  entry: PrototypeEntry;
  /** Clear the item off the board — the move is done, or the Note is. */
  onDone: (entry: PrototypeEntry) => void;
  /** `undefined` clears the date entirely. */
  onPush: (entry: PrototypeEntry, when: number | undefined) => void;
}

/** The move leads when there is one; otherwise the Thread speaks for itself. */
function headline(entry: PrototypeEntry) {
  return entry.isNextMove && entry.detail ? entry.detail : entry.title;
}

function context(entry: PrototypeEntry) {
  if (entry.kind === "note") return "Note";
  if (entry.isNextMove && entry.detail) return entry.title;
  return entry.area?.name ?? "";
}

/** Only a captured move or a Note is a thing you can finish. */
function completable(entry: PrototypeEntry) {
  return entry.kind === "note" || entry.isNextMove;
}

function shellClassName(entry: PrototypeEntry, currentDate: number) {
  const late =
    entry.when !== undefined &&
    startOfLocalDay(entry.when) < startOfLocalDay(currentDate);
  return cn(
    "group relative h-full rounded-lg px-2.5 py-2 transition-colors hover:bg-muted/60",
    late && "bg-condition-attention/[0.06]",
  );
}

/** The headline, stretched so a click anywhere on the card still opens it. */
function Headline({ entry }: { entry: PrototypeEntry }) {
  return (
    <EntryLink
      entry={entry}
      className="min-w-0 flex-1 text-sm font-medium leading-snug line-clamp-2 after:absolute after:inset-0 after:content-['']"
    >
      {headline(entry)}
    </EntryLink>
  );
}

function ContextLine({ entry }: { entry: PrototypeEntry }) {
  return (
    <p className="mt-0.5 flex items-center gap-1.5 text-[12px] leading-snug text-muted-foreground/75">
      <AreaGlyph entry={entry} />
      <span className="truncate">{context(entry)}</span>
    </p>
  );
}

const PUSH_OPTIONS: { days: number | undefined; label: string }[] = [
  { label: "Today", days: 0 },
  { label: "Tomorrow", days: 1 },
  { label: "Next week", days: 7 },
  { label: "In a month", days: 30 },
];

/** The date menu, shared by all three treatments — only its trigger differs. */
function PushMenu({
  children,
  currentDate,
  entry,
  onPush,
  trigger,
}: {
  /** The trigger's contents, when the trigger is more than an icon. */
  children?: React.ReactNode;
  currentDate: number;
  entry: PrototypeEntry;
  onPush: (entry: PrototypeEntry, when: number | undefined) => void;
  trigger: React.ReactElement;
}) {
  return (
    <Popover>
      <PopoverTrigger render={trigger}>{children}</PopoverTrigger>
      <PopoverContent align="end" className="w-44 p-1">
        <div className="flex flex-col">
          {PUSH_OPTIONS.map((option) => (
            <button
              key={option.label}
              type="button"
              onClick={() =>
                onPush(
                  entry,
                  startOfLocalDay(currentDate) +
                    (option.days ?? 0) * DAY +
                    9 * 60 * 60 * 1000,
                )
              }
              className="flex h-8 items-center rounded-md px-2 text-left text-sm hover:bg-muted"
            >
              {option.label}
            </button>
          ))}
          {entry.when !== undefined && (
            <button
              type="button"
              onClick={() => onPush(entry, undefined)}
              className="flex h-8 items-center gap-1.5 rounded-md px-2 text-left text-sm text-muted-foreground hover:bg-muted"
            >
              <X className="size-3.5" />
              Clear date
            </button>
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
}

/* ── A1 · Hover rail ──────────────────────────────────────────────────────
   Nothing at rest: the card is exactly the C1 card you approved. On hover or
   keyboard focus, a small rail fades in at the top-right — tick to finish,
   clock to re-date. Costs no space and no ink until you point at it; the risk
   is that actions you cannot see are actions you forget you have. */
function HoverRail({ currentDate, entry, onDone, onPush }: ActionCardProps) {
  return (
    <div className={shellClassName(entry, currentDate)}>
      <div className="flex items-start gap-2">
        <Headline entry={entry} />
        <DateToken
          className="mt-0.5 transition-opacity group-hover:opacity-0 group-focus-within:opacity-0"
          currentDate={currentDate}
          when={entry.when}
        />
      </div>
      <ContextLine entry={entry} />

      <div className="pointer-events-none absolute right-1.5 top-1.5 z-10 flex items-center gap-0.5 opacity-0 transition-opacity group-hover:pointer-events-auto group-hover:opacity-100 group-focus-within:pointer-events-auto group-focus-within:opacity-100">
        {completable(entry) && (
          <button
            type="button"
            aria-label="Mark done"
            title="Mark done"
            onClick={() => onDone(entry)}
            className="inline-flex size-6 items-center justify-center rounded-md bg-background/90 text-muted-foreground shadow-sm ring-1 ring-border/60 hover:text-foreground"
          >
            <Check className="size-3.5" />
          </button>
        )}
        <PushMenu
          currentDate={currentDate}
          entry={entry}
          onPush={onPush}
          trigger={
            <button
              type="button"
              aria-label="Change date"
              title="Change date"
              className="inline-flex size-6 items-center justify-center rounded-md bg-background/90 text-muted-foreground shadow-sm ring-1 ring-border/60 hover:text-foreground"
            >
              <CalendarClock className="size-3.5" />
            </button>
          }
        />
      </div>
    </div>
  );
}

/* ── A2 · Always on ───────────────────────────────────────────────────────
   No new chrome: the two things already on the card become the controls. A
   tick box leads the headline (present only where there is something to
   finish), and the date token is a button that opens the menu — undated cards
   get a faint "+ date" in its place. Everything is visible and reachable
   without hovering, at the cost of a permanently busier card. */
function AlwaysOn({ currentDate, entry, onDone, onPush }: ActionCardProps) {
  return (
    <div className={shellClassName(entry, currentDate)}>
      <div className="flex items-start gap-2">
        {completable(entry) ? (
          <button
            type="button"
            aria-label="Mark done"
            title="Mark done"
            onClick={() => onDone(entry)}
            className="z-10 mt-0.5 inline-flex size-4 shrink-0 items-center justify-center rounded-[5px] border border-border text-transparent transition-colors hover:border-foreground/50 hover:text-muted-foreground"
          >
            <Check className="size-3" />
          </button>
        ) : (
          <span aria-hidden className="mt-0.5 size-4 shrink-0" />
        )}

        <Headline entry={entry} />

        <PushMenu
          currentDate={currentDate}
          entry={entry}
          onPush={onPush}
          trigger={
            <button
              type="button"
              aria-label="Change date"
              className={cn(
                "z-10 mt-0.5 shrink-0 rounded px-1 text-[11px] tabular-nums transition-colors hover:bg-muted",
                entry.when === undefined &&
                  "text-muted-foreground/40 opacity-0 group-hover:opacity-100 group-focus-within:opacity-100",
              )}
            />
          }
        >
          {entry.when === undefined ? (
            "+ date"
          ) : (
            <DateToken currentDate={currentDate} when={entry.when} />
          )}
        </PushMenu>
      </div>
      <ContextLine entry={entry} />
    </div>
  );
}

/* ── A3 · Action menu ─────────────────────────────────────────────────────
   The card stops being a link and becomes a menu: click it and everything it
   can do is listed, "Open Thread" included. Nothing is hidden behind a hover
   and nothing is added to the card — but the cheapest action (open the
   Thread) now costs two clicks instead of one. */
function ActionMenu({ currentDate, entry, onDone, onPush }: ActionCardProps) {
  return (
    <Popover>
      <PopoverTrigger
        render={
          <button
            type="button"
            className={cn(
              shellClassName(entry, currentDate),
              "w-full text-left focus-visible:ring-2 focus-visible:ring-ring/40",
            )}
          />
        }
      >
        <span className="flex w-full items-start gap-2">
          <span className="min-w-0 flex-1 text-sm font-medium leading-snug line-clamp-2">
            {headline(entry)}
          </span>
          <DateToken
            className="mt-0.5"
            currentDate={currentDate}
            when={entry.when}
          />
        </span>
        <ContextLine entry={entry} />
      </PopoverTrigger>

      <PopoverContent align="start" className="w-52 p-1">
        <div className="flex flex-col">
          <EntryLink
            entry={entry}
            className="flex h-8 items-center gap-2 rounded-md px-2 text-sm hover:bg-muted"
          >
            <ArrowUpRight className="size-3.5 text-muted-foreground" />
            {entry.kind === "note" ? "Open Notes" : "Open Thread"}
          </EntryLink>

          {completable(entry) && (
            <button
              type="button"
              onClick={() => onDone(entry)}
              className="flex h-8 items-center gap-2 rounded-md px-2 text-left text-sm hover:bg-muted"
            >
              <Check className="size-3.5 text-muted-foreground" />
              {entry.kind === "note" ? "Done" : "Move done"}
            </button>
          )}

          <div className="my-1 h-px bg-border/60" />
          <p className="px-2 pb-1 text-[10px] uppercase tracking-wider text-muted-foreground/60">
            Bring back
          </p>
          {PUSH_OPTIONS.map((option) => (
            <button
              key={option.label}
              type="button"
              onClick={() =>
                onPush(
                  entry,
                  startOfLocalDay(currentDate) +
                    (option.days ?? 0) * DAY +
                    9 * 60 * 60 * 1000,
                )
              }
              className="flex h-8 items-center rounded-md px-2 text-left text-sm hover:bg-muted"
            >
              {option.label}
            </button>
          ))}
          {entry.when !== undefined && (
            <button
              type="button"
              onClick={() => onPush(entry, undefined)}
              className="flex h-8 items-center gap-2 rounded-md px-2 text-left text-sm text-muted-foreground hover:bg-muted"
            >
              <X className="size-3.5" />
              Clear date
            </button>
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
}

export const ACTION_TREATMENTS: ActionTreatment[] = [
  {
    key: "A1",
    name: "Hover rail",
    claim:
      "Nothing at rest; a tick and a clock fade in at the card's edge on hover or focus. No cost to the card, but the actions are invisible until you look for them.",
    Card: HoverRail,
  },
  {
    key: "A2",
    name: "Always on",
    claim:
      "No new chrome: a leading tick box finishes the move and the date token itself opens the date menu. Always reachable, permanently busier.",
    Card: AlwaysOn,
  },
  {
    key: "A3",
    name: "Action menu",
    claim:
      "The card becomes a menu — every verb listed, including Open Thread. Nothing hidden, but opening a Thread now costs two clicks.",
    Card: ActionMenu,
  },
];
