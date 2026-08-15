/** PROTOTYPE (issue #280) — Variant C "Continuum": one timeline from future through now into history. Throwaway. */
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
  X,
} from "lucide-react";
import { useLayoutEffect, useRef, useState } from "react";

import { EditableField } from "@/components/ui/editable-field";
import { AreaConditionDot } from "@/features/areas/components/area-condition-dot";
import { whenTone } from "@/features/attention-list";
import { getActivityLogEntryLabel } from "@/features/threads/activity-log-entry";
import { ActivityLogComposer } from "@/features/threads/components/thread-log-composer";
import { ThreadStateChip } from "@/features/threads/components/thread-state-chip";
import { cn } from "@/lib/utils";

import type { MockLogEntry, MockUpcomingMove } from "./mock-data";

import { useMockThread } from "./mock-data";

// Same rail geometry as the production Activity log, so the two read as one
// continuous line: the 1px rail spans left 11–12px, nodes centre on 11.5px.
const RAIL_LEFT = "left-[11px]";
const NODE_LEFT = "left-[11.5px]";
const ROW_PAD = "pl-9";

/**
 * Continuum: the Thread is a single descending time axis. Read top to bottom
 * and time runs backwards — the far future at the head, "now" in the middle,
 * history falling away below. Up Next is not a separate list; the upcoming
 * moves are the future stretch of the same rail, drawn as provisional ghost
 * nodes on a dashed line that turns solid the moment it reaches now.
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

  const scrollRef = useRef<HTMLDivElement>(null);
  const nowRef = useRef<HTMLDivElement>(null);
  const [now] = useState(() => Date.now());

  // The pane opens on the present, with a little of the future overhead: the
  // rail's head and its floor are both a scroll away, in opposite directions.
  useLayoutEffect(() => {
    const scroller = scrollRef.current;
    const nowBlock = nowRef.current;
    if (!scroller || !nowBlock) return;
    scroller.scrollTop = Math.max(0, nowBlock.offsetTop - 48);
  }, []);

  const revealNow = () => {
    const scroller = scrollRef.current;
    const nowBlock = nowRef.current;
    if (!scroller || !nowBlock) return;
    scroller.scrollTo({ top: Math.max(0, nowBlock.offsetTop - 48) });
  };

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-4">
      <header
        role="banner"
        aria-label="Thread header"
        className="flex shrink-0 flex-col gap-3"
      >
        {/* `pr-24` clears the pane's absolutely-placed control cluster. */}
        <div className="flex items-center gap-2 pr-24">
          <AreaConditionDot condition={area.condition} />
          <span className="min-w-0 truncate text-xs text-muted-foreground">
            {area.name}
          </span>
          <ThreadStateChip state={thread.state} />
        </div>
        <div className="flex flex-col gap-0.5">
          <EditableField
            value={thread.title}
            onSave={(title) => {
              if (title) updateThread({ title });
            }}
            inputAriaLabel="Thread title"
            className="font-heading text-xl font-semibold tracking-tight"
          />
          <EditableField
            value={thread.summary ?? ""}
            onSave={(summary) => updateThread({ summary })}
            variant="textarea"
            textareaRows={1}
            inputAriaLabel="Thread summary"
            placeholder="Add a summary…"
            className="min-h-0 py-1.5 text-[13px] leading-relaxed text-muted-foreground"
            displayClassName="border-b-0 whitespace-pre-wrap hover:bg-transparent"
            editorClassName="rounded-lg border border-border/60 bg-muted/20 px-2.5 hover:bg-muted/20 focus-visible:bg-muted/20"
          />
        </div>
      </header>

      {/* The only scroll region in the pane: the whole continuum lives here. */}
      <div
        ref={scrollRef}
        data-slot="continuum-scroll"
        className="min-h-0 flex-1 scroll-smooth overflow-y-auto overscroll-contain motion-reduce:scroll-auto"
      >
        <div className="relative pb-6">
          <FutureSegment
            upNext={upNext}
            onAdd={addUpcomingMove}
            onEdit={editUpcomingMove}
            onRemove={removeUpcomingMove}
            onReorder={reorderUpcomingMove}
          />

          <div className="relative">
            {/* From here down the rail is settled: solid, warm at now, fading
                into the distance past the oldest entry. */}
            <div
              aria-hidden
              className={cn(
                "absolute top-0 bottom-0 w-px",
                RAIL_LEFT,
                "bg-gradient-to-b from-(--brand-gold)/60 via-border to-transparent",
              )}
            />

            <NowBlock
              ref={nowRef}
              nextMove={thread.nextMove}
              followUp={thread.followUp}
              now={now}
              onComplete={completeNextMove}
              onClear={clearNextMove}
              onSet={setNextMove}
              onSetFollowUp={setFollowUp}
            />

            <PastSegment log={log} lastActivityAt={thread.lastActivityAt} />
          </div>
        </div>
      </div>

      <ActivityLogComposer onAddNote={addNote} onPosted={revealNow} />
    </div>
  );
}

