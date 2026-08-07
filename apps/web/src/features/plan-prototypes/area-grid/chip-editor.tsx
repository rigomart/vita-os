import { conditionLabels } from "@convex/lib/condition";
import { Button } from "@vita-os/ui/components/button";
import { Calendar } from "@vita-os/ui/components/calendar";
import { Input } from "@vita-os/ui/components/input";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@vita-os/ui/components/tooltip";
import { cn } from "@vita-os/ui/lib/utils";
import { addDays, format, startOfDay } from "date-fns";
import { CalendarDays, Check, CircleCheckBig, X } from "lucide-react";
import { useState } from "react";

import { AreaIcon } from "@/features/areas/components/area-icon";

import type { MockArea, MockThread } from "../mock-data";
import type { PlanAction } from "./plan-state";

import { mockAreas } from "../mock-data";
import { columnFor, dayDelta, followUpLabel } from "./model";

/** Section heading inside the editor. */
function FieldLabel({ children }: { children: string }) {
  return (
    <span className="text-[10px] font-semibold tracking-[0.09em] text-muted-foreground/80 uppercase">
      {children}
    </span>
  );
}

function atMorning(date: Date): number {
  return new Date(
    date.getFullYear(),
    date.getMonth(),
    date.getDate(),
    9,
  ).getTime();
}

/**
 * In-place Thread editor for a grid chip: retarget the Follow-up, rewrite or
 * complete the single Next Move, move the Thread to another Area, or resolve
 * it. Deliberately has no subtask affordance — a Thread has one Next Move.
 */
