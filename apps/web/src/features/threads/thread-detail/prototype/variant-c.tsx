/** PROTOTYPE (issue #280) — Variant C "Ladder": one continuous sequence of rungs, emphasis by weight only. Throwaway. */
import type { LucideIcon } from "lucide-react";

import { Button } from "@vita-os/ui/components/button";
import { Calendar } from "@vita-os/ui/components/calendar";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@vita-os/ui/components/popover";
import { format, formatDistanceToNow, isToday, isYesterday } from "date-fns";
import {
  ArrowRight,
  Bell,
  Check,
  ChevronDown,
  ChevronUp,
  CircleCheck,
  MapPin,
  Plus,
  X,
} from "lucide-react";
import { useRef, useState } from "react";

import { EditableField } from "@/components/ui/editable-field";
import { AreaConditionDot } from "@/features/areas/components/area-condition-dot";
import { whenTone } from "@/features/attention-list";
import { getActivityLogEntryLabel } from "@/features/threads/activity-log-entry";
import { ActivityLogComposer } from "@/features/threads/components/thread-log-composer";
import { ThreadStateChip } from "@/features/threads/components/thread-state-chip";
import { cn } from "@/lib/utils";

import type { MockLogEntry, MockUpcomingMove } from "./mock-data";

import { useMockThread } from "./mock-data";

/**
 * Ladder: the path is one column of rungs and position is the whole interface.
 * The Next Move is simply the top rung — the only one carrying ink, fill and a
 * gold edge — and the upcoming moves are the same rung repeated underneath,
 * receding. There is no seam between "now" and "next": completing the top rung
 * shifts the entire ladder up one, and the stroke down the left never breaks.
 */
export function VariantC() {
  const {
    thread,
    area,
    upNext,
    log,
    completeNextMove,
    clearNextMove,
    setNextMove,
    addUpcomingMove,
    editUpcomingMove,
    removeUpcomingMove,
    reorderUpcomingMove,
    setFollowUp,
    updateThread,
    addNote,
  } = useMockThread();

  const now = Date.now();

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-4">
      <header
        role="banner"
        aria-label="Thread header"
        className="flex shrink-0 flex-col gap-2"
      >
        {/* `pr-24` clears the pane's absolutely-placed control cluster. */}
        <div className="flex items-center gap-2 pr-24">
          <AreaConditionDot condition={area.condition} />
          <span className="min-w-0 truncate text-xs text-muted-foreground">
            {area.name}
          </span>
          <span aria-hidden className="h-3 w-px shrink-0 bg-border/60" />
          <ThreadStateChip state={thread.state} />
        </div>

        <div className="flex flex-col gap-0.5">
          <EditableField
            value={thread.title}
            onSave={(title) => title && updateThread({ title })}
            inputAriaLabel="Thread title"
            className="min-h-0 py-0.5 font-heading text-lg font-semibold tracking-tight"
            displayClassName="border-transparent"
          />
          <EditableField
            value={thread.summary ?? ""}
            onSave={(summary) => updateThread({ summary })}
            variant="textarea"
            textareaRows={1}
            inputAriaLabel="Thread summary"
            placeholder="Add a summary…"
            className="min-h-0 py-0 text-[13px] leading-snug text-muted-foreground"
            displayClassName="border-transparent whitespace-pre-wrap hover:bg-transparent"
            editorClassName="rounded-lg border border-border/60 bg-muted/20 px-2.5"
          />
        </div>
      </header>

      <Ladder
        nextMove={thread.nextMove}
        moves={upNext}
        followUp={thread.followUp}
        now={now}
        onComplete={completeNextMove}
        onClear={clearNextMove}
        onSetNextMove={setNextMove}
        onAdd={addUpcomingMove}
        onEdit={editUpcomingMove}
        onRemove={removeUpcomingMove}
        onReorder={reorderUpcomingMove}
        onSetFollowUp={setFollowUp}
      />

      <PrototypeActivityLog
        log={log}
        lastActivityAt={thread.lastActivityAt}
        onAddNote={addNote}
      />
    </div>
  );
}

/* ---------------------------------------------------------------- ladder -- */

/** Every rung is the same row: a fixed gutter, the move, its controls. */
const RUNG = "flex items-center gap-2 border-l-2 pr-1 pl-3";
const GUTTER = "flex size-6 shrink-0 items-center justify-center";

/**
 * Distance from the top rung reads twice: the edge stroke thins out and the
 * text loses ink. Nothing else changes, so the column stays one shape.
 */
