import type { ReactElement } from "react";

import { Button } from "@vita-os/ui/components/button";
import { Calendar } from "@vita-os/ui/components/calendar";
import { Input } from "@vita-os/ui/components/input";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@vita-os/ui/components/popover";
import { cn } from "@vita-os/ui/lib/utils";
import {
  CalendarDays,
  CalendarOff,
  Check,
  ChevronDown,
  CircleCheckBig,
  Undo2,
} from "lucide-react";
import { useState } from "react";

import type { PlanActions } from "./item-parts";
import type { PlanItem } from "./model";

import { ItemContext, ItemGlyph, whenSummary } from "./item-parts";
import { dayTimestamp, WEEK_LENGTH } from "./model";

/**
 * The in-place editor every item on this surface shares.
 *
 * Everything you can decide about one item lives here: an exact date, a
 * cleared date, the single Next Move (write it, or tick it off), and the
 * terminal "this is done" action.
 */
export function ItemEditor({
  actions,
  item,
  now,
  open,
  onOpenChange,
  trigger,
}: {
  actions: PlanActions;
  item: PlanItem;
  now: number;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  trigger: ReactElement;
}) {
  const [draft, setDraft] = useState(item.nextMove ?? "");
  const [calendarOpen, setCalendarOpen] = useState(false);
  const selected = item.when === undefined ? undefined : new Date(item.when);
  const isThread = item.kind === "thread";

  function commitDraft() {
    const text = draft.trim();
    if (text !== (item.nextMove ?? "")) actions.setNextMove(item.id, text);
  }

  return (
    <Popover
      open={open}
      onOpenChange={(next) => {
        if (!next) commitDraft();
        else setDraft(item.nextMove ?? "");
        setCalendarOpen(false);
        onOpenChange(next);
      }}
    >
      <PopoverTrigger render={trigger} />
      <PopoverContent
        align="start"
        className="w-auto gap-0 p-0"
        // Opening the editor should not steal the caret into the move field.
        initialFocus={() => false}
        side="bottom"
        sideOffset={6}
      >
        <div className="flex items-start gap-2.5 px-3.5 pt-3.5 pb-3">
          <ItemGlyph item={item} />
          <div className="flex min-w-0 max-w-56 flex-col">
            <span className="truncate text-sm leading-snug font-medium">
              {item.title}
            </span>
            <span className="mt-0.5 flex items-center gap-1.5">
              <ItemContext item={item} />
              <span className="text-[11px] text-muted-foreground/50">·</span>
              <span className="truncate text-[11px] text-muted-foreground">
                {whenSummary(item, now)}
              </span>
            </span>
          </div>
        </div>

        {isThread && (
          <div className="border-t border-border/60 px-3.5 py-3">
            <span className="text-[11px] font-medium tracking-wide text-muted-foreground uppercase">
              Next move
            </span>
            <div className="mt-1.5 flex items-center gap-1.5">
              <Input
                value={draft}
                onChange={(event) => setDraft(event.target.value)}
                onBlur={commitDraft}
                onKeyDown={(event) => {
                  if (event.key === "Enter") {
                    event.preventDefault();
                    commitDraft();
                  }
                }}
                placeholder="One move, not a list"
                aria-label="Next move"
                className={cn(
                  "h-8 text-xs",
                  item.nextMoveDone && "text-muted-foreground/60 line-through",
                )}
              />
              {item.nextMove && (
                <Button
                  variant={item.nextMoveDone ? "secondary" : "outline"}
                  size="icon-sm"
                  aria-label={
                    item.nextMoveDone
                      ? "Reopen next move"
                      : "Mark next move done"
                  }
                  onClick={() => actions.toggleNextMoveDone(item.id)}
                >
                  {item.nextMoveDone ? <Undo2 /> : <Check />}
                </Button>
              )}
            </div>
          </div>
        )}

        <div className="flex flex-wrap gap-1.5 border-t border-border/60 px-3.5 py-2.5">
          <QuickDate
            label="Today"
            onSelect={() => actions.setWhen(item.id, dayTimestamp(0))}
            onDone={() => onOpenChange(false)}
          />
          <QuickDate
            label="Tomorrow"
            onSelect={() => actions.setWhen(item.id, dayTimestamp(1))}
            onDone={() => onOpenChange(false)}
          />
          <QuickDate
            label="Next week"
            onSelect={() => actions.setWhen(item.id, dayTimestamp(WEEK_LENGTH))}
            onDone={() => onOpenChange(false)}
          />
        </div>

        {/* Collapsed by default: an always-open calendar pushed this popover
            past 800px, putting Resolve out of reach on a laptop. */}
        <div className="border-t border-border/60">
          <button
            type="button"
            onClick={() => setCalendarOpen((value) => !value)}
            aria-expanded={calendarOpen}
            className="flex w-full items-center gap-1.5 px-3.5 py-2 text-[11px] font-medium text-muted-foreground transition-colors hover:bg-surface-3/70 hover:text-foreground"
          >
            <CalendarDays className="size-3.5" />
            Pick an exact date
            <ChevronDown
              className={cn(
                "ml-auto size-3.5 transition-transform",
                calendarOpen && "rotate-180",
              )}
            />
          </button>

          {calendarOpen && (
            <Calendar
              mode="single"
              className="border-t border-border/60 p-2.5 [--cell-size:--spacing(7.5)]"
              selected={selected}
              defaultMonth={selected}
              onSelect={(date) => {
                if (!date) return;
                actions.setWhen(item.id, date.getTime());
                onOpenChange(false);
              }}
            />
          )}
        </div>

        <div className="flex flex-col gap-0.5 border-t border-border/60 p-1.5">
          {item.when !== undefined && (
            <Button
              variant="ghost"
              size="sm"
              className="w-full justify-start gap-2 text-muted-foreground"
              onClick={() => {
                actions.setWhen(item.id, undefined);
                onOpenChange(false);
              }}
            >
              <CalendarOff />
              {isThread ? "Clear follow-up" : "Clear when"}
            </Button>
          )}
          <Button
            variant="ghost"
            size="sm"
            className="w-full justify-start gap-2 text-condition-healthy hover:bg-condition-healthy/10 hover:text-condition-healthy"
            onClick={() => {
              actions.resolve(item.id);
              onOpenChange(false);
            }}
          >
            <CircleCheckBig />
            {isThread ? "Resolve thread" : "Mark done"}
          </Button>
        </div>
      </PopoverContent>
    </Popover>
  );
}

function QuickDate({
  label,
  onDone,
  onSelect,
}: {
  label: string;
  onDone: () => void;
  onSelect: () => void;
}) {
  return (
    <Button
      variant="outline"
      size="xs"
      onClick={() => {
        onSelect();
        onDone();
      }}
    >
      {label}
    </Button>
  );
}
