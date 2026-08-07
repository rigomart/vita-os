import type { LucideIcon } from "lucide-react";

import { conditionLabels } from "@convex/lib/condition";
import { Button } from "@vita-os/ui/components/button";
import { Input } from "@vita-os/ui/components/input";
import { Kbd } from "@vita-os/ui/components/kbd";
import { cn } from "@vita-os/ui/lib/utils";
import { format } from "date-fns";
import {
  ArrowRight,
  CalendarOff,
  CircleCheckBig,
  Inbox,
  PartyPopper,
  Pencil,
  SkipForward,
  X,
} from "lucide-react";
import { useEffect, useRef, useState } from "react";

import { AreaIcon } from "@/features/areas/components/area-icon";

import type { MockArea } from "../mock-data";
import type { PlanItem, QueueGroupKey } from "./model";
import type { PlanAction } from "./plan-state";

import {
  agoLabel,
  areaOf,
  dateSentence,
  dateToneClass,
  dayAt,
  REVIEW_WEEK,
  reviewDays,
} from "./model";

/** One card in the pass, with the decision it is being asked for. */
export interface ReviewEntry {
  groupHint: string;
  groupKey: QueueGroupKey;
  groupLabel: string;
  id: string;
}

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
 * The guided pass: one card at a time, ordered by the decision being asked.
 *
 * The queue is snapshotted when the review starts so the pile does not shuffle
 * underneath you as you empty it. Every decision goes through the same reducer
 * as the grid, so the grid is already correct when you come back to it.
 */