const RUNG_EDGE = [
  "border-l-border/70",
  "border-l-border/50",
  "border-l-border/35",
  "border-l-border/25",
];

const RUNG_INK = [
  "text-foreground/90",
  "text-muted-foreground",
  "text-muted-foreground/80",
  "text-muted-foreground/65",
];

const step = <T,>(ramp: readonly T[], index: number) =>
  ramp[Math.min(index, ramp.length - 1)]!;

interface LadderProps {
  nextMove: string | undefined;
  moves: MockUpcomingMove[];
  followUp: number | undefined;
  now: number;
  onComplete: () => void;
  onClear: () => void;
  onSetNextMove: (text: string) => void;
  onAdd: (text: string) => void;
  onEdit: (id: string, text: string) => void;
  onRemove: (id: string) => void;
  onReorder: (id: string, toIndex: number) => void;
  onSetFollowUp: (timestamp: number | null) => void;
}

function Ladder({
  nextMove,
  moves,
  followUp,
  now,
  onComplete,
  onClear,
  onSetNextMove,
  onAdd,
  onEdit,
  onRemove,
  onReorder,
  onSetFollowUp,
}: LadderProps) {
  // A promotion remounts the whole rung list, so every move visibly steps up a
  // rung instead of its text silently swapping underneath the reader.
  const [shift, setShift] = useState(0);
  const release = (action: () => void) => {
    action();
    setShift((count) => count + 1);
  };

  return (
    <section
      aria-label="Next move and Up Next"
      className="flex shrink-0 flex-col gap-1.5"
    >
      <div className="flex items-center gap-2">
        <h2 className="text-[10px] font-medium tracking-wide text-muted-foreground/80 uppercase">
          Next move
        </h2>
        {moves.length > 0 && (
          <span className="text-[10px] font-medium tracking-wide text-muted-foreground/55 uppercase">
            <span className="tabular-nums">+{moves.length}</span> up next
          </span>
        )}
        <span aria-hidden className="ml-1 h-px flex-1 bg-border/50" />
        <FollowUpSatellite
          followUp={followUp}
          now={now}
          onSet={onSetFollowUp}
        />
      </div>

      <div>
        <ol key={shift} className="flex flex-col">
          <li
            className={cn(
              RUNG,
              "group/live min-h-11 rounded-r-md border-l-(--brand-gold) bg-muted/40 py-1",
              "animate-in fade-in slide-in-from-bottom-1 duration-300 motion-reduce:animate-none",
            )}
          >
            {nextMove === undefined ? (
              <>
                <span className={GUTTER}>
                  <ArrowRight
                    aria-hidden
                    className="size-3.5 text-muted-foreground/70"
                  />
                </span>
                <RungInput
                  ariaLabel="Next move"
                  placeholder="Set the next move…"
                  onCommit={onSetNextMove}
                />
              </>
            ) : (
              <>
                <span className={GUTTER}>
                  <Button
                    variant="ghost"
                    size="icon-xs"
                    onClick={() => release(onComplete)}
                    aria-label="Complete next move"
                    className="size-6 rounded-full border border-condition-healthy/40 text-condition-healthy hover:bg-condition-healthy/10 hover:text-condition-healthy"
                  >
                    <Check />
                  </Button>
                </span>

                {/* Keyed on the text so the arriving move rises into the rung. */}
                <span className="min-w-0 flex-1">
                  <EditableField
                    key={nextMove}
                    value={nextMove}
                    onSave={(text) => text && onSetNextMove(text)}
                    inputAriaLabel="Next move"
                    className="min-h-0 py-0.5 text-sm leading-snug font-medium"
                    displayClassName="border-transparent whitespace-pre-wrap animate-in fade-in slide-in-from-bottom-2 duration-300 motion-reduce:animate-none"
                  />
                </span>

                <Button
                  variant="ghost"
                  size="icon-xs"
                  onClick={() => release(onClear)}
                  aria-label="Clear next move"
                  className="shrink-0 text-muted-foreground/50 transition-opacity hover:text-destructive motion-reduce:transition-none xl:opacity-0 xl:group-focus-within/live:opacity-100 xl:group-hover/live:opacity-100"
                >
                  <X />
                </Button>
              </>
            )}
          </li>

          {moves.map((move, index) => (
            <UpcomingRung
              key={move.id}
              move={move}
              index={index}
              isLast={index === moves.length - 1}
              onEdit={onEdit}
              onRemove={onRemove}
              onReorder={onReorder}
            />
          ))}
        </ol>

        {/* The ghost rung: the ladder's open end, kept out of the keyed list so
            a half-typed move survives a promotion. */}
        {/* Only the left border has width, so `border-dashed` dashes the
            stroke alone. */}
        <div
          className={cn(
            RUNG,
            "min-h-8 border-l-border/25 border-dashed py-0.5",
          )}
        >
          <span className={GUTTER}>
            <Plus aria-hidden className="size-3 text-muted-foreground/40" />
          </span>
          <RungInput
            ariaLabel="Add an upcoming move"
            placeholder="Add an upcoming move…"
            onCommit={onAdd}
          />
        </div>
      </div>
    </section>
  );
}

