import type { LucideIcon } from "lucide-react";

import { useDraggable, useDroppable } from "@dnd-kit/core";
import { Button } from "@vita-os/ui/components/button";
import { Input } from "@vita-os/ui/components/input";
import { Kbd } from "@vita-os/ui/components/kbd";
import { cn } from "@vita-os/ui/lib/utils";
import { format } from "date-fns";
import {
  ArrowRight,
  CalendarOff,
  Check,
  CircleCheckBig,
  GripVertical,
  PartyPopper,
  Pencil,
  SkipForward,
  Undo2,
  X,
} from "lucide-react";
import { useEffect, useRef, useState } from "react";

import type { PlanActions } from "./item-parts";
import type { PlanItem, WeekModel } from "./model";

import { ItemContext, ItemGlyph, whenSummary } from "./item-parts";
import { dayTarget, dayTimestamp, isOverdue, WEEK_LENGTH } from "./model";

/** What the pass produced, for the closing moment. */
interface ReviewLog {
  cleared: number;
  resolved: number;
  scheduled: number;
  skipped: number;
}

const EMPTY_LOG: ReviewLog = {
  cleared: 0,
  resolved: 0,
  scheduled: 0,
  skipped: 0,
};

/**
 * The ritual itself: one card at a time, the whole week in reach, every
 * decision one key away. The queue is snapshotted when the review starts so
 * the pile does not shuffle underneath you as you empty it.
 */
