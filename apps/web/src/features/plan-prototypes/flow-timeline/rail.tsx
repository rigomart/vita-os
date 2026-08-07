import { conditionColors, conditionLabels } from "@convex/lib/condition";
import { Button } from "@vita-os/ui/components/button";
import { Calendar } from "@vita-os/ui/components/calendar";
import { Kbd } from "@vita-os/ui/components/kbd";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@vita-os/ui/components/popover";
import { Textarea } from "@vita-os/ui/components/textarea";
import { cn } from "@vita-os/ui/lib/utils";
import { format } from "date-fns";
import {
  CalendarDays,
  Check,
  CircleCheck,
  History,
  Inbox,
  MousePointerClick,
  X,
} from "lucide-react";
import { useEffect, useRef, useState } from "react";

import { AreaIcon } from "@/features/areas/components/area-icon";

import type { MockArea } from "../mock-data";
import type { PlanItem, QuickTarget } from "./model";

import { agoLabel, dayOffsetFrom, quickDate, quickTargets } from "./model";

export interface RailHandlers {
  onClose: () => void;
  onRemove: (id: string) => void;
  onSetDate: (id: string, date: number | undefined) => void;
  onSetNextMove: (id: string, nextMove: string | undefined) => void;
  onSetTitle: (id: string, title: string) => void;
}

export function ThreadRail({
  area,
  className,
  focusSignal,
  handlers,
  item,
  now,
}: {
  area?: MockArea;
  className?: string;
  /** Bumped by the parent to pull focus into the Next Move editor. */
  focusSignal: number;
  handlers: RailHandlers;
  item?: PlanItem;
  now: number;
}) {
  return (
    <aside
      aria-label="Thread editor"
      className={cn(
        "flex w-[360px] shrink-0 flex-col overflow-hidden rounded-xl border border-border bg-surface-2",
        className,
      )}
    >
      {item ? (
        <RailBody
          key={item.id}
          area={area}
          focusSignal={focusSignal}
          handlers={handlers}
          item={item}
          now={now}
        />
      ) : (
        <RailEmpty />
      )}
    </aside>
  );
}

function RailEmpty() {
  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-3 px-8 text-center">
      <span className="flex size-11 items-center justify-center rounded-xl bg-surface-3 text-muted-foreground">
        <MousePointerClick className="size-5" />
      </span>
      <p className="font-heading text-sm font-semibold">Pick something up</p>
      <p className="text-xs leading-relaxed text-muted-foreground">
        Select any row to reschedule its follow-up, rewrite the next move, or
        resolve it — without leaving the timeline.
      </p>
      <p className="flex items-center gap-1.5 text-[11px] text-muted-foreground/70">
        <Kbd>J</Kbd>
        <Kbd>K</Kbd>
        <span>to walk the plan</span>
      </p>
    </div>
  );
}