function UpcomingRung({
  move,
  index,
  isLast,
  onEdit,
  onRemove,
  onReorder,
}: {
  move: MockUpcomingMove;
  index: number;
  isLast: boolean;
  onEdit: (id: string, text: string) => void;
  onRemove: (id: string) => void;
  onReorder: (id: string, toIndex: number) => void;
}) {
  return (
    <li
      style={{
        animationDelay: `${(index + 1) * 45}ms`,
        animationFillMode: "backwards",
      }}
      className={cn(
        RUNG,
        "group/rung min-h-8 py-0.5",
        step(RUNG_EDGE, index),
        step(RUNG_INK, index),
        "animate-in fade-in slide-in-from-bottom-1 duration-300 motion-reduce:animate-none",
      )}
    >
      {/* The rung's own number: how many moves down the ladder it sits. The
          top rung spends this same slot on the one action you can take. */}
      <span className={cn(GUTTER, "text-[10px] tabular-nums opacity-55")}>
        {index + 2}
      </span>

      <span className="min-w-0 flex-1">
        <EditableField
          value={move.text}
          onSave={(text) => text && onEdit(move.id, text)}
          inputAriaLabel="Upcoming move"
          className="min-h-0 py-0.5 text-[13px] leading-snug"
          displayClassName="block truncate border-transparent text-left"
        />
      </span>

      <span className="flex shrink-0 items-center transition-opacity motion-reduce:transition-none xl:opacity-0 xl:group-focus-within/rung:opacity-100 xl:group-hover/rung:opacity-100">
        <Button
          variant="ghost"
          size="icon-xs"
          disabled={index === 0}
          onClick={() => onReorder(move.id, index - 1)}
          aria-label="Move up a rung"
          className="text-muted-foreground/60 hover:text-foreground"
        >
          <ChevronUp />
        </Button>
        <Button
          variant="ghost"
          size="icon-xs"
          disabled={isLast}
          onClick={() => onReorder(move.id, index + 1)}
          aria-label="Move down a rung"
          className="text-muted-foreground/60 hover:text-foreground"
        >
          <ChevronDown />
        </Button>
        <Button
          variant="ghost"
          size="icon-xs"
          onClick={() => onRemove(move.id)}
          aria-label="Remove upcoming move"
          className="text-muted-foreground/50 hover:text-destructive"
        >
          <X />
        </Button>
      </span>
    </li>
  );
}

/** One text field shape for every rung that accepts typing. */
function RungInput({
  ariaLabel,
  placeholder,
  onCommit,
}: {
  ariaLabel: string;
  placeholder: string;
  onCommit: (text: string) => void;
}) {
  const [draft, setDraft] = useState("");

  const commit = () => {
    const text = draft.trim();
    if (!text) return;
    setDraft("");
    onCommit(text);
  };

  return (
    <input
      type="text"
      value={draft}
      onChange={(event) => setDraft(event.target.value)}
      onBlur={commit}
      onKeyDown={(event) => {
        if (event.key === "Enter") {
          event.preventDefault();
          commit();
        }
      }}
      aria-label={ariaLabel}
      placeholder={placeholder}
      className="h-7 min-w-0 flex-1 rounded-md border border-transparent bg-transparent px-1 text-[13px] outline-none transition-colors placeholder:text-muted-foreground/60 hover:bg-muted/40 focus:bg-muted/20 focus:ring-1 focus:ring-ring motion-reduce:transition-none"
    />
  );
}

/* ------------------------------------------------------------- follow-up -- */

/** Lateness reads in the tone the rest of the app uses for a slipping date. */
const FOLLOW_UP_TONE = {
  overdue: "text-condition-attention",
  due: "text-brand-accent-foreground",
} as const;

