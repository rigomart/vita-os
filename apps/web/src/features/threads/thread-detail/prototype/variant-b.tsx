/** PROTOTYPE (issue #280) — Variant B "Cascade": E's slot-and-elbow anatomy with a vertical list. Throwaway. */
import type { LucideIcon } from "lucide-react";

import { Button } from "@vita-os/ui/components/button";
import { Calendar } from "@vita-os/ui/components/calendar";
import {
  InputGroup,
  InputGroupAddon,
  InputGroupButton,
  InputGroupTextarea,
} from "@vita-os/ui/components/input-group";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@vita-os/ui/components/popover";
import { format, formatDistanceToNow, isToday, isYesterday } from "date-fns";
import {
  ArrowRight,
  ArrowUp,
  Bell,
  Check,
  ChevronDown,
  ChevronUp,
  CircleCheck,
  CircleDashed,
  MapPin,
  Plus,
  X,
} from "lucide-react";
import { useRef, useState } from "react";

import { EditableField } from "@/components/ui/editable-field";
import { conditionDotClassName } from "@/features/areas/condition-presentation";
import { whenTone } from "@/features/attention-list";
import { getActivityLogEntryLabel } from "@/features/threads/activity-log-entry";
import { cn } from "@/lib/utils";

import type { MockLogEntry, MockUpcomingMove } from "./mock-data";

import { useMockThread } from "./mock-data";

/**
 * Cascade: one hairline leaves the gold edge of the Next Move slot, spurs into
 * the "Up Next" label, and keeps falling past every move still waiting. The
 * moves are lines, not cards — the whole future costs a handful of rows, so the
 * Activity log keeps the height it has today.
 */