export function ReviewMode({
  actions,
  items,
  now,
  onExit,
  queue,
  week,
}: {
  actions: PlanActions;
  items: PlanItem[];
  now: number;
  onExit: () => void;
  queue: string[];
  week: WeekModel;
}) {
  const [index, setIndex] = useState(0);
  const [log, setLog] = useState<ReviewLog>(EMPTY_LOG);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState("");

  const item = items.find((candidate) => candidate.id === queue[index]);
  const finished = index >= queue.length;

  function advance() {
    setEditing(false);
    setIndex((current) => current + 1);
  }

  function schedule(id: string, when: number) {
    actions.setWhen(id, when);
    setLog((current) => ({ ...current, scheduled: current.scheduled + 1 }));
    advance();
  }

  function clearDate(id: string) {
    actions.setWhen(id, undefined);
    setLog((current) => ({ ...current, cleared: current.cleared + 1 }));
    advance();
  }

  function resolve(id: string) {
    actions.resolve(id);
    setLog((current) => ({ ...current, resolved: current.resolved + 1 }));
    advance();
  }

  function skip() {
    setLog((current) => ({ ...current, skipped: current.skipped + 1 }));
    advance();
  }

  function startEditing(current: PlanItem) {
    setDraft(current.nextMove ?? "");
    setEditing(true);
  }

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if (event.metaKey || event.ctrlKey || event.altKey) return;

      const target = event.target as HTMLElement | null;
      const typing =
        target?.tagName === "INPUT" || target?.tagName === "TEXTAREA";
      if (typing) return;

      if (event.key === "Escape") {
        event.preventDefault();
        onExit();
        return;
      }
      if (!item) return;

      const digit = Number(event.key);
      if (Number.isInteger(digit) && digit >= 1 && digit <= WEEK_LENGTH) {
        event.preventDefault();
        schedule(item.id, dayTimestamp(digit - 1));
        return;
      }

      switch (event.key.toLowerCase()) {
        case "0":
        case "backspace":
          if (item.when !== undefined) {
            event.preventDefault();
            clearDate(item.id);
          }
          break;
        case "n":
          event.preventDefault();
          schedule(item.id, dayTimestamp(WEEK_LENGTH));
          break;
        case "e":
          if (item.kind === "thread") {
            event.preventDefault();
            startEditing(item);
          }
          break;
        case "r":
          event.preventDefault();
          resolve(item.id);
          break;
        case "s":
        case "arrowright":
          event.preventDefault();
          skip();
          break;
        case "arrowleft":
          event.preventDefault();
          setIndex((current) => Math.max(0, current - 1));
          break;
        default:
          break;
      }
    }

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  });

  const decided = log.scheduled + log.cleared + log.resolved;

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-5">
      <header className="flex flex-col gap-2.5">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-baseline gap-2.5">
            <h3 className="font-heading text-base font-semibold tracking-tight">
              Weekly review
            </h3>
            <span className="text-xs text-muted-foreground tabular-nums">
              {finished
                ? `${queue.length} of ${queue.length}`
                : `${index + 1} of ${queue.length}`}
            </span>
          </div>
          <Button variant="ghost" size="xs" onClick={onExit}>
            <X data-icon="inline-start" />
            Exit
            <Kbd className="ml-1">Esc</Kbd>
          </Button>
        </div>
        <span className="h-1 overflow-hidden rounded-full bg-border/60">
          <span
            className="block h-full rounded-full bg-primary transition-[width] duration-300"
            style={{
              width: `${(Math.min(index, queue.length) / Math.max(1, queue.length)) * 100}%`,
            }}
          />
        </span>
      </header>

      {finished || !item ? (
        <ReviewDone log={log} onExit={onExit} total={queue.length} />
      ) : (
        <>
          <ReviewCard
            actions={actions}
            draft={draft}
            editing={editing}
            item={item}
            now={now}
            onDraftChange={setDraft}
            onEdit={() => startEditing(item)}
            onStopEditing={(commit) => {
              if (commit) actions.setNextMove(item.id, draft.trim());
              setEditing(false);
            }}
          />

          <ScheduleRow
            item={item}
            onPick={(dayIndex) => schedule(item.id, dayTimestamp(dayIndex))}
            week={week}
          />

          <div className="flex flex-wrap items-center gap-1.5">
            <ReviewAction
              icon={ArrowRight}
              keyHint="N"
              label="Push to next week"
              onSelect={() => schedule(item.id, dayTimestamp(WEEK_LENGTH))}
            />
            {item.when !== undefined && (
              <ReviewAction
                icon={CalendarOff}
                keyHint="0"
                label={
                  item.kind === "thread" ? "Clear follow-up" : "Clear when"
                }
                onSelect={() => clearDate(item.id)}
              />
            )}
            {item.kind === "thread" && (
              <ReviewAction
                icon={Pencil}
                keyHint="E"
                label={item.nextMove ? "Edit move" : "Add move"}
                onSelect={() => startEditing(item)}
              />
            )}
            <ReviewAction
              icon={CircleCheckBig}
              keyHint="R"
              label={item.kind === "thread" ? "Resolve" : "Mark done"}
              onSelect={() => resolve(item.id)}
              tone="healthy"
            />
            <ReviewAction
              icon={SkipForward}
              keyHint="S"
              label="Skip"
              onSelect={skip}
            />
          </div>

          <p className="text-[11px] text-muted-foreground/70">
            <span className="tabular-nums">{decided}</span> decided ·{" "}
            <span className="tabular-nums">{log.skipped}</span> left for later ·
            drag the card onto a day, or use the keys.
          </p>
        </>
      )}
    </div>
  );
}