function RailBody({
  area,
  focusSignal,
  handlers,
  item,
  now,
}: {
  area?: MockArea;
  focusSignal: number;
  handlers: RailHandlers;
  item: PlanItem;
  now: number;
}) {
  const isTask = item.kind === "task";

  return (
    <>
      <header className="flex items-center gap-2 border-b border-border/60 px-4 py-3">
        {isTask ? (
          <>
            <span className="flex size-7 items-center justify-center rounded-lg bg-surface-3 text-muted-foreground">
              <Inbox className="size-3.5" />
            </span>
            <span className="min-w-0 flex-1 truncate text-xs font-medium text-muted-foreground">
              Inbox task
            </span>
          </>
        ) : (
          <>
            <span className="flex size-7 items-center justify-center rounded-lg bg-surface-3 text-brand-accent-foreground">
              <AreaIcon icon={area?.icon} className="size-3.5" />
            </span>
            <span className="min-w-0 flex-1 truncate text-xs font-medium">
              {area?.name}
            </span>
            {area && (
              <span
                title={conditionLabels[area.condition]}
                className={cn(
                  "size-1.5 shrink-0 rounded-full",
                  conditionColors[area.condition],
                )}
              />
            )}
          </>
        )}
        <Button
          variant="ghost"
          size="icon-xs"
          aria-label="Close"
          onClick={handlers.onClose}
          className="-mr-1 text-muted-foreground"
        >
          <X />
        </Button>
      </header>

      <div className="flex min-h-0 flex-1 flex-col gap-5 overflow-y-auto px-4 py-4">
        <div className="flex flex-col gap-2">
          <h3 className="font-heading text-lg leading-snug font-semibold tracking-tight">
            {item.title}
          </h3>
          {item.summary && (
            <p className="text-xs leading-relaxed text-muted-foreground">
              {item.summary}
            </p>
          )}
          {isTask && item.createdAt !== undefined && (
            <p className="text-[11px] text-muted-foreground/60">
              Captured {agoLabel(item.createdAt, now)}
            </p>
          )}
        </div>

        <FollowUpSection handlers={handlers} item={item} now={now} />

        {!isTask && (
          <NextMoveSection
            focusSignal={focusSignal}
            handlers={handlers}
            item={item}
          />
        )}

        {isTask && (
          <TaskTextSection
            focusSignal={focusSignal}
            handlers={handlers}
            item={item}
          />
        )}

        {item.lastActivity && (
          <section className="flex flex-col gap-1.5">
            <SectionLabel>Last activity</SectionLabel>
            <div className="flex gap-2 rounded-lg bg-surface-3/60 px-3 py-2.5">
              <History className="mt-0.5 size-3.5 shrink-0 text-muted-foreground/70" />
              <p className="text-xs leading-relaxed text-muted-foreground">
                {item.lastActivity.content}
                <span className="block pt-1 text-[11px] text-muted-foreground/60">
                  {agoLabel(item.lastActivity.createdAt, now)}
                </span>
              </p>
            </div>
          </section>
        )}
      </div>

      <footer className="flex items-center justify-between gap-2 border-t border-border/60 px-4 py-3">
        <span className="flex items-center gap-1 text-[11px] text-muted-foreground/70">
          <Kbd>R</Kbd>
          <span>{isTask ? "done" : "resolve"}</span>
        </span>
        <Button
          variant="outline"
          size="sm"
          onClick={() => {
            handlers.onRemove(item.id);
          }}
        >
          <CircleCheck />
          {isTask ? "Mark done" : "Resolve thread"}
        </Button>
      </footer>
    </>
  );
}

function SectionLabel({ children }: { children: string }) {
  return (
    <span className="text-[11px] font-semibold tracking-wide text-muted-foreground/70 uppercase">
      {children}
    </span>
  );
}

function followUpStatus(
  date: number | undefined,
  now: number,
): { tone: "attention" | "muted" | "today"; text: string } {
  if (date === undefined) return { tone: "muted", text: "No follow-up set" };

  const offset = dayOffsetFrom(date, now);
  if (offset < 0) {
    return {
      tone: "attention",
      text: `Waiting since ${format(new Date(date), "EEE, MMM d")}`,
    };
  }
  if (offset === 0) return { tone: "today", text: "Resurfaces today" };
  if (offset === 1) return { tone: "muted", text: "Resurfaces tomorrow" };

  return {
    tone: "muted",
    text: `Resurfaces ${format(new Date(date), "EEE, MMM d")}`,
  };
}

function FollowUpSection({
  handlers,
  item,
  now,
}: {
  handlers: RailHandlers;
  item: PlanItem;
  now: number;
}) {
  const [open, setOpen] = useState(false);
  const status = followUpStatus(item.date, now);
  const selected = item.date === undefined ? undefined : new Date(item.date);

  const isActive = (target: QuickTarget) =>
    item.date !== undefined &&
    dayOffsetFrom(quickDate(target, now), now) ===
      dayOffsetFrom(item.date, now);

  return (
    <section className="flex flex-col gap-2">
      <div className="flex items-baseline justify-between gap-2">
        <SectionLabel>
          {item.kind === "task" ? "When" : "Follow-up"}
        </SectionLabel>
        {item.date !== undefined && (
          <Button
            variant="ghost"
            size="xs"
            onClick={() => {
              handlers.onSetDate(item.id, undefined);
            }}
            className="-mr-2 text-muted-foreground"
          >
            Clear
          </Button>
        )}
      </div>

      <p
        className={cn(
          "text-xs font-medium",
          status.tone === "attention"
            ? "text-condition-attention"
            : status.tone === "today"
              ? "text-brand-accent-foreground"
              : "text-muted-foreground",
        )}
      >
        {status.text}
      </p>

      <div className="grid grid-cols-2 gap-1.5">
        {quickTargets.map((target) => (
          <Button
            key={target.key}
            variant={isActive(target.key) ? "secondary" : "outline"}
            size="sm"
            onClick={() => {
              handlers.onSetDate(item.id, quickDate(target.key, now));
            }}
            className="justify-between px-2.5 text-xs"
          >
            {target.label}
            <Kbd className="bg-transparent text-[10px] text-muted-foreground/70">
              {target.hint}
            </Kbd>
          </Button>
        ))}
      </div>

      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger
          render={
            <Button
              variant="ghost"
              size="sm"
              className="justify-start px-2.5 text-xs text-muted-foreground"
            />
          }
        >
          <CalendarDays />
          {selected ? format(selected, "EEEE, MMMM d") : "Pick an exact date"}
        </PopoverTrigger>
        <PopoverContent className="w-auto gap-0 p-0" align="start">
          <Calendar
            mode="single"
            selected={selected}
            onSelect={(date) => {
              if (!date) return;
              const next = new Date(date);
              next.setHours(9, 0, 0, 0);
              handlers.onSetDate(item.id, next.getTime());
              setOpen(false);
            }}
          />
          {selected && (
            <div className="border-t border-border/60 p-2">
              <Button
                variant="ghost"
                size="sm"
                className="w-full justify-start text-muted-foreground"
                onClick={() => {
                  handlers.onSetDate(item.id, undefined);
                  setOpen(false);
                }}
              >
                Clear follow-up
              </Button>
            </div>
          )}
        </PopoverContent>
      </Popover>
    </section>
  );
}