/** A satellite riding the hairline: when this Thread comes back, not a deadline. */
function FollowUpSatellite({
  followUp,
  now,
  onSet,
}: {
  followUp: number | undefined;
  now: number;
  onSet: (timestamp: number | null) => void;
}) {
  const [open, setOpen] = useState(false);
  const selected = followUp === undefined ? undefined : new Date(followUp);
  const tone = whenTone(followUp, now);

  return (
    <span className="flex shrink-0 items-center">
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger
          render={
            <Button
              variant="ghost"
              size="xs"
              className="gap-1.5 px-1.5 font-normal"
            />
          }
        >
          <Bell aria-hidden className="size-3 text-muted-foreground/70" />
          <span className="sr-only">Follow-up</span>
          {selected ? (
            <span
              className={cn(
                "tabular-nums",
                tone ? FOLLOW_UP_TONE[tone] : "text-muted-foreground",
              )}
            >
              {format(selected, "MMM d")}
            </span>
          ) : (
            <span className="text-muted-foreground">Add a follow-up…</span>
          )}
        </PopoverTrigger>
        <PopoverContent className="w-auto gap-0 p-0" align="end">
          <Calendar
            mode="single"
            selected={selected}
            onSelect={(date) => {
              if (!date) return;
              onSet(date.getTime());
              setOpen(false);
            }}
          />
        </PopoverContent>
      </Popover>

      {selected && (
        <Button
          variant="ghost"
          size="icon-xs"
          onClick={() => onSet(null)}
          aria-label="Clear follow-up"
          className="size-5 shrink-0 text-muted-foreground/50 hover:text-destructive"
        >
          <X />
        </Button>
      )}
    </span>
  );
}

/* ------------------------------------------------------------------- log -- */

type AutomaticEntry = MockLogEntry & {
  type: Exclude<MockLogEntry["type"], "note">;
};

const LOG_ICONS: Record<AutomaticEntry["type"], LucideIcon> = {
  next_action_change: ArrowRight,
  state_change: CircleCheck,
  follow_up_change: Bell,
  area_move: MapPin,
};

// Rail geometry matches the production log: the 1px line spans left 11–12px,
// so nodes centre on 11.5px and entry bodies clear it at pl-9.
const RAIL_LEFT = "left-[11px]";
const NODE_LEFT = "left-[11.5px]";
const ENTRY_PAD = "pl-9";

/**
 * The record fills whatever height the ladder leaves it, and it is the pane's
 * only scrolling region. The composer stays pinned to the floor.
 */
function PrototypeActivityLog({
  log,
  lastActivityAt,
  onAddNote,
}: {
  log: MockLogEntry[];
  lastActivityAt: number;
  onAddNote: (content: string) => void;
}) {
  const scrollRef = useRef<HTMLDivElement>(null);

  return (
    <section
      aria-label="Activity log"
      className="flex min-h-0 flex-1 flex-col gap-1.5"
    >
      {/* Same frame shape as the ladder's, so the two sections rhyme. */}
      <div className="flex shrink-0 items-center gap-2">
        <h2 className="text-[10px] font-medium tracking-wide text-muted-foreground/80 uppercase">
          Activity log
        </h2>
        <span className="text-[10px] font-medium tracking-wide text-muted-foreground/55 uppercase">
          <span className="tabular-nums">{log.length}</span> entries
        </span>
        <span aria-hidden className="ml-1 h-px flex-1 bg-border/50" />
        <span className="text-[10px] font-medium tracking-wide text-muted-foreground/55 uppercase">
          Newest first
        </span>
      </div>

      <div
        ref={scrollRef}
        data-slot="ladder-log-scroll"
        className="min-h-0 flex-1 scroll-smooth overflow-y-auto overscroll-contain motion-reduce:scroll-auto"
      >
        <div className="relative pt-1 pb-6">
          <div
            aria-hidden
            className={cn(
              "absolute top-1 bottom-0 w-px bg-gradient-to-b from-transparent via-border to-transparent",
              RAIL_LEFT,
            )}
          />

          <div className={cn("relative pb-4", ENTRY_PAD)}>
            <span
              aria-hidden
              className={cn(
                "absolute top-0.5 size-2.5 -translate-x-1/2 rounded-full border border-(--brand-gold) bg-background",
                NODE_LEFT,
              )}
            >
              <span className="absolute inset-[3px] rounded-full bg-(--brand-gold)" />
            </span>
            <p className="text-[10px] font-medium tracking-wide text-muted-foreground/80 uppercase">
              {`Updated ${formatDistanceToNow(new Date(lastActivityAt), {
                addSuffix: true,
              })}`}
            </p>
          </div>

          <div className="flex flex-col gap-4">
            {groupByDay(log).map((group) => (
              <section
                key={group.key}
                aria-label={group.label}
                className="flex flex-col"
              >
                <div className={cn("pb-1.5", ENTRY_PAD)}>
                  <h3 className="text-[10px] font-medium tracking-wide text-muted-foreground/80 uppercase">
                    {group.label}
                  </h3>
                </div>
                {group.entries.map((entry) =>
                  entry.type === "note" ? (
                    <ManualNote key={entry.id} entry={entry} />
                  ) : (
                    <AutomaticChange
                      key={entry.id}
                      entry={entry as AutomaticEntry}
                    />
                  ),
                )}
              </section>
            ))}
          </div>
        </div>
      </div>

      <ActivityLogComposer
        onAddNote={onAddNote}
        onPosted={() => scrollRef.current?.scrollTo?.({ top: 0 })}
      />
    </section>
  );
}