export function ChipEditor({
  area,
  dispatch,
  now,
  onClose,
  thread,
}: {
  area: MockArea | undefined;
  dispatch: (action: PlanAction) => void;
  now: number;
  onClose: () => void;
  thread: MockThread;
}) {
  const [draft, setDraft] = useState(thread.nextMove ?? "");
  const [calendarOpen, setCalendarOpen] = useState(false);

  const base = startOfDay(new Date(now));
  const isoDay = (base.getDay() + 6) % 7;
  const nextWeekStart = addDays(base, 7 - isoDay);
  const column = columnFor(thread.followUp, now);
  const overdue = column === "overdue";

  const quickTargets = [
    { label: "Today", at: atMorning(base) },
    { label: "Tomorrow", at: atMorning(addDays(base, 1)) },
    { label: "Next week", at: atMorning(nextWeekStart) },
  ];

  // Date edits keep the editor open so a mis-click can be corrected and a date
  // can be chained with a Next Move rewrite. Only the two terminal actions —
  // Resolve and Move to Area — close it.
  function setFollowUp(followUp: number | undefined) {
    dispatch({ followUp, threadId: thread.id, type: "set-follow-up" });
  }

  function commitDraft() {
    dispatch({ text: draft, threadId: thread.id, type: "set-next-move" });
  }

  return (
    // Capped and scrollable: with the calendar expanded this stack is taller
    // than a short viewport, and the Resolve action must stay reachable.
    <div className="flex max-h-[70vh] flex-col overflow-y-auto">
      <header className="px-3.5 pt-3.5 pb-3">
        <span className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
          <AreaIcon icon={area?.icon} className="size-3" />
          <span className="truncate">{area?.name ?? "Unassigned"}</span>
          {area && (
            <>
              <span aria-hidden className="text-muted-foreground/40">
                ·
              </span>
              <span className="truncate">
                {conditionLabels[area.condition]}
              </span>
            </>
          )}
        </span>
        <h3 className="mt-1 font-heading text-sm leading-snug font-semibold">
          {thread.title}
        </h3>
      </header>

      <section className="border-t border-border/60 px-3.5 py-3">
        <FieldLabel>Next Move</FieldLabel>
        <div className="mt-1.5 flex items-center gap-1.5">
          <Input
            value={draft}
            placeholder="The one next step"
            className="h-8 rounded-lg bg-input/50 px-2.5 text-xs md:text-xs"
            onChange={(event) => setDraft(event.target.value)}
            onBlur={commitDraft}
            onKeyDown={(event) => {
              if (event.key === "Enter") {
                event.preventDefault();
                commitDraft();
                event.currentTarget.blur();
              }
            }}
          />
          <Tooltip>
            <TooltipTrigger
              render={
                <Button
                  variant="outline"
                  size="icon-sm"
                  aria-label="Mark Next Move done"
                  disabled={!thread.nextMove}
                  className="shrink-0 rounded-lg"
                  onClick={() => {
                    dispatch({
                      threadId: thread.id,
                      type: "complete-next-move",
                    });
                    setDraft("");
                  }}
                />
              }
            >
              <Check />
            </TooltipTrigger>
            <TooltipContent>Mark done</TooltipContent>
          </Tooltip>
        </div>
      </section>

      <section className="border-t border-border/60 px-3.5 py-3">
        <div className="flex items-baseline justify-between gap-2">
          <FieldLabel>Follow-up</FieldLabel>
          <span
            className={cn(
              "text-[11px] tabular-nums",
              overdue ? "text-condition-attention" : "text-muted-foreground",
            )}
          >
            {thread.followUp == null
              ? "None set"
              : `${format(new Date(thread.followUp), "EEE d MMM")} · ${followUpLabel(thread.followUp, now)}`}
          </span>
        </div>

        <div className="mt-2 flex flex-wrap items-center gap-1">
          {quickTargets.map((target) => {
            const active =
              thread.followUp != null &&
              dayDelta(thread.followUp, target.at) === 0;

            return (
              <Button
                key={target.label}
                variant={active ? "secondary" : "outline"}
                size="xs"
                className="rounded-lg"
                onClick={() => setFollowUp(target.at)}
              >
                {target.label}
              </Button>
            );
          })}
          <Button
            variant={calendarOpen ? "secondary" : "outline"}
            size="xs"
            aria-label="Pick an exact date"
            aria-expanded={calendarOpen}
            className="rounded-lg px-2"
            onClick={() => setCalendarOpen((value) => !value)}
          >
            <CalendarDays />
          </Button>
          {thread.followUp != null && (
            <Button
              variant="ghost"
              size="xs"
              className="ml-auto rounded-lg text-muted-foreground"
              onClick={() => setFollowUp(undefined)}
            >
              <X />
              Clear
            </Button>
          )}
        </div>

        {calendarOpen && (
          <div className="mt-2 -mx-1 rounded-xl border border-border/60">
            <Calendar
              mode="single"
              selected={
                thread.followUp == null ? undefined : new Date(thread.followUp)
              }
              onSelect={(date) => {
                if (!date) return;
                setFollowUp(atMorning(date));
              }}
              className="w-full [--cell-size:--spacing(7.5)] p-2"
            />
          </div>
        )}
      </section>

      <section className="border-t border-border/60 px-3.5 py-3">
        <FieldLabel>Move to Area</FieldLabel>
        <div className="mt-1.5 flex flex-wrap gap-1">
          {mockAreas.map((candidate) => {
            const current = candidate.id === thread.areaId;

            return (
              <Tooltip key={candidate.id}>
                <TooltipTrigger
                  render={
                    <Button
                      variant={current ? "secondary" : "ghost"}
                      size="icon-sm"
                      aria-label={`Move to ${candidate.name}`}
                      aria-pressed={current}
                      disabled={current}
                      className={cn(
                        "rounded-lg",
                        !current && "text-muted-foreground",
                      )}
                      onClick={() => {
                        dispatch({
                          threadId: thread.id,
                          toAreaId: candidate.id,
                          type: "move-area",
                        });
                        onClose();
                      }}
                    />
                  }
                >
                  <AreaIcon icon={candidate.icon} className="size-3.5" />
                </TooltipTrigger>
                <TooltipContent>
                  {current ? `${candidate.name} (current)` : candidate.name}
                </TooltipContent>
              </Tooltip>
            );
          })}
        </div>
      </section>

      <footer className="border-t border-border/60 p-2">
        <Button
          variant="ghost"
          size="sm"
          className="w-full justify-start rounded-lg text-muted-foreground hover:text-foreground"
          onClick={() => {
            dispatch({ threadId: thread.id, type: "resolve" });
            onClose();
          }}
        >
          <CircleCheckBig />
          Resolve Thread
        </Button>
      </footer>
    </div>
  );
}