export function ReviewMode({
  areaById,
  dispatch,
  items,
  now,
  onExit,
  queue,
}: {
  areaById: ReadonlyMap<string, MockArea>;
  dispatch: (action: PlanAction) => void;
  items: PlanItem[];
  now: number;
  onExit: () => void;
  queue: ReviewEntry[];
}) {
  const [index, setIndex] = useState(0);
  const [log, setLog] = useState<ReviewLog>(EMPTY_LOG);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState("");

  const entry = queue[index];
  const item = items.find((candidate) => candidate.id === entry?.id);
  const finished = index >= queue.length;
  const days = reviewDays(items, now);

  function advance() {
    setEditing(false);
    setIndex((current) => current + 1);
  }

  function schedule(id: string, date: number) {
    dispatch({ date, itemId: id, type: "set-date" });
    setLog((current) => ({ ...current, scheduled: current.scheduled + 1 }));
    advance();
  }

  function clearDate(id: string) {
    dispatch({ date: undefined, itemId: id, type: "set-date" });
    setLog((current) => ({ ...current, cleared: current.cleared + 1 }));
    advance();
  }

  function resolve(id: string) {
    dispatch({ itemId: id, type: "resolve" });
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

  // Re-bound every render so the handler always sees the live card.
  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if (event.metaKey || event.ctrlKey || event.altKey) return;

      const target = event.target as HTMLElement | null;
      if (
        target?.isContentEditable ||
        (target && ["INPUT", "SELECT", "TEXTAREA"].includes(target.tagName))
      ) {
        return;
      }

      if (event.key === "Escape") {
        event.preventDefault();
        onExit();
        return;
      }
      if (!item) return;

      const digit = Number(event.key);
      if (Number.isInteger(digit) && digit >= 1 && digit <= REVIEW_WEEK) {
        event.preventDefault();
        schedule(item.id, dayAt(digit - 1, now));
        return;
      }

      switch (event.key.toLowerCase()) {
        case "0":
        case "backspace":
          if (item.date != null) {
            event.preventDefault();
            clearDate(item.id);
          }
          break;
        case "n":
          event.preventDefault();
          schedule(item.id, dayAt(REVIEW_WEEK, now));
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
          setEditing(false);
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
              Review
            </h3>
            <span className="text-xs tabular-nums text-muted-foreground">
              {finished
                ? `${queue.length} of ${queue.length}`
                : `${index + 1} of ${queue.length}`}
            </span>
          </div>
          <Button variant="ghost" size="xs" onClick={onExit}>
            <X data-icon="inline-start" />
            Exit
            <Kbd className="ml-1 text-[10px]">Esc</Kbd>
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

      {finished || !item || !entry ? (
        <ReviewDone log={log} onExit={onExit} total={queue.length} />
      ) : (
        <>
          <p className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
            <span className="text-[11px] font-semibold tracking-[0.06em] text-muted-foreground uppercase">
              {entry.groupLabel}
            </span>
            <span className="text-[11px] text-muted-foreground/60">
              {entry.groupHint}
            </span>
          </p>

          <ReviewCard
            area={areaOf(item, areaById)}
            draft={draft}
            editing={editing}
            item={item}
            now={now}
            onDraftChange={setDraft}
            onEdit={() => startEditing(item)}
            onStopEditing={(commit) => {
              if (commit) {
                dispatch({
                  itemId: item.id,
                  text: draft,
                  type: "set-next-move",
                });
              }
              setEditing(false);
            }}
          />

          <div className="flex flex-col gap-1.5">
            <span className="px-0.5 text-[10px] font-semibold tracking-wider text-muted-foreground/70 uppercase">
              {item.kind === "task" ? "Come back to it" : "Resurface it"}
            </span>
            <div className="grid grid-cols-7 gap-1.5">
              {days.map((day) => (
                <DayTarget
                  key={day.index}
                  current={
                    item.date != null &&
                    new Date(item.date).toDateString() ===
                      day.date.toDateString()
                  }
                  date={day.date}
                  index={day.index}
                  load={day.load}
                  onPick={() => schedule(item.id, dayAt(day.index, now))}
                />
              ))}
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-1.5">
            <ReviewAction
              icon={ArrowRight}
              keyHint="N"
              label="Push to next week"
              onSelect={() => schedule(item.id, dayAt(REVIEW_WEEK, now))}
            />
            {item.date != null && (
              <ReviewAction
                icon={CalendarOff}
                keyHint="0"
                label={
                  item.kind === "thread" ? "Clear Follow-up" : "Clear when"
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
            <span className="tabular-nums">{log.skipped}</span> left for later ·{" "}
            <Kbd className="text-[10px]">←</Kbd> goes back a card.
          </p>
        </>
      )}
    </div>
  );
}

function ReviewCard({
  area,
  draft,
  editing,
  item,
  now,
  onDraftChange,
  onEdit,
  onStopEditing,
}: {
  area?: MockArea;
  draft: string;
  editing: boolean;
  item: PlanItem;
  now: number;
  onDraftChange: (value: string) => void;
  onEdit: () => void;
  onStopEditing: (commit: boolean) => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const status = dateSentence(item, now);

  useEffect(() => {
    if (!editing) return;
    const node = inputRef.current;
    if (!node) return;
    node.focus();
    node.setSelectionRange(node.value.length, node.value.length);
  }, [editing]);

  return (
    <article className="rounded-2xl border border-border/70 bg-surface-2 p-5">
      <div className="flex items-start gap-3">
        <span
          className={cn(
            "flex size-9 shrink-0 items-center justify-center rounded-lg",
            item.kind === "task"
              ? "border border-dashed border-border bg-surface-1 text-muted-foreground"
              : "bg-surface-3 text-brand-accent-foreground",
          )}
        >
          {item.kind === "task" ? (
            <Inbox className="size-4" />
          ) : (
            <AreaIcon icon={area?.icon} className="size-4" />
          )}
        </span>

        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-x-1.5 text-[11px]">
            <span className="text-muted-foreground">
              {item.kind === "task"
                ? "Inbox task"
                : `${area?.name} · ${conditionLabels[area?.condition ?? "healthy"]}`}
            </span>
            <span className="text-muted-foreground/40">·</span>
            <span className={cn("font-medium", dateToneClass[status.tone])}>
              {status.text}
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
          {item.kind === "task" && item.createdAt != null && (
            <p className="mt-1.5 text-sm text-muted-foreground">
              Sitting in the Inbox since{" "}
              {format(new Date(item.createdAt), "EEEE d MMM")} (
              {agoLabel(item.createdAt, now)}).
            </p>
          )}
        </div>
      </div>

      {item.kind === "thread" && (
        <div className="mt-4 rounded-lg border border-border/60 bg-surface-1 px-3 py-2.5">
          <span className="text-[10px] font-semibold tracking-wider text-muted-foreground/70 uppercase">
            Next Move
          </span>
          {editing ? (
            <Input
              ref={inputRef}
              value={draft}
              placeholder="One move — the next thing you'd actually do"
              aria-label="Next Move"
              className="mt-1.5 h-8 text-sm"
              onChange={(event) => onDraftChange(event.target.value)}
              onBlur={() => onStopEditing(true)}
              onKeyDown={(event) => {
                if (event.key === "Enter") {
                  event.preventDefault();
                  onStopEditing(true);
                }
                if (event.key === "Escape") {
                  event.preventDefault();
                  event.stopPropagation();
                  onStopEditing(false);
                }
              }}
            />
          ) : (
            <button
              type="button"
              onClick={onEdit}
              className={cn(
                "mt-1 flex w-full min-w-0 items-center gap-1.5 rounded-md text-left text-sm transition-colors",
                item.nextMove
                  ? "text-foreground hover:text-brand-accent-foreground"
                  : "text-muted-foreground/60 italic hover:text-foreground",
              )}
            >
              {item.nextMove ? (
                <>
                  <ArrowRight className="size-3.5 shrink-0 text-muted-foreground" />
                  <span className="truncate">{item.nextMove}</span>
                </>
              ) : (
                <span>No move yet — does this still matter?</span>
              )}
            </button>
          )}
        </div>
      )}
    </article>
  );
}

function DayTarget({
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
  onPick: () => void;
}) {
  const heavy = load >= 5;

  return (
    <button
      type="button"
      onClick={onPick}
      className={cn(
        "flex flex-col items-center gap-1 rounded-xl border px-1 py-2 transition-colors",
        current
          ? "border-brand-gold-strong/60 bg-surface-3"
          : "border-border/70 bg-surface-2 hover:border-border hover:bg-surface-3",
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
      <span
        className="mt-0.5 flex h-1.5 items-center gap-0.5"
        title={`${load} already on this day`}
      >
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
          <span className="text-[9px] leading-none tabular-nums text-condition-attention">
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
      <Kbd className="ml-0.5 bg-surface-3 text-[10px]">{keyHint}</Kbd>
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
        {log.skipped === 0 ? "Nothing left waiting" : "Review complete"}
      </h4>
      <p className="mt-1 max-w-sm text-sm leading-relaxed text-muted-foreground">
        You went through all <span className="tabular-nums">{total}</span> and
        made{" "}
        <span className="font-medium text-foreground tabular-nums">
          {decided}
        </span>{" "}
        {decided === 1 ? "decision" : "decisions"}.
        {log.skipped > 0 && " The rest are still in the tray, unchanged."}
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
        Back to the grid
      </Button>
    </div>
  );
}
