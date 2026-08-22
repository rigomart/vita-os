import { Button } from "@vita-os/ui/components/button";
import { Calendar } from "@vita-os/ui/components/calendar";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@vita-os/ui/components/popover";
import { format } from "date-fns";
import {
  ArrowRight,
  Bell,
  Check,
  ChevronDown,
  ChevronUp,
  Plus,
  X,
} from "lucide-react";
import { useId, useState } from "react";

import { EditableField } from "@/components/ui/editable-field";
import { whenTone } from "@/features/attention-list";
import { cn } from "@/lib/utils";

export interface ThreadAttentionPending {
  set?: boolean;
  clear?: boolean;
  complete?: boolean;
  followUp?: boolean;
}

interface ThreadAttentionProps {
  nextMove: string | undefined;
  /** The waiting moves, in order. Empty is the same as none. */
  upNext: readonly string[];
  followUp: number | undefined;
  /** The shared attention clock, so lateness matches every other surface. */
  now: number;
  onSetNextMove: (text: string) => void;
  onClearNextMove: () => void;
  onCompleteNextMove: () => void;
  /** Every Up Next edit sends the whole ordered line. */
  onReplaceUpNext: (moves: string[]) => void;
  onSetFollowUp: (date: number) => void;
  onClearFollowUp: () => void;
  pending?: ThreadAttentionPending;
}

/**
 * The Thread's whole attention state, read without a single interaction: the
 * live Next Move in a gold-edged slot, and — hanging off one hairline that
 * leaves that slot — the line of moves already known to be waiting behind it,
 * with the Follow-up riding the same rule.
 *
 * `xl` is the Thread pane's breakpoint (THREAD_PANE_BREAKPOINT): from there up
 * the pane is a rail with room for hover affordances; below it the Thread is a
 * bottom drawer, so every control stays visible and finger-sized.
 */
export function ThreadAttention({
  nextMove,
  upNext,
  followUp,
  now,
  onSetNextMove,
  onClearNextMove,
  onCompleteNextMove,
  onReplaceUpNext,
  onSetFollowUp,
  onClearFollowUp,
  pending,
}: ThreadAttentionProps) {
  return (
    <section
      role="region"
      aria-label="Thread attention"
      data-slot="thread-attention"
      className="flex shrink-0 flex-col gap-2"
    >
      <NextMoveSlot
        nextMove={nextMove}
        onSet={onSetNextMove}
        onClear={onClearNextMove}
        onComplete={onCompleteNextMove}
        pending={pending}
      />
      <Cascade
        moves={upNext}
        followUp={followUp}
        now={now}
        onReplace={onReplaceUpNext}
        onSetFollowUp={onSetFollowUp}
        onClearFollowUp={onClearFollowUp}
        isFollowUpPending={pending?.followUp}
      />
    </section>
  );
}

/* -------------------------------------------------------------------------- */
/* The slot                                                                   */
/* -------------------------------------------------------------------------- */

/**
 * The live slot: gold-edged, and always filled while anything waits below it.
 * Completing or clearing it pulls the front of the cascade up into it.
 */
function NextMoveSlot({
  nextMove,
  onSet,
  onClear,
  onComplete,
  pending,
}: {
  nextMove: string | undefined;
  onSet: (text: string) => void;
  onClear: () => void;
  onComplete: () => void;
  pending?: ThreadAttentionPending;
}) {
  return (
    <div className="group/next-move flex min-h-11 items-center gap-2 rounded-lg border border-border border-l-2 border-l-(--brand-gold) bg-muted/40 px-2.5 py-1.5">
      <ArrowRight
        aria-hidden
        className="size-3.5 shrink-0 text-muted-foreground/70"
      />

      {nextMove === undefined ? (
        <NextMoveInput
          ariaLabel="Next move"
          placeholder="Set the next move…"
          disabled={pending?.set}
          onCommit={onSet}
        />
      ) : (
        <>
          <Button
            variant="ghost"
            size="icon-xs"
            onClick={onComplete}
            disabled={pending?.complete}
            aria-busy={pending?.complete}
            aria-label="Complete next move"
            className="size-8 shrink-0 rounded-full border border-condition-healthy/40 text-condition-healthy hover:bg-condition-healthy/10 hover:text-condition-healthy xl:size-6"
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
                if (!text || pending?.set) return;
                onSet(text);
              }}
              disabled={pending?.set}
              inputAriaLabel="Next move"
              className="min-h-0 py-1 text-sm font-medium xl:py-0"
              displayClassName="block truncate border-transparent text-left hover:bg-transparent animate-in fade-in slide-in-from-bottom-2 duration-300 motion-reduce:animate-none"
            />
          </span>

          <Button
            variant="ghost"
            size="icon-xs"
            onClick={onClear}
            disabled={pending?.clear}
            aria-busy={pending?.clear}
            aria-label="Clear next move"
            className="size-8 shrink-0 text-muted-foreground/50 transition-opacity hover:text-destructive motion-reduce:transition-none xl:size-6 xl:opacity-0 xl:group-focus-within/next-move:opacity-100 xl:group-hover/next-move:opacity-100"
          >
            <X />
          </Button>
        </>
      )}
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* The cascade                                                                */
/* -------------------------------------------------------------------------- */

