import { Button } from "@vita-os/ui/components/button";
import { Calendar } from "@vita-os/ui/components/calendar";
import { Input } from "@vita-os/ui/components/input";
import { Separator } from "@vita-os/ui/components/separator";
import { cn } from "@vita-os/ui/lib/utils";
import { format } from "date-fns";
import {
  CalendarDays,
  CalendarOff,
  Check,
  ChevronDown,
  CircleCheckBig,
} from "lucide-react";
import { type RefObject, useState } from "react";

import { AreaIcon } from "@/features/areas/components/area-icon";

import type { MockArea, MockThread } from "../mock-data";
import type { Horizon } from "./horizon-model";

/**
 * In-place editor for a single card.
 *
 * Everything a planner does to a Thread without leaving the board: retarget the
 * Follow-up (fuzzy chip or exact calendar day), rewrite or finish the Next
 * Move, or resolve the Thread outright.
 */

export interface CardEditorProps {
  area: MockArea | undefined;
  horizons: Horizon[];
  onCompleteNextMove: () => void;
  onResolve: () => void;
  onSetFollowUp: (followUp: number | undefined) => void;
  onSetNextMove: (text: string) => void;
  /** Focus lands here when the popover opens, so nothing scrolls or jumps. */
  titleRef: RefObject<HTMLHeadingElement | null>;
  thread: MockThread;
}

export function CardEditor({
  area,
  horizons,
  onCompleteNextMove,
  onResolve,
  onSetFollowUp,
  onSetNextMove,
  titleRef,
  thread,
}: CardEditorProps) {
  const [draft, setDraft] = useState(thread.nextMove ?? "");
  const [showCalendar, setShowCalendar] = useState(false);
  const selected =
    thread.followUp == null ? undefined : new Date(thread.followUp);
  const quickTargets = horizons.filter((horizon) => horizon.landing != null);

  function commitDraft() {
    const text = draft.trim();
    if (text === (thread.nextMove ?? "")) return;
    onSetNextMove(text);
  }

  return (
    <div className="w-[19.5rem]">
      <header className="px-3.5 pt-3.5 pb-3">
        {area && (
          <p className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
            <AreaIcon icon={area.icon} className="size-3" />
            <span className="truncate">{area.name}</span>
          </p>
        )}
        <h3
          ref={titleRef}
          tabIndex={-1}
          className="mt-1 font-heading text-sm leading-snug font-semibold text-foreground outline-hidden"
        >
          {thread.title}
        </h3>
      </header>

      <Separator />

      <section className="px-3.5 py-3">
        <p className="mb-1.5 text-[10px] font-semibold tracking-wider text-muted-foreground uppercase">
          Next move
        </p>
        <div className="flex items-center gap-1.5">
          <Input
            value={draft}
            onChange={(event) => setDraft(event.target.value)}
            onBlur={commitDraft}
            onKeyDown={(event) => {
              if (event.key === "Enter") {
                event.preventDefault();
                commitDraft();
                event.currentTarget.blur();
              }
              if (event.key === "Escape") {
                setDraft(thread.nextMove ?? "");
              }
            }}
            placeholder="What's the next useful action?"
            aria-label="Next move"
            className="h-8 text-[13px]"
          />
          <Button
            variant="ghost"
            size="icon-sm"
            aria-label="Mark next move done"
            title="Mark next move done"
            disabled={!thread.nextMove}
            onClick={() => {
              setDraft("");
              onCompleteNextMove();
            }}
            className="shrink-0 text-muted-foreground hover:text-condition-healthy"
          >
            <Check className="size-4" />
          </Button>
        </div>
        <p className="mt-1.5 text-[11px] text-muted-foreground/70">
          One Thread, one next move.
        </p>
      </section>

      <Separator />

      <section className="px-3.5 py-3">
        <div className="flex items-baseline justify-between">
          <p className="text-[10px] font-semibold tracking-wider text-muted-foreground uppercase">
            Follow-up
          </p>
          <p className="text-[11px] text-muted-foreground tabular-nums">
            {selected ? format(selected, "EEE d MMM") : "no date"}
          </p>
        </div>

        <div className="mt-2 flex flex-wrap gap-1">
          {quickTargets.map((horizon) => (
            <button
              key={horizon.key}
              type="button"
              onClick={() => onSetFollowUp(horizon.landing)}
              className="rounded-full bg-surface-3 px-2 py-1 text-[11px] font-medium text-muted-foreground transition-colors hover:bg-primary hover:text-primary-foreground"
            >
              {horizon.label}
            </button>
          ))}
          <button
            type="button"
            onClick={() => onSetFollowUp(undefined)}
            disabled={thread.followUp == null}
            className={cn(
              "flex items-center gap-1 rounded-full px-2 py-1 text-[11px] font-medium transition-colors",
              thread.followUp == null
                ? "text-muted-foreground/40"
                : "text-muted-foreground hover:bg-surface-3 hover:text-foreground",
            )}
          >
            <CalendarOff className="size-3" />
            Clear
          </button>
        </div>

        <button
          type="button"
          onClick={() => setShowCalendar((open) => !open)}
          aria-expanded={showCalendar}
          className="mt-2 flex w-full items-center gap-1.5 rounded-lg px-1.5 py-1.5 text-[11px] font-medium text-muted-foreground transition-colors hover:bg-surface-3 hover:text-foreground"
        >
          <CalendarDays className="size-3.5" />
          Pick an exact day
          <ChevronDown
            className={cn(
              "ml-auto size-3.5 transition-transform",
              showCalendar && "rotate-180",
            )}
          />
        </button>

        {showCalendar && (
          <div className="-mx-1 duration-150 animate-in fade-in slide-in-from-top-1">
            <Calendar
              mode="single"
              selected={selected}
              defaultMonth={selected}
              onSelect={(date) => {
                if (!date) return;
                onSetFollowUp(
                  new Date(
                    date.getFullYear(),
                    date.getMonth(),
                    date.getDate(),
                    9,
                  ).getTime(),
                );
              }}
              className="w-full p-0 [--cell-size:--spacing(7)]"
            />
          </div>
        )}
      </section>

      <Separator />

      <footer className="px-2 py-2">
        <Button
          variant="ghost"
          size="sm"
          onClick={onResolve}
          className="w-full justify-start gap-2 text-muted-foreground hover:text-condition-healthy"
        >
          <CircleCheckBig className="size-4" />
          Resolve thread
          <span className="ml-auto text-[11px] text-muted-foreground/60">
            leaves the board
          </span>
        </Button>
      </footer>
    </div>
  );
}