export function VariantB() {
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
        className="flex shrink-0 flex-col gap-3"
      >
        {/* `pr-24` clears the pane's absolutely-placed control cluster. */}
        <div className="flex items-center gap-2 pr-24">
          <span
            aria-hidden
            className={cn(
              "size-1.5 shrink-0 rounded-full",
              conditionDotClassName[area.condition],
            )}
          />
          <span className="min-w-0 truncate text-xs font-medium text-muted-foreground">
            {area.name}
          </span>
          <span aria-hidden className="h-3 w-px shrink-0 bg-border/60" />
          <span className="flex shrink-0 items-center gap-1.5 text-[11px] text-muted-foreground">
            {thread.state === "resolved" ? (
              <CircleCheck aria-hidden className="size-3" />
            ) : (
              <CircleDashed aria-hidden className="size-3" />
            )}
            {thread.state === "resolved" ? "Resolved" : "Open"}
          </span>
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
            editorClassName="rounded-lg border border-border/60 bg-muted/20 px-2.5"
          />
        </div>
      </header>

      <section
        aria-label="Thread attention"
        className="flex shrink-0 flex-col gap-2"
      >
        <NextMoveSlot
          nextMove={thread.nextMove}
          onComplete={completeNextMove}
          onClear={clearNextMove}
          onSet={setNextMove}
        />
        <Cascade
          moves={upNext}
          followUp={thread.followUp}
          now={now}
          onAdd={addUpcomingMove}
          onEdit={editUpcomingMove}
          onRemove={removeUpcomingMove}
          onReorder={reorderUpcomingMove}
          onSetFollowUp={setFollowUp}
        />
      </section>

      <PrototypeActivityLog
        log={log}
        lastActivityAt={thread.lastActivityAt}
        onAddNote={addNote}
      />
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* The slot                                                                    */
/* -------------------------------------------------------------------------- */

/**
 * The live slot: gold-edged, always filled while anything waits below it.
 * Completing or clearing it pulls the top move of the cascade up into it.
 */
function NextMoveSlot({
  nextMove,
  onComplete,
  onClear,
  onSet,
}: {
  nextMove: string | undefined;
  onComplete: () => void;
  onClear: () => void;
  onSet: (text: string) => void;
}) {
  return (
    <div className="group/next-move flex min-h-11 items-center gap-2 rounded-lg border border-border border-l-2 border-l-(--brand-gold) bg-muted/40 px-2.5 py-1.5">
      <ArrowRight
        aria-hidden
        className="size-3.5 shrink-0 text-muted-foreground/70"
      />

      {nextMove === undefined ? (
        <SlotInput
          ariaLabel="Next move"
          placeholder="Set the next move…"
          onCommit={onSet}
        />
      ) : (
        <>
          <Button
            variant="ghost"
            size="icon-xs"
            onClick={onComplete}
            aria-label="Complete next move"
            className="size-6 shrink-0 rounded-full border border-condition-healthy/40 text-condition-healthy hover:bg-condition-healthy/10 hover:text-condition-healthy"
          >
            <Check />
          </Button>

          {/* Keyed on the text: a promotion remounts the field, so the move
              that just arrived rises out of the cascade into the slot. */}
          <span className="min-w-0 flex-1">
            <EditableField
              key={nextMove}
              value={nextMove}
              onSave={(text) => {
                if (text) onSet(text);
              }}
              inputAriaLabel="Next move"
              className="min-h-0 py-0 text-[13px] font-medium"
              displayClassName="block truncate border-transparent text-left hover:bg-transparent animate-in fade-in slide-in-from-bottom-2 duration-300 motion-reduce:animate-none"
            />
          </span>

          <Button
            variant="ghost"
            size="icon-xs"
            onClick={onClear}
            aria-label="Clear next move"
            className="size-6 shrink-0 text-muted-foreground/50 transition-opacity hover:text-destructive motion-reduce:transition-none xl:opacity-0 xl:group-focus-within/next-move:opacity-100 xl:group-hover/next-move:opacity-100"
          >
            <X />
          </Button>
        </>
      )}
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* The cascade                                                                 */
/* -------------------------------------------------------------------------- */

// The hairline geometry. The spine sits on the same x as the elbow's left
// border (8–9px), each move hangs a 10px tick off it, and bodies clear both
// at pl-6. Deliberately tighter than the log's rail: this region is a spur of
// the slot above it, not a second timeline.
const SPINE_LEFT = "left-2";
const ROW_PAD = "pl-6";

/** Depth reads as ink: the further down the cascade, the quieter the line. */
const DEPTH_TONE = [
  "text-foreground",
  "text-foreground/85",
  "text-muted-foreground",
  "text-muted-foreground/75",
];

/** The tick is gold on the move that fills the slot next, then fades with it. */
const TICK_TONE = [
  "bg-(--brand-gold)/70",
  "bg-border/70",
  "bg-border/55",
  "bg-border/40",
];

function Cascade({
  moves,
  followUp,
  now,
  onAdd,
  onEdit,
  onRemove,
  onReorder,
  onSetFollowUp,
}: {
  moves: MockUpcomingMove[];
  followUp: number | undefined;
  now: number;
  onAdd: (text: string) => void;
  onEdit: (id: string, text: string) => void;
  onRemove: (id: string) => void;
  onReorder: (id: string, toIndex: number) => void;
  onSetFollowUp: (timestamp: number | null) => void;
}) {
  return (
    <div className="flex flex-col">
      {/* The elbow drops out of the slot above and spurs right into the label.
          Fixed row height keeps the corner and the spine below it aligned. */}
      <div className={cn("relative flex h-7 items-center gap-2", ROW_PAD)}>
        <span
          aria-hidden
          className={cn(
            "absolute -top-2 h-[1.375rem] w-3 rounded-bl-[5px] border-b border-l border-border/70",
            SPINE_LEFT,
          )}
        />
        <h2 className="shrink-0 text-[10px] font-medium tracking-wide text-muted-foreground/80 uppercase">
          Up Next
        </h2>
        <span className="shrink-0 text-[10px] font-medium tabular-nums text-muted-foreground/60">
          {`· ${moves.length}`}
        </span>
        <span aria-hidden className="h-px flex-1 bg-border/50" />
        <FollowUpSatellite
          followUp={followUp}
          now={now}
          onSet={(timestamp) => onSetFollowUp(timestamp)}
          onClear={() => onSetFollowUp(null)}
        />
      </div>

      <div className="flex flex-col">
        {moves.length === 0 ? (
          <p
            className={cn(
              "py-1 text-[13px] leading-snug text-muted-foreground",
              ROW_PAD,
            )}
          >
            Nothing waiting behind the next move.
          </p>
        ) : (
          <ol className="relative flex flex-col">
            {/* The spine: the elbow's line, continuing past every move that is
                still waiting. It thins with depth and stops on the last tick. */}
            <span
              aria-hidden
              className={cn(
                // -top-3.5 lifts it to the elbow's corner in the row above.
                "absolute -top-3.5 bottom-3 w-px bg-gradient-to-b from-border/70 via-border/45 to-border/15",
                SPINE_LEFT,
              )}
            />
            {moves.map((move, index) => (
              <CascadeRow
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
        )}

        <AddMove onAdd={onAdd} />
      </div>
    </div>
  );
}

/**
 * One waiting move: a line, not a card. The tick that ties it to the spine
 * turns gold on the move that fills the slot next.
 */
function CascadeRow({
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
      className={cn(
        "group/move relative flex min-h-7 items-center gap-0.5 transition-colors duration-300 motion-reduce:transition-none",
        ROW_PAD,
        DEPTH_TONE[Math.min(index, DEPTH_TONE.length - 1)],
      )}
    >
      <span
        aria-hidden
        className={cn(
          "absolute top-1/2 h-px w-2.5",
          SPINE_LEFT,
          TICK_TONE[Math.min(index, TICK_TONE.length - 1)],
        )}
      />

      <span className="min-w-0 flex-1">
        <EditableField
          value={move.text}
          onSave={(text) => {
            if (text) onEdit(move.id, text);
          }}
          inputAriaLabel="Upcoming move"
          className="min-h-0 py-0.5 text-[13px] leading-snug"
          displayClassName="border-transparent hover:bg-muted/40"
        />
      </span>

      {/* Always reachable on touch; on the wide rail the row stays clean until
          it is hovered or focused. */}
      <span className="flex shrink-0 items-center transition-opacity motion-reduce:transition-none xl:opacity-0 xl:group-focus-within/move:opacity-100 xl:group-hover/move:opacity-100">
        <Button
          variant="ghost"
          size="icon-xs"
          disabled={index === 0}
          onClick={() => onReorder(move.id, index - 1)}
          aria-label="Move earlier"
          className="text-muted-foreground/60 hover:text-foreground"
        >
          <ChevronUp />
        </Button>
        <Button
          variant="ghost"
          size="icon-xs"
          disabled={isLast}
          onClick={() => onReorder(move.id, index + 1)}
          aria-label="Move later"
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

/** The foot of the cascade: where a new move joins the back of the line. */
function AddMove({ onAdd }: { onAdd: (text: string) => void }) {
  const [draft, setDraft] = useState("");

  const commit = () => {
    const text = draft.trim();
    if (!text) return;
    setDraft("");
    onAdd(text);
  };

  return (
    <div className={cn("relative flex min-h-7 items-center", ROW_PAD)}>
      <Plus
        aria-hidden
        className={cn(
          "absolute top-1/2 size-2.5 -translate-x-[3px] -translate-y-1/2 text-muted-foreground/50",
          SPINE_LEFT,
        )}
      />
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
          if (event.key === "Escape") setDraft("");
        }}
        aria-label="Add a move"
        placeholder="Add a move…"
        className="h-7 w-full min-w-0 rounded-md border border-transparent bg-transparent px-0 text-[13px] outline-none transition-colors placeholder:text-muted-foreground/60 focus:border-border/60 focus:bg-muted/30 focus:px-1.5 motion-reduce:transition-none"
      />
    </div>
  );
}

/** Shared one-line committer for the empty slot: Enter or blur commits. */
function SlotInput({
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
      className="h-7 min-w-0 flex-1 rounded-md border border-transparent bg-transparent px-1 text-[13px] outline-none placeholder:text-muted-foreground/60 focus:ring-1 focus:ring-ring"
    />
  );
}

/* -------------------------------------------------------------------------- */
/* Follow-up                                                                   */
/* -------------------------------------------------------------------------- */

const FOLLOW_UP_TONE = {
  overdue: "text-condition-attention",
  due: "text-brand-accent-foreground",
} as const;

/**
 * A satellite riding the label row's hairline: when this Thread should come
 * back, not a deadline on any one move.
 */
function FollowUpSatellite({
  followUp,
  now,
  onSet,
  onClear,
}: {
  followUp: number | undefined;
  now: number;
  onSet: (timestamp: number) => void;
  onClear: () => void;
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
          onClick={onClear}
          aria-label="Clear follow-up"
          className="size-5 shrink-0 text-muted-foreground/50 hover:text-destructive"
        >
          <X />
        </Button>
      )}
    </span>
  );
}

/* -------------------------------------------------------------------------- */
/* Activity log (mock mirror of the app's log)                                 */
/* -------------------------------------------------------------------------- */

type AutomaticEntry = MockLogEntry & {
  type: Exclude<MockLogEntry["type"], "note">;
};

const LOG_ICONS: Record<AutomaticEntry["type"], LucideIcon> = {
  next_action_change: ArrowRight,
  state_change: CircleCheck,
  follow_up_change: Bell,
  area_move: MapPin,
};

const RAIL_LEFT = "left-[11px]";
const NODE_LEFT = "left-[11.5px]";
const ENTRY_PAD = "pl-9";

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
      className="flex min-h-0 flex-1 flex-col gap-2"
    >
      <div className="flex shrink-0 items-center gap-2">
        <h2 className="font-heading text-sm font-semibold tracking-tight">
          Activity log
        </h2>
        <span className="rounded-full bg-surface-3 px-2 py-0.5 text-[11px] font-medium tabular-nums text-muted-foreground">
          {log.length}
        </span>
        <span aria-hidden className="ml-1 h-px flex-1 bg-border/50" />
        <span className="text-[10px] font-medium tracking-wide text-muted-foreground/60 uppercase">
          Newest first
        </span>
      </div>

      {/* The pane's only scrolling region. */}
      <div
        ref={scrollRef}
        className="min-h-0 flex-1 scroll-smooth overflow-y-auto overscroll-contain motion-reduce:scroll-auto"
      >
        <div className="relative pb-6">
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

      <LogComposer
        onAddNote={onAddNote}
        onPosted={() => scrollRef.current?.scrollTo?.({ top: 0 })}
      />
    </section>
  );
}

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
        <p className="whitespace-pre-wrap text-[13px] leading-snug text-foreground">
          {entry.content}
        </p>
      </div>
    </div>
  );
}

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

