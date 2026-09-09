/**
 * PROTOTYPE — issue #314. How a card's actions are reached.
 *
 * Settled at A1: nothing at rest, and on hover or keyboard focus a small rail
 * fades in at the card's top-right — tick to finish, clock to re-date — while
 * the date token fades out to make room. The card at rest stays exactly the C1
 * card.
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
import { CalendarClock, Check, X } from "lucide-react";

import { cn } from "@/lib/utils";

import type { PrototypeEntry } from "./prototype-shared";

import { DAY, startOfLocalDay } from "../components/dashboard-model";
import { AreaGlyph, DateToken } from "./dense-shared";
import { EntryLink } from "./prototype-shared";

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
export function completable(entry: PrototypeEntry) {
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

export const PUSH_OPTIONS: { days: number | undefined; label: string }[] = [
  { label: "Today", days: 0 },
  { label: "Tomorrow", days: 1 },
  { label: "Next week", days: 7 },
  { label: "In a month", days: 30 },
];

/** The date menu, shared by Thread cards and Note paper alike. */
export function PushMenu({
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

/** The settled card: C1 content, with the action rail on hover or focus. */
export function ActionCard({
  currentDate,
  entry,
  onDone,
  onPush,
}: ActionCardProps) {
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