/* ---------------------------------------------------------------- future -- */

/**
 * Up Next as the rail's future: furthest-out at the head, each move sitting
 * one step closer to now than the one above it. Nothing here has a date or a
 * done-state — the dashes and the fading tone say "not yet real".
 */
function FutureSegment({
  upNext,
  onAdd,
  onEdit,
  onRemove,
  onReorder,
}: {
  upNext: MockUpcomingMove[];
  onAdd: (text: string) => void;
  onEdit: (id: string, text: string) => void;
  onRemove: (id: string) => void;
  onReorder: (id: string, toIndex: number) => void;
}) {
  return (
    <section aria-label="Up Next" className="pb-1">
      <div className={cn("flex items-baseline gap-2 pb-1", ROW_PAD)}>
        <h2 className="text-[10px] font-medium tracking-wide text-muted-foreground/80 uppercase">
          Up Next
        </h2>
        {upNext.length > 0 && (
          <span className="text-[10px] tabular-nums text-muted-foreground/60">
            {upNext.length} upcoming {upNext.length === 1 ? "move" : "moves"}
          </span>
        )}
        <span aria-hidden className="ml-1 h-px flex-1 bg-border/40" />
        <span className="text-[10px] font-medium tracking-wide text-muted-foreground/60 uppercase">
          Flows down to now
        </span>
      </div>

      <div className="relative">
        {/* Provisional stretch: dashed, and it stops where now begins. */}
        <div
          aria-hidden
          className={cn(
            "absolute top-5 bottom-0 w-0 border-l border-dashed border-border/70",
            RAIL_LEFT,
          )}
        />

        <div className={cn("relative py-1", ROW_PAD)}>
          <span
            aria-hidden
            className={cn(
              "absolute top-[15px] size-2.5 -translate-x-1/2 rounded-full border border-dashed border-muted-foreground/50 bg-background",
              NODE_LEFT,
            )}
          />
          <InlineMoveInput
            ariaLabel="Add an upcoming move"
            placeholder="Add an upcoming move…"
            onCommit={onAdd}
          />
        </div>

        {upNext.length === 0 ? (
          <div className={cn("relative py-1", ROW_PAD)}>
            <span
              aria-hidden
              className={cn(
                "absolute top-[11px] size-2 -translate-x-1/2 rounded-full border border-border bg-background",
                NODE_LEFT,
              )}
            />
            <p className="text-[13px] leading-snug text-muted-foreground/70">
              Nothing waiting behind the next move.
            </p>
          </div>
        ) : (
          // Rendered far-future first so the column descends toward now.
          [...upNext].reverse().map((move, position) => {
            const index = upNext.length - 1 - position;
            return (
              <UpcomingMoveRow
                key={move.id}
                move={move}
                index={index}
                distance={index}
                isFurthest={index === upNext.length - 1}
                onEdit={onEdit}
                onRemove={onRemove}
                onReorder={onReorder}
              />
            );
          })
        )}
      </div>
    </section>
  );
}

/** Presence grows as a move approaches now; the far future is barely there. */
const GHOST_TONE = ["opacity-100", "opacity-90", "opacity-75", "opacity-60"];