// The hairline geometry. The spine sits on the same x as the elbow's left
// border, each move hangs a 10px tick off it, and bodies clear both at pl-6.
// Deliberately tighter than the log's rail: this region is a spur of the slot
// above it, not a second timeline. Rows are a touch taller below `xl`, so the
// elbow's corner and the spine's head follow the row's centre line.
const SPINE_LEFT = "left-2";
const ROW_PAD = "pl-6";
const ROW_HEIGHT = "min-h-8 xl:min-h-7";

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

function toneAt(tones: string[], index: number): string {
  return tones[Math.min(index, tones.length - 1)]!;
}

const withMoveAt = (moves: readonly string[], index: number, text: string) =>
  moves.map((move, position) => (position === index ? text : move));

const withoutMove = (moves: readonly string[], index: number) =>
  moves.filter((_, position) => position !== index);

const withMoveShifted = (
  moves: readonly string[],
  index: number,
  to: number,
) => {
  const shifted = [...moves];
  const [move] = shifted.splice(index, 1);
  shifted.splice(to, 0, move!);
  return shifted;
};

function Cascade({
  moves,
  followUp,
  now,
  onReplace,
  onSetFollowUp,
  onClearFollowUp,
  isFollowUpPending,
}: {
  moves: readonly string[];
  followUp: number | undefined;
  now: number;
  onReplace: (moves: string[]) => void;
  onSetFollowUp: (date: number) => void;
  onClearFollowUp: () => void;
  isFollowUpPending?: boolean;
}) {
  const labelId = useId();

  return (
    <div className="flex flex-col">
      {/* The elbow drops out of the slot above and spurs right into the label.
          A fixed row height keeps the corner and the spine below it aligned. */}
      <div
        className={cn("relative flex h-8 items-center gap-2 xl:h-7", ROW_PAD)}
      >
        <span
          aria-hidden
          className={cn(
            "absolute -top-2 h-6 w-3 rounded-bl-[5px] border-b border-l border-border/70 xl:h-[1.375rem]",
            SPINE_LEFT,
          )}
        />
        <h2
          id={labelId}
          className="shrink-0 text-2xs font-medium tracking-wide text-muted-foreground/80 uppercase"
        >
          Up Next
        </h2>
        {moves.length > 0 && (
          <span className="shrink-0 text-2xs font-medium tabular-nums text-muted-foreground/60">
            {`· ${moves.length}`}
          </span>
        )}
        <span aria-hidden className="h-px flex-1 bg-border/50" />
        <FollowUpSatellite
          followUp={followUp}
          now={now}
          onSet={onSetFollowUp}
          onClear={onClearFollowUp}
          isPending={isFollowUpPending}
        />
      </div>

      {moves.length > 0 && (
        <ol aria-labelledby={labelId} className="relative flex flex-col">
          {/* The spine: the elbow's line, continuing past every move still
              waiting. It thins with depth and stops on the last tick. */}
          <span
            aria-hidden
            className={cn(
              // The negative top lifts it to the elbow's corner one row up.
              "absolute -top-4 bottom-3 w-px bg-gradient-to-b from-border/70 via-border/45 to-border/15 xl:-top-3.5",
              SPINE_LEFT,
            )}
          />
          {moves.map((move, index) => (
            <CascadeRow
              key={`${index}-${move}`}
              move={move}
              index={index}
              isLast={index === moves.length - 1}
              onEdit={(text) => onReplace(withMoveAt(moves, index, text))}
              onRemove={() => onReplace(withoutMove(moves, index))}
              onShift={(to) => onReplace(withMoveShifted(moves, index, to))}
            />
          ))}
        </ol>
      )}

      <AddMove onAdd={(text) => onReplace([...moves, text])} />
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
  onShift,
}: {
  move: string;
  index: number;
  isLast: boolean;
  onEdit: (text: string) => void;
  onRemove: () => void;
  onShift: (to: number) => void;
}) {
  return (
    <li
      className={cn(
        "group/move relative flex items-center gap-0.5 transition-colors duration-300 motion-reduce:transition-none",
        ROW_PAD,
        ROW_HEIGHT,
        toneAt(DEPTH_TONE, index),
      )}
    >
      <span
        aria-hidden
        className={cn(
          "absolute top-1/2 h-px w-2.5",
          SPINE_LEFT,
          toneAt(TICK_TONE, index),
        )}
      />

      <span className="min-w-0 flex-1">
        <EditableField
          value={move}
          onSave={(text) => {
            if (text) onEdit(text);
          }}
          inputAriaLabel="Upcoming move"
          className="min-h-0 py-0.5 text-sm leading-snug"
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
          onClick={() => onShift(index - 1)}
          aria-label="Move earlier"
          className="size-7 text-muted-foreground/60 hover:text-foreground xl:size-6"
        >
          <ChevronUp />
        </Button>
        <Button
          variant="ghost"
          size="icon-xs"
          disabled={isLast}
          onClick={() => onShift(index + 1)}
          aria-label="Move later"
          className="size-7 text-muted-foreground/60 hover:text-foreground xl:size-6"
        >
          <ChevronDown />
        </Button>
        <Button
          variant="ghost"
          size="icon-xs"
          onClick={onRemove}
          aria-label="Remove upcoming move"
          className="size-7 text-muted-foreground/50 hover:text-destructive xl:size-6"
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
    <div className={cn("relative flex items-center", ROW_PAD, ROW_HEIGHT)}>
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
        aria-label="Add an upcoming move"
        placeholder="Add what comes after…"
        className="h-9 w-full min-w-0 rounded-md border border-transparent bg-transparent px-0 text-sm outline-none transition-colors placeholder:text-muted-foreground/60 focus:border-border/60 focus:bg-muted/30 focus:px-1.5 motion-reduce:transition-none xl:h-7"
      />
    </div>
  );
}