function LogComposer({
  onAddNote,
  onPosted,
}: {
  onAddNote: (content: string) => void;
  onPosted: () => void;
}) {
  const [noteText, setNoteText] = useState("");

  const submit = () => {
    const text = noteText.trim();
    if (!text) return;
    setNoteText("");
    onAddNote(text);
    onPosted();
  };

  return (
    <div className="relative shrink-0 pt-2">
      {/* Fade the scrolled log out from under the bar. */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-0 -top-4 h-6 bg-gradient-to-t from-popover to-transparent"
      />
      <form
        onSubmit={(event) => {
          event.preventDefault();
          submit();
        }}
      >
        <label htmlFor="prototype-b-note" className="sr-only">
          Activity log note
        </label>
        <InputGroup className="bg-muted/50 has-[textarea]:rounded-3xl has-data-[align=block-end]:rounded-3xl">
          <InputGroupTextarea
            id="prototype-b-note"
            value={noteText}
            onChange={(event) => setNoteText(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter" && !event.shiftKey) {
                event.preventDefault();
                submit();
              }
            }}
            aria-label="Activity log note"
            placeholder="Log what just happened…"
            rows={1}
            className="min-h-10 py-2.5 pr-11 pl-4 text-[13px]"
          />
          <InputGroupAddon
            align="block-end"
            className="absolute right-2 bottom-2 w-auto p-0"
          >
            <InputGroupButton
              type="submit"
              size="icon-xs"
              variant="secondary"
              disabled={!noteText.trim()}
              aria-label="Add note"
            >
              <ArrowUp data-icon="inline-start" />
            </InputGroupButton>
          </InputGroupAddon>
        </InputGroup>
      </form>
    </div>
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
