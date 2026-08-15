/** PROTOTYPE (issue #280) — Variant E "Horizon": the path ahead as a horizontal row feeding the Next Move. Throwaway. */
import type { LucideIcon } from "lucide-react";

import { Button } from "@vita-os/ui/components/button";
import { Calendar } from "@vita-os/ui/components/calendar";
import { Input } from "@vita-os/ui/components/input";
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
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@vita-os/ui/components/tooltip";
import { format, formatDistanceToNow, isToday, isYesterday } from "date-fns";
import {
  ArrowRight,
  ArrowUp,
  Bell,
  Check,
  ChevronLeft,
  ChevronRight,
  CircleCheck,
  CircleDashed,
  MapPin,
  Plus,
  X,
} from "lucide-react";
import {
  Fragment,
  type KeyboardEvent,
  useCallback,
  useEffect,
  useRef,
  useState,
} from "react";

import { EditableField } from "@/components/ui/editable-field";
import { whenTone } from "@/features/attention-list";
import { cn } from "@/lib/utils";

import type { MockLogEntry, MockUpcomingMove } from "./mock-data";

import { useMockThread } from "./mock-data";

/**
 * Horizon: the Thread's future runs left-to-right. The Next Move sits in a
 * gold-marked slot; the upcoming moves stand on a receding row beneath it,
 * flowing back into the slot as it empties. The journal keeps the vertical
 * height it has today — only the future spends the horizontal axis.
 */
export function VariantE() {
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
    <TooltipProvider delay={400}>
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
              className="size-1.5 shrink-0 rounded-full bg-condition-healthy-fill"
            />
            <span className="truncate text-xs font-medium text-muted-foreground">
              {area.name}
            </span>
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
          <Horizon
            moves={upNext}
            followUp={thread.followUp}
            now={now}
            onEdit={editUpcomingMove}
            onRemove={removeUpcomingMove}
            onReorder={reorderUpcomingMove}
            onAdd={addUpcomingMove}
            onSetFollowUp={setFollowUp}
          />
        </section>

        <PrototypeActivityLog
          log={log}
          lastActivityAt={thread.lastActivityAt}
          onAddNote={addNote}
        />
      </div>
    </TooltipProvider>
  );
}

/* -------------------------------------------------------------------------- */
/* The slot                                                                    */
/* -------------------------------------------------------------------------- */

/**
 * The live slot: gold-edged, always filled while anything waits on the horizon.
 * Completing or clearing it pulls the front upcoming move in.
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
        <NextMoveInput onCommit={onSet} />
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

          {/* EditableField fills its parent, so the slot constrains it. */}
          <span className="min-w-0 flex-1">
            <EditableField
              value={nextMove}
              onSave={(text) => {
                if (text) onSet(text);
              }}
              inputAriaLabel="Next move"
              className="min-h-0 py-0 text-[13px] font-medium"
              displayClassName="block truncate border-transparent text-left hover:bg-transparent"
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

function NextMoveInput({ onCommit }: { onCommit: (text: string) => void }) {
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
      aria-label="Next move"
      placeholder="Set the next move…"
      className="h-7 min-w-0 flex-1 rounded-md border border-transparent bg-transparent px-1 text-[13px] outline-none placeholder:text-muted-foreground/60 focus:ring-1 focus:ring-ring"
    />
  );
}

/* -------------------------------------------------------------------------- */
/* The horizon                                                                 */
/* -------------------------------------------------------------------------- */

/** Distance reads as fade: the further out a move is, the quieter it sits. */
const HORIZON_FADE = ["opacity-100", "opacity-90", "opacity-80", "opacity-70"];

const MOVE_WIDTH = "w-44";

interface HorizonProps {
  moves: MockUpcomingMove[];
  followUp: number | undefined;
  now: number;
  onEdit: (id: string, text: string) => void;
  onRemove: (id: string) => void;
  onReorder: (id: string, toIndex: number) => void;
  onAdd: (text: string) => void;
  onSetFollowUp: (timestamp: number | null) => void;
}