function ReviewCard({
  actions,
  draft,
  editing,
  item,
  now,
  onDraftChange,
  onEdit,
  onStopEditing,
}: {
  actions: PlanActions;
  draft: string;
  editing: boolean;
  item: PlanItem;
  now: number;
  onDraftChange: (value: string) => void;
  onEdit: () => void;
  onStopEditing: (commit: boolean) => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const { attributes, isDragging, listeners, setNodeRef } = useDraggable({
    data: { item },
    id: item.id,
  });
  const stale = isOverdue(item, now);

  useEffect(() => {
    if (editing) inputRef.current?.focus();
  }, [editing]);

  return (
    <article
      className={cn(
        "rounded-2xl border border-border/70 bg-surface-2 p-5 transition-opacity",
        isDragging && "opacity-40",
      )}
    >
      <div className="flex items-start gap-3">
        <span
          ref={setNodeRef}
          {...listeners}
          {...attributes}
          aria-label="Drag onto a day"
          className="group/grip -m-1 flex cursor-grab items-start gap-1 p-1"
        >
          <GripVertical className="mt-2.5 size-3.5 shrink-0 text-muted-foreground/30 transition-colors group-hover/grip:text-muted-foreground" />
          <ItemGlyph item={item} size="lg" />
        </span>

        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1.5">
            <ItemContext item={item} className="text-[11px]" />
            <span className="text-[11px] text-muted-foreground/40">·</span>
            <span
              className={cn(
                "text-[11px]",
                stale
                  ? "font-medium text-condition-attention"
                  : "text-muted-foreground",
              )}
            >
              {whenSummary(item, now)}
            </span>
          </div>
          <h4 className="mt-1 font-heading text-xl leading-snug font-semibold tracking-tight">
            {item.title}
          </h4>
          {item.summary && (
            <p className="mt-1.5 line-clamp-2 text-sm leading-relaxed text-muted-foreground">
              {item.summary}
            </p>
          )}
          {item.kind === "task" && (
            <p className="mt-1.5 text-sm text-muted-foreground">
              Sitting in the inbox since{" "}
              {format(new Date(item.createdAt), "EEEE d MMM")}.
            </p>
          )}
        </div>
      </div>

      {item.kind === "thread" && (
        <div className="mt-4 rounded-lg border border-border/60 bg-surface-1 px-3 py-2.5">
          <span className="text-[10px] font-semibold tracking-wider text-muted-foreground/70 uppercase">
            Next move
          </span>
          {editing ? (
            <Input
              ref={inputRef}
              value={draft}
              onChange={(event) => onDraftChange(event.target.value)}
              onBlur={() => onStopEditing(true)}
              onKeyDown={(event) => {
                if (event.key === "Enter") {
                  event.preventDefault();
                  onStopEditing(true);
                }
                if (event.key === "Escape") {
                  event.preventDefault();
                  onStopEditing(false);
                }
              }}
              placeholder="One move — the next thing you'd actually do"
              aria-label="Next move"
              className="mt-1.5 h-8 text-sm"
            />
          ) : (
            <div className="mt-1 flex items-center gap-2">
              <button
                type="button"
                onClick={onEdit}
                className={cn(
                  "flex min-w-0 flex-1 items-center gap-1.5 rounded-md text-left text-sm transition-colors",
                  item.nextMove
                    ? "text-foreground hover:text-brand-accent-foreground"
                    : "text-muted-foreground/60 italic hover:text-foreground",
                )}
              >
                {item.nextMove ? (
                  <>
                    {item.nextMoveDone ? (
                      <Check className="size-3.5 shrink-0 text-condition-healthy" />
                    ) : (
                      <ArrowRight className="size-3.5 shrink-0 text-muted-foreground" />
                    )}
                    <span
                      className={cn(
                        "truncate",
                        item.nextMoveDone &&
                          "text-muted-foreground/60 line-through",
                      )}
                    >
                      {item.nextMove}
                    </span>
                  </>
                ) : (
                  <span>No move yet — does this still matter?</span>
                )}
              </button>
              {item.nextMove && (
                <Button
                  variant="outline"
                  size="icon-sm"
                  aria-label={
                    item.nextMoveDone
                      ? "Reopen next move"
                      : "Mark next move done"
                  }
                  className="text-muted-foreground hover:text-condition-healthy"
                  onClick={() => actions.toggleNextMoveDone(item.id)}
                >
                  {item.nextMoveDone ? <Undo2 /> : <Check />}
                </Button>
              )}
            </div>
          )}
        </div>
      )}
    </article>
  );
}

function ScheduleRow({
  item,
  onPick,
  week,
}: {
  item: PlanItem;
  onPick: (index: number) => void;
  week: WeekModel;
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <span className="px-0.5 text-[10px] font-semibold tracking-wider text-muted-foreground/70 uppercase">
        Schedule to
      </span>
      <div className="grid grid-cols-7 gap-1.5">
        {week.days.map((day) => (
          <ScheduleTarget
            key={day.index}
            current={
              item.when !== undefined &&
              new Date(item.when).toDateString() === day.date.toDateString()
            }
            date={day.date}
            index={day.index}
            load={day.items.length}
            onPick={onPick}
          />
        ))}
      </div>
    </div>
  );
}

function ScheduleTarget({
  current,
  date,
  index,
  load,
  onPick,
}: {
  current: boolean;
  date: Date;
  index: number;
  load: number;
  onPick: (index: number) => void;
}) {
  const { isOver, setNodeRef } = useDroppable({ id: dayTarget(index) });
  const heavy = load >= 5;

  return (
    <button
      ref={setNodeRef}
      type="button"
      onClick={() => onPick(index)}
      className={cn(
        "flex flex-col items-center gap-1 rounded-xl border px-1 py-2 transition-colors",
        current
          ? "border-brand-gold-strong/60 bg-surface-3"
          : "border-border/70 bg-surface-2 hover:border-border hover:bg-surface-3",
        isOver &&
          "border-solid border-ring bg-surface-3 inset-ring-2 inset-ring-ring/50",
        index === 0 && !current && "bg-surface-3/50",
      )}
    >
      <Kbd className="h-4.5 min-w-4.5 bg-surface-1 px-1 text-[10px]">
        {index + 1}
      </Kbd>
      <span className="text-[9px] leading-none font-medium tracking-wider text-muted-foreground uppercase">
        {format(date, "EEE")}
      </span>
      <span className="text-sm leading-none font-semibold tabular-nums">
        {format(date, "d")}
      </span>
      <span className="mt-0.5 flex h-1.5 items-center gap-0.5">
        {Array.from({ length: Math.min(load, 4) }, (_, dot) => (
          <span
            key={dot}
            className={cn(
              "size-1 rounded-full",
              heavy ? "bg-condition-attention/70" : "bg-brand-gold-strong/60",
            )}
          />
        ))}
        {load > 4 && (
          <span className="text-[9px] leading-none text-condition-attention tabular-nums">
            +
          </span>
        )}
      </span>
    </button>
  );
}

function ReviewAction({
  icon: Icon,
  keyHint,
  label,
  onSelect,
  tone,
}: {
  icon: LucideIcon;
  keyHint: string;
  label: string;
  onSelect: () => void;
  tone?: "healthy";
}) {
  return (
    <Button
      variant="outline"
      size="sm"
      onClick={onSelect}
      className={cn(
        "gap-1.5",
        tone === "healthy" &&
          "text-condition-healthy hover:border-condition-healthy/40 hover:text-condition-healthy",
      )}
    >
      <Icon data-icon="inline-start" />
      {label}
      <Kbd className="ml-0.5 bg-surface-3">{keyHint}</Kbd>
    </Button>
  );
}

function ReviewDone({
  log,
  onExit,
  total,
}: {
  log: ReviewLog;
  onExit: () => void;
  total: number;
}) {
  const decided = log.scheduled + log.cleared + log.resolved;
  const stats = [
    { label: "scheduled", value: log.scheduled },
    { label: "cleared", value: log.cleared },
    { label: "resolved", value: log.resolved },
    { label: "left for later", value: log.skipped },
  ];

  return (
    <div className="flex flex-col items-center rounded-2xl border border-border/70 bg-surface-2 px-6 py-10 text-center">
      <span className="flex size-12 items-center justify-center rounded-full bg-condition-healthy/12 text-condition-healthy">
        <PartyPopper className="size-6" />
      </span>
      <h4 className="mt-3 font-heading text-lg font-semibold tracking-tight">
        {log.skipped === 0 ? "Tray empty" : "Review complete"}
      </h4>
      <p className="mt-1 max-w-sm text-sm leading-relaxed text-muted-foreground">
        You went through all <span className="tabular-nums">{total}</span> and
        made{" "}
        <span className="font-medium text-foreground tabular-nums">
          {decided}
        </span>{" "}
        {decided === 1 ? "decision" : "decisions"}.
        {log.skipped > 0 && " The rest are still in the tray."}
      </p>

      <dl className="mt-5 flex flex-wrap justify-center gap-x-7 gap-y-3">
        {stats.map((stat) => (
          <div key={stat.label} className="flex flex-col items-center">
            <dt className="order-2 text-[11px] text-muted-foreground">
              {stat.label}
            </dt>
            <dd className="order-1 font-heading text-xl font-semibold tabular-nums">
              {stat.value}
            </dd>
          </div>
        ))}
      </dl>

      <Button className="mt-6" onClick={onExit}>
        Back to the week
      </Button>
    </div>
  );
}