/** A note: gold filled node + raised card body. */
function ManualNote({ entry }: { entry: MockLogEntry }) {
  return (
    <div className={cn("relative py-1.5", ENTRY_PAD)}>
      <span
        aria-hidden
        className={cn(
          "absolute top-4 size-2.5 -translate-x-1/2 rounded-full border border-(--brand-gold)/60 bg-(--brand-gold) ring-2 ring-background",
          NODE_LEFT,
        )}
      />
      <div className="rounded-md border border-border bg-muted/40 px-3 py-2">
        <div className="mb-1 flex items-baseline justify-between gap-2">
          <span className="text-[10px] font-medium tracking-wide text-(--brand-gold) uppercase">
            Note
          </span>
          <LogTimestamp createdAt={entry.createdAt} />
        </div>
        <p className="text-[13px] leading-snug whitespace-pre-wrap text-foreground">
          {entry.content}
        </p>
      </div>
    </div>
  );
}

/** An automatic change: tiny hollow node, single compact muted line. */
function AutomaticChange({ entry }: { entry: AutomaticEntry }) {
  const Icon = LOG_ICONS[entry.type];

  return (
    <div className={cn("relative py-1", ENTRY_PAD)}>
      <span
        aria-hidden
        className={cn(
          "absolute top-[9px] size-1.5 -translate-x-1/2 rounded-full border border-muted-foreground/40 bg-background",
          NODE_LEFT,
        )}
      />
      <div className="flex min-w-0 items-center gap-1.5 text-xs text-muted-foreground">
        <Icon
          aria-hidden
          className="size-3.5 shrink-0 text-muted-foreground/60"
        />
        <span className="shrink-0 font-medium">
          {getActivityLogEntryLabel(entry.type)}
        </span>
        <span className="truncate text-muted-foreground/80">
          {summarize(entry)}
        </span>
        <span className="ml-auto shrink-0 pl-2">
          <LogTimestamp createdAt={entry.createdAt} />
        </span>
      </div>
    </div>
  );
}

function LogTimestamp({ createdAt }: { createdAt: number }) {
  const date = new Date(createdAt);

  return (
    <time
      dateTime={date.toISOString()}
      title={format(date, "PPpp")}
      className="shrink-0 text-[10px] tabular-nums text-muted-foreground/60"
    >
      {format(date, "h:mm a")}
    </time>
  );
}

function groupByDay(entries: MockLogEntry[]) {
  const groups = new Map<string, MockLogEntry[]>();

  for (const entry of [...entries].sort((a, b) => b.createdAt - a.createdAt)) {
    const key = format(new Date(entry.createdAt), "yyyy-MM-dd");
    const group = groups.get(key) ?? [];
    group.push(entry);
    groups.set(key, group);
  }

  return [...groups.entries()].map(([key, groupEntries]) => ({
    key,
    label: dayLabel(groupEntries[0]!.createdAt),
    entries: groupEntries,
  }));
}

function dayLabel(createdAt: number) {
  const date = new Date(createdAt);
  if (isToday(date)) return "Today";
  if (isYesterday(date)) return "Yesterday";
  return format(date, "MMMM d, yyyy");
}

function summarize(entry: AutomaticEntry) {
  if (entry.previousValue && entry.newValue) {
    return `${entry.previousValue} → ${entry.newValue}`;
  }
  if (entry.newValue) return `Set to ${entry.newValue}`;
  if (entry.previousValue) {
    return entry.content.includes("completed")
      ? `Completed ${entry.previousValue}`
      : `Cleared ${entry.previousValue}`;
  }
  return entry.content;
}