function UpcomingMoveRow({
  move,
  index,
  distance,
  isFurthest,
  onEdit,
  onRemove,
  onReorder,
}: {
  move: MockUpcomingMove;
  index: number;
  distance: number;
  isFurthest: boolean;
  onEdit: (id: string, text: string) => void;
  onRemove: (id: string) => void;
  onReorder: (id: string, toIndex: number) => void;
}) {
  return (
    <div
      className={cn(
        "group/move relative flex items-start gap-1 py-1 transition-opacity",
        ROW_PAD,
        GHOST_TONE[Math.min(distance, GHOST_TONE.length - 1)],
      )}
    >
      <span
        aria-hidden
        className={cn(
          "absolute top-[13px] size-2 -translate-x-1/2 rounded-full border border-muted-foreground/45 bg-background",
          NODE_LEFT,
        )}
      />

      <span className="min-w-0 flex-1">
        <EditableField
          value={move.text}
          onSave={(text) => {
            if (text) onEdit(move.id, text);
          }}
          inputAriaLabel="Upcoming move"
          className="min-h-0 py-1 text-[13px] leading-snug text-muted-foreground"
          displayClassName="border-transparent text-left whitespace-pre-wrap"
        />
      </span>

      {/* Direction is stated by meaning, not by arrow: down is toward now. */}
      <span className="flex shrink-0 items-center transition-opacity xl:opacity-0 xl:group-focus-within/move:opacity-100 xl:group-hover/move:opacity-100 motion-reduce:transition-none">
        <Button
          variant="ghost"
          size="icon-xs"
          aria-label="Move later"
          disabled={isFurthest}
          onClick={() => onReorder(move.id, index + 1)}
          className="size-6 text-muted-foreground/60 hover:text-foreground"
        >
          <ChevronUp />
        </Button>
        <Button
          variant="ghost"
          size="icon-xs"
          aria-label="Move sooner"
          disabled={index === 0}
          onClick={() => onReorder(move.id, index - 1)}
          className="size-6 text-muted-foreground/60 hover:text-foreground"
        >
          <ChevronDown />
        </Button>
        <Button
          variant="ghost"
          size="icon-xs"
          aria-label="Remove upcoming move"
          onClick={() => onRemove(move.id)}
          className="size-6 text-muted-foreground/50 hover:text-destructive"
        >
          <X />
        </Button>
      </span>
    </div>
  );
}

function InlineMoveInput({
  placeholder,
  ariaLabel,
  onCommit,
}: {
  placeholder: string;
  ariaLabel: string;
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
      className="h-8 w-full min-w-0 rounded-md border border-transparent bg-transparent px-1 text-[13px] outline-none transition-colors placeholder:text-muted-foreground/60 hover:border-border/60 hover:bg-muted/30 focus:border-ring focus:bg-muted/20"
    />
  );
}

/* ------------------------------------------------------------------- now -- */

/**
 * The present: one emphasised node on the rail. Completing or clearing it
 * hands the slot to the move directly above, and the line the move was on
 * slides down across now into history.
 */