function NextMoveSection({
  focusSignal,
  handlers,
  item,
}: {
  focusSignal: number;
  handlers: RailHandlers;
  item: PlanItem;
}) {
  const [draft, setDraft] = useState(item.nextMove ?? "");
  const ref = useRef<HTMLTextAreaElement>(null);
  const mountedAt = useRef(focusSignal);

  useEffect(() => {
    // Only pull focus when the parent bumps the signal after mount.
    if (focusSignal === mountedAt.current) return;
    ref.current?.focus();
    ref.current?.select();
  }, [focusSignal]);

  const commit = () => {
    const value = draft.trim();
    if (value === (item.nextMove ?? "")) return;
    handlers.onSetNextMove(item.id, value === "" ? undefined : value);
  };

  return (
    <section className="flex flex-col gap-2">
      <div className="flex items-baseline justify-between gap-2">
        <SectionLabel>Next move</SectionLabel>
        {item.nextMove && (
          <Button
            variant="ghost"
            size="xs"
            onClick={() => {
              setDraft("");
              handlers.onSetNextMove(item.id, undefined);
            }}
            className="-mr-2 text-muted-foreground"
          >
            <Check />
            Mark done
          </Button>
        )}
      </div>
      <Textarea
        ref={ref}
        rows={2}
        value={draft}
        placeholder="The single next thing you'd do…"
        aria-label="Next move"
        onChange={(event) => {
          setDraft(event.target.value);
        }}
        onBlur={commit}
        onKeyDown={(event) => {
          if (event.key === "Enter" && !event.shiftKey) {
            event.preventDefault();
            commit();
            event.currentTarget.blur();
          }
          if (event.key === "Escape") {
            setDraft(item.nextMove ?? "");
            event.currentTarget.blur();
          }
        }}
        className="min-h-0 rounded-xl bg-input/60 px-3 py-2 text-xs leading-relaxed md:text-xs"
      />
      <p className="text-[11px] text-muted-foreground/60">
        One move only — <Kbd className="text-[10px]">↵</Kbd> saves.
      </p>
    </section>
  );
}

function TaskTextSection({
  focusSignal,
  handlers,
  item,
}: {
  focusSignal: number;
  handlers: RailHandlers;
  item: PlanItem;
}) {
  const [draft, setDraft] = useState(item.title);
  const ref = useRef<HTMLTextAreaElement>(null);
  const mountedAt = useRef(focusSignal);

  useEffect(() => {
    // Only pull focus when the parent bumps the signal after mount.
    if (focusSignal === mountedAt.current) return;
    ref.current?.focus();
    ref.current?.select();
  }, [focusSignal]);

  const commit = () => {
    const value = draft.trim();
    if (value === "" || value === item.title) {
      setDraft(item.title);
      return;
    }
    handlers.onSetTitle(item.id, value);
  };

  return (
    <section className="flex flex-col gap-2">
      <SectionLabel>Task</SectionLabel>
      <Textarea
        ref={ref}
        rows={2}
        value={draft}
        aria-label="Task text"
        onChange={(event) => {
          setDraft(event.target.value);
        }}
        onBlur={commit}
        onKeyDown={(event) => {
          if (event.key === "Enter" && !event.shiftKey) {
            event.preventDefault();
            commit();
            event.currentTarget.blur();
          }
        }}
        className="min-h-0 rounded-xl bg-input/60 px-3 py-2 text-xs leading-relaxed md:text-xs"
      />
    </section>
  );
}