function Horizon({
  moves,
  followUp,
  now,
  onEdit,
  onRemove,
  onReorder,
  onAdd,
  onSetFollowUp,
}: HorizonProps) {
  const scrollerRef = useRef<HTMLDivElement>(null);
  const [hasMoreAhead, setHasMoreAhead] = useState(false);
  const frontId = moves[0]?.id;

  const syncEdge = useCallback(() => {
    const el = scrollerRef.current;
    if (!el) return;
    setHasMoreAhead(el.scrollLeft + el.clientWidth < el.scrollWidth - 4);
  }, []);

  useEffect(() => {
    syncEdge();
  }, [syncEdge, moves.length]);

  // A promotion (or a reorder onto the front) re-anchors the row at its start,
  // so what feeds the slot next is always the chip nearest the elbow.
  useEffect(() => {
    scrollerRef.current?.scrollTo({ left: 0, behavior: "smooth" });
  }, [frontId]);

  return (
    <>
      {/* The elbow drops out of the slot above and turns right into the row. */}
      <div className="relative flex min-h-6 items-center gap-2 pl-6">
        <span
          aria-hidden
          className="absolute -top-2 left-2 h-5 w-3 rounded-bl-[5px] border-b border-l border-border/70"
        />
        <h2 className="text-[10px] font-medium tracking-wide text-muted-foreground/80 uppercase">
          Up Next
        </h2>
        {moves.length > 0 && (
          <span className="rounded-full bg-surface-3 px-1.5 py-0.5 text-[10px] font-medium tabular-nums text-muted-foreground">
            {moves.length}
          </span>
        )}
        <span aria-hidden className="h-px flex-1 bg-border/50" />
        <FollowUpSatellite
          followUp={followUp}
          now={now}
          onSet={(timestamp) => onSetFollowUp(timestamp)}
          onClear={() => onSetFollowUp(null)}
        />
      </div>

      <div className="relative">
        <div
          ref={scrollerRef}
          onScroll={syncEdge}
          aria-label="Up Next"
          className="flex items-stretch gap-1 overflow-x-auto scroll-smooth pt-3 pb-1 pl-6 motion-reduce:scroll-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
        >
          {moves.length === 0 && (
            <p className="max-w-52 self-center pr-2 text-[13px] leading-snug text-muted-foreground">
              Nothing waiting behind the next move.
            </p>
          )}

          {moves.map((move, index) => (
            <Fragment key={move.id}>
              {index > 0 && (
                <ChevronRight
                  aria-hidden
                  className="mt-4 size-3 shrink-0 self-start text-muted-foreground/40"
                />
              )}
              <HorizonMove
                move={move}
                index={index}
                total={moves.length}
                onEdit={onEdit}
                onRemove={onRemove}
                onReorder={onReorder}
              />
            </Fragment>
          ))}

          <AddMove onAdd={onAdd} hasMoves={moves.length > 0} />
        </div>

        {/* The path keeps going past the pane's edge. */}
        {hasMoreAhead && (
          <span
            aria-hidden
            className="pointer-events-none absolute inset-y-0 right-0 w-10 bg-gradient-to-l from-popover to-transparent"
          />
        )}
      </div>
    </>
  );
}

function HorizonMove({
  move,
  index,
  total,
  onEdit,
  onRemove,
  onReorder,
}: {
  move: MockUpcomingMove;
  index: number;
  total: number;
  onEdit: (id: string, text: string) => void;
  onRemove: (id: string) => void;
  onReorder: (id: string, toIndex: number) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(move.text);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setDraft(move.text);
  }, [move.text]);

  useEffect(() => {
    if (editing) inputRef.current?.focus();
  }, [editing]);

  const commit = () => {
    setEditing(false);
    const text = draft.trim();
    if (!text) {
      setDraft(move.text);
      return;
    }
    if (text !== move.text) onEdit(move.id, text);
  };

  const handleKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === "Enter") {
      event.preventDefault();
      commit();
    }
    if (event.key === "Escape") {
      setDraft(move.text);
      setEditing(false);
    }
  };

  return (
    <div
      className={cn(
        "group/move relative flex shrink-0 flex-col rounded-lg border bg-muted/30 px-2.5 py-2 transition-opacity hover:opacity-100 motion-reduce:transition-none",
        MOVE_WIDTH,
        HORIZON_FADE[index] ?? "opacity-60",
        index === 0
          ? "border-border border-l-2 border-l-(--brand-gold)/60 bg-muted/50"
          : "border-border/60",
      )}
    >
      {editing ? (
        <Input
          ref={inputRef}
          variant="inline"
          value={draft}
          onChange={(event) => setDraft(event.target.value)}
          onBlur={commit}
          onKeyDown={handleKeyDown}
          aria-label="Upcoming move"
          className="text-[13px] leading-snug"
        />
      ) : (
        <Tooltip>
          <TooltipTrigger
            render={
              <button
                type="button"
                onClick={() => setEditing(true)}
                aria-label={`Edit upcoming move: ${move.text}`}
                className="cursor-text rounded-sm text-left text-[13px] leading-snug outline-none focus-visible:ring-1 focus-visible:ring-ring"
              />
            }
          >
            <span className="line-clamp-3">{move.text}</span>
          </TooltipTrigger>
          <TooltipContent side="bottom">{move.text}</TooltipContent>
        </Tooltip>
      )}

      {/* Reorder and remove ride above the card, in the pane's own control
          cluster shape. Always visible on touch; hover-revealed on the rail. */}
      <div className="absolute -top-2.5 right-1 flex items-center rounded-4xl bg-secondary px-0.5 shadow-sm transition-opacity motion-reduce:transition-none xl:opacity-0 xl:group-focus-within/move:opacity-100 xl:group-hover/move:opacity-100">
        <Button
          variant="ghost"
          size="icon-xs"
          onClick={() => onReorder(move.id, index - 1)}
          disabled={index === 0}
          aria-label="Move earlier"
          className="size-5 rounded-full text-muted-foreground hover:text-foreground"
        >
          <ChevronLeft />
        </Button>
        <Button
          variant="ghost"
          size="icon-xs"
          onClick={() => onReorder(move.id, index + 1)}
          disabled={index === total - 1}
          aria-label="Move later"
          className="size-5 rounded-full text-muted-foreground hover:text-foreground"
        >
          <ChevronRight />
        </Button>
        <Button
          variant="ghost"
          size="icon-xs"
          onClick={() => onRemove(move.id)}
          aria-label="Remove upcoming move"
          className="size-5 rounded-full text-muted-foreground/70 hover:text-destructive"
        >
          <X />
        </Button>
      </div>
    </div>
  );
}