function NowBlock({
  ref,
  nextMove,
  followUp,
  now,
  onComplete,
  onClear,
  onSet,
  onSetFollowUp,
}: {
  ref: React.Ref<HTMLDivElement>;
  nextMove: string | undefined;
  followUp: number | undefined;
  now: number;
  onComplete: () => void;
  onClear: () => void;
  onSet: (text: string) => void;
  onSetFollowUp: (timestamp: number | null) => void;
}) {
  const [crossing, setCrossing] = useState(false);

  const release = (action: () => void) => {
    setCrossing(true);
    window.setTimeout(() => {
      action();
      setCrossing(false);
    }, 180);
  };

  return (
    <div ref={ref} className={cn("relative pt-1 pb-4", ROW_PAD)}>
      <span
        aria-hidden
        className={cn(
          "absolute top-[7px] size-3 -translate-x-1/2 rounded-full",
          NODE_LEFT,
          "border border-(--brand-gold) bg-background ring-4 ring-(--brand-gold)/15",
        )}
      >
        <span className="absolute inset-[3px] rounded-full bg-(--brand-gold)" />
      </span>

      <p className="text-[10px] font-medium tracking-wide text-(--brand-gold) uppercase">
        Now
      </p>

      <div
        className={cn(
          "transition-[transform,opacity] duration-200 ease-out motion-reduce:transition-none",
          crossing && "translate-y-4 opacity-0",
        )}
      >
        <div className="group/now mt-1 flex items-start gap-2">
          {nextMove === undefined ? (
            <>
              <ArrowRight
                aria-hidden
                className="mt-2 size-3.5 shrink-0 text-muted-foreground/70"
              />
              <span className="min-w-0 flex-1">
                <InlineMoveInput
                  ariaLabel="Next move"
                  placeholder="Set the next move…"
                  onCommit={onSet}
                />
              </span>
            </>
          ) : (
            <>
              <Button
                variant="ghost"
                size="icon-xs"
                onClick={() => release(onComplete)}
                aria-label="Complete next move"
                className="mt-0.5 size-6 shrink-0 rounded-full border border-condition-healthy/40 text-condition-healthy hover:bg-condition-healthy/10 hover:text-condition-healthy"
              >
                <Check />
              </Button>

              <span className="min-w-0 flex-1">
                <EditableField
                  value={nextMove}
                  onSave={(text) => {
                    if (text) onSet(text);
                  }}
                  inputAriaLabel="Next move"
                  className="min-h-0 py-0.5 text-sm font-medium leading-snug"
                  displayClassName="border-transparent text-left whitespace-pre-wrap"
                />
              </span>

              <Button
                variant="ghost"
                size="icon-xs"
                onClick={() => release(onClear)}
                aria-label="Clear next move"
                className="mt-0.5 size-6 shrink-0 text-muted-foreground/50 transition-opacity hover:text-destructive xl:opacity-0 xl:group-focus-within/now:opacity-100 xl:group-hover/now:opacity-100 motion-reduce:transition-none"
              >
                <X />
              </Button>
            </>
          )}
        </div>

        <FollowUpSatellite
          followUp={followUp}
          now={now}
          onSet={onSetFollowUp}
        />
      </div>
    </div>
  );
}

/** Lateness reads in the tone the rest of the app uses for a slipping date. */
const FOLLOW_UP_TONE = {
  overdue: "text-condition-attention",
  due: "text-brand-accent-foreground",
} as const;

/** A quiet satellite of the now node: when this Thread comes back, not a due date. */
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
    <div className="mt-0.5 flex items-center gap-0.5 pl-8">
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger
          render={
            <Button
              variant="ghost"
              size="sm"
              className="h-6 gap-1.5 px-1.5 text-xs font-normal"
            />
          }
        >
          <Bell aria-hidden className="size-3 text-muted-foreground/70" />
          {selected ? (
            <>
              <span className="text-muted-foreground">Follow-up</span>
              <span
                className={cn(
                  "tabular-nums",
                  tone ? FOLLOW_UP_TONE[tone] : "text-foreground",
                )}
              >
                {format(selected, "MMM d, yyyy")}
              </span>
            </>
          ) : (
            <span className="text-muted-foreground">Add a follow-up…</span>
          )}
        </PopoverTrigger>
        <PopoverContent className="w-auto gap-0 p-0" align="start">
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
          className="size-6 shrink-0 text-muted-foreground/50 hover:text-destructive"
        >
          <X />
        </Button>
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ past -- */

const LOG_ICONS: Record<Exclude<MockLogEntry["type"], "note">, LucideIcon> = {
  next_action_change: ArrowRight,
  state_change: CircleCheck,
  follow_up_change: Bell,
  area_move: MapPin,
};