/** The empty slot, waiting to be filled: Enter or blur commits. */
function NextMoveInput({
  ariaLabel,
  placeholder,
  disabled,
  onCommit,
}: {
  ariaLabel: string;
  placeholder: string;
  disabled?: boolean;
  onCommit: (text: string) => void;
}) {
  const [draft, setDraft] = useState("");

  const commit = () => {
    const text = draft.trim();
    if (!text || disabled) return;
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
      disabled={disabled}
      aria-label={ariaLabel}
      placeholder={placeholder}
      className="h-9 min-w-0 flex-1 rounded-md border border-transparent bg-transparent px-1 text-sm outline-none placeholder:text-muted-foreground/60 focus:ring-1 focus:ring-ring disabled:opacity-50 xl:h-7"
    />
  );
}

/* -------------------------------------------------------------------------- */
/* Follow-up                                                                  */
/* -------------------------------------------------------------------------- */

/** Lateness reads in the tone the rest of the app uses for a slipping date. */
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
  isPending,
}: {
  followUp: number | undefined;
  now: number;
  onSet: (date: number) => void;
  onClear: () => void;
  isPending?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const selected = followUp === undefined ? undefined : new Date(followUp);
  const tone = whenTone(followUp, now);

  return (
    <span className="flex shrink-0 items-center">
      <Popover open={open} onOpenChange={isPending ? undefined : setOpen}>
        <PopoverTrigger
          render={
            <Button
              variant="ghost"
              size="xs"
              disabled={isPending}
              // The Bell already says "follow-up", so the label stays visually
              // to the date alone — the phrase survives as the accessible name.
              aria-label={
                selected ? `Follow up ${format(selected, "MMM d")}` : undefined
              }
              className="h-8 gap-1.5 px-1.5 font-normal xl:h-6"
            />
          }
        >
          <Bell aria-hidden className="size-3 text-muted-foreground/70" />
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
          <p className="max-w-56 border-b border-border/60 px-3 py-2 text-xs leading-snug text-muted-foreground">
            A soft date — the Thread comes back to your attention around it.
          </p>
          <Calendar
            mode="single"
            selected={selected}
            disabled={isPending}
            onSelect={(date) => {
              if (!date || isPending) return;
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
          disabled={isPending}
          aria-busy={isPending}
          aria-label="Clear follow-up"
          className="size-7 shrink-0 text-muted-foreground/50 hover:text-destructive xl:size-5"
        >
          <X />
        </Button>
      )}
    </span>
  );
}