/** The end of the path: where a new move joins the horizon. */
function AddMove({
  onAdd,
  hasMoves,
}: {
  onAdd: (text: string) => void;
  hasMoves: boolean;
}) {
  const [adding, setAdding] = useState(false);
  const [draft, setDraft] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (adding) inputRef.current?.focus();
  }, [adding]);

  const commit = () => {
    const text = draft.trim();
    setDraft("");
    setAdding(false);
    if (text) onAdd(text);
  };

  if (adding) {
    return (
      <div
        className={cn(
          "flex shrink-0 flex-col rounded-lg border border-(--brand-gold)/60 bg-muted/30 px-2.5 py-2",
          MOVE_WIDTH,
        )}
      >
        <Input
          ref={inputRef}
          variant="inline"
          value={draft}
          onChange={(event) => setDraft(event.target.value)}
          onBlur={commit}
          onKeyDown={(event) => {
            if (event.key === "Enter") {
              event.preventDefault();
              commit();
            }
            if (event.key === "Escape") {
              setDraft("");
              setAdding(false);
            }
          }}
          aria-label="New upcoming move"
          placeholder="What comes after…"
          className="text-[13px] leading-snug"
        />
      </div>
    );
  }

  return (
    <button
      type="button"
      onClick={() => setAdding(true)}
      aria-label="Add an upcoming move"
      className={cn(
        "flex shrink-0 flex-col items-start gap-1 rounded-lg border border-dashed border-border/70 px-2.5 py-2 text-[13px] text-muted-foreground transition-colors hover:border-border hover:bg-muted/40 hover:text-foreground focus-visible:ring-1 focus-visible:ring-ring focus-visible:outline-none motion-reduce:transition-none",
        hasMoves ? "w-32" : MOVE_WIDTH,
      )}
    >
      <Plus aria-hidden className="size-3.5" />
      Add a move
    </button>
  );
}

/* -------------------------------------------------------------------------- */
/* Follow-up                                                                   */
/* -------------------------------------------------------------------------- */

const FOLLOW_UP_TONE = {
  overdue: "text-condition-attention",
  due: "text-brand-accent-foreground",
} as const;

/** A satellite of the slot: when this Thread should come back, not a deadline. */
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

const LOG_LABELS: Record<AutomaticEntry["type"], string> = {
  next_action_change: "Next move",
  state_change: "Lifecycle",
  follow_up_change: "Follow-up",
  area_move: "Area",
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

      {/* The only scrolling region in the pane's vertical axis. */}
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
        <Icon className="size-3.5 shrink-0 text-muted-foreground/60" />
        <span className="shrink-0 font-medium">{LOG_LABELS[entry.type]}</span>
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
      className="shrink-0 text-[10px] text-muted-foreground/60"
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
        <label htmlFor="prototype-e-note" className="sr-only">
          Activity log note
        </label>
        <InputGroup className="bg-muted/50 has-[textarea]:rounded-3xl has-data-[align=block-end]:rounded-3xl">
          <InputGroupTextarea
            id="prototype-e-note"
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