/** History on the same rail, newest first — further down is further back. */
function PastSegment({
  log,
  lastActivityAt,
}: {
  log: MockLogEntry[];
  lastActivityAt: number;
}) {
  return (
    <section aria-label="Activity log" className="flex flex-col">
      <div className={cn("flex items-baseline gap-2 pb-1.5", ROW_PAD)}>
        <h2 className="text-[10px] font-medium tracking-wide text-muted-foreground/80 uppercase">
          Activity log
        </h2>
        <span className="text-[10px] text-muted-foreground/60">
          {`Updated ${formatDistanceToNow(new Date(lastActivityAt), {
            addSuffix: true,
          })}`}
        </span>
        <span aria-hidden className="ml-1 h-px flex-1 bg-border/40" />
        <span className="text-[10px] font-medium tracking-wide text-muted-foreground/60 uppercase">
          Newest first
        </span>
      </div>

      <div className="flex flex-col gap-4">
        {groupLogsByDay(log).map((group) => (
          <section
            key={group.key}
            aria-label={group.label}
            className="flex flex-col"
          >
            <div className={cn("pb-1.5", ROW_PAD)}>
              <h3 className="text-[10px] font-medium tracking-wide text-muted-foreground/80 uppercase">
                {group.label}
              </h3>
            </div>
            {group.entries.map((entry) =>
              entry.type === "note" ? (
                <ManualNote key={entry.id} entry={entry} />
              ) : (
                <AutomaticChange key={entry.id} entry={entry} />
              ),
            )}
          </section>
        ))}
      </div>
    </section>
  );
}

/** A note: gold filled node + raised card body. */
function ManualNote({ entry }: { entry: MockLogEntry }) {
  return (
    <div className={cn("relative py-1.5", ROW_PAD)}>
      <span
        aria-hidden
        className={cn(
          "absolute top-4 size-2.5 -translate-x-1/2 rounded-full",
          NODE_LEFT,
          "border border-(--brand-gold)/60 bg-(--brand-gold)",
          "ring-2 ring-background",
        )}
      />
      <div className="rounded-md border border-border bg-muted/40 px-3 py-2">
        <div className="mb-1 flex items-baseline justify-between gap-2">
          <span className="text-[10px] font-medium tracking-wide text-(--brand-gold) uppercase">
            Note
          </span>
          <LogTimestamp createdAt={entry.createdAt} />
        </div>
        <p className="whitespace-pre-wrap text-[13px] leading-snug text-foreground">
          {entry.content}
        </p>
      </div>
    </div>
  );
}

/** An automatic change: tiny hollow node, single compact muted line. */
function AutomaticChange({ entry }: { entry: MockLogEntry }) {
  const Icon = LOG_ICONS[entry.type as Exclude<MockLogEntry["type"], "note">];

  return (
    <div className={cn("relative py-1", ROW_PAD)}>
      <span
        aria-hidden
        className={cn(
          "absolute top-[9px] size-1.5 -translate-x-1/2 rounded-full border border-muted-foreground/40 bg-background",
          NODE_LEFT,
        )}
      />
      <div className="flex min-w-0 items-center gap-1.5 text-xs text-muted-foreground">
        <Icon className="size-3.5 shrink-0 text-muted-foreground/60" />
        <span className="shrink-0 font-medium">
          {getActivityLogEntryLabel(entry.type)}
        </span>
        <span className="truncate text-muted-foreground/80">
          {getChangeSummary(entry)}
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
      className="shrink-0 text-[10px] text-muted-foreground/60"
    >
      {format(date, "h:mm a")}
    </time>
  );
}

function groupLogsByDay(entries: MockLogEntry[]) {
  const groups = new Map<string, MockLogEntry[]>();

  for (const entry of [...entries].sort((a, b) => b.createdAt - a.createdAt)) {
    const key = format(new Date(entry.createdAt), "yyyy-MM-dd");
    const group = groups.get(key) ?? [];
    group.push(entry);
    groups.set(key, group);
  }

  return [...groups.entries()].map(([key, groupEntries]) => ({
    key,
    label: getDayLabel(groupEntries[0]!.createdAt),
    entries: groupEntries,
  }));
}

function getDayLabel(createdAt: number) {
  const date = new Date(createdAt);
  if (isToday(date)) return "Today";
  if (isYesterday(date)) return "Yesterday";
  return format(date, "MMMM d, yyyy");
}

function getChangeSummary(entry: MockLogEntry) {
  if (entry.previousValue && entry.newValue) {
    return `${entry.previousValue} → ${entry.newValue}`;
  }
  if (entry.newValue) return `Set to ${entry.newValue}`;
  if (entry.previousValue) {
    return entry.content.endsWith("completed")
      ? `Completed ${entry.previousValue}`
      : `Cleared ${entry.previousValue}`;
  }
  return entry.content;
}
