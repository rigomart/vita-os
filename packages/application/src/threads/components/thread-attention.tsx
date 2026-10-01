import type { Move, MoveId } from "@vita-os/contracts";

import { Button } from "@vita-os/ui/components/button";
import { cn } from "@vita-os/ui/lib/utils";
import { format } from "date-fns";
import { Bell, Check, Plus, X } from "lucide-react";
import { useState } from "react";

import { WhenPopover, whenTone, withTimeToken } from "../../attention-list";
import { EditableField } from "../../ui/editable-field";

export interface ThreadAttentionPending {
  followUp?: boolean;
}

interface ThreadAttentionProps {
  /** Every Move, in the order it was captured. */
  moves: readonly Move[];
  focusedMoveId?: MoveId;
  followUp: number | undefined;
  /** The shared attention clock, so lateness matches every other surface. */
  now: number;
  onAddMove: (text: string) => void;
  onEditMove: (moveId: MoveId, text: string) => void;
  onRemoveMove: (moveId: MoveId) => void;
  onCompleteMove: (moveId: MoveId) => void;
  /** `null` unfocuses; a Move replaces any earlier focus. */
  onFocusMove: (moveId: MoveId | null) => void;
  onSetFollowUp: (date: number) => void;
  onClearFollowUp: () => void;
  pending?: ThreadAttentionPending;
}

/**
 * The Thread's live attention: its Moves as one list of peers, and the
 * Follow-up riding the list's rule.
 *
 * The list keeps capture order and never reorders itself. Focus is a radio
 * down the left edge: pressing it focuses that Move, and pressing the filled
 * one unfocuses it. The Focused Move is tinted where it sits. Leaving every
 * Move unfocused is a fine answer — nothing here asks for a priority.
 *
 * `xl` is the Thread pane's breakpoint (THREAD_PANE_BREAKPOINT): from there up
 * the pane is a rail with room for hover affordances; below it the Thread is a
 * bottom drawer, so every control stays visible and finger-sized.
 */
export function ThreadAttention({
  moves,
  focusedMoveId,
  followUp,
  now,
  onAddMove,
  onEditMove,
  onRemoveMove,
  onCompleteMove,
  onFocusMove,
  onSetFollowUp,
  onClearFollowUp,
  pending,
}: ThreadAttentionProps) {
  return (
    <section
      role="region"
      aria-label="Thread attention"
      data-slot="thread-attention"
      className="flex shrink-0 flex-col gap-1"
    >
      <div className="flex h-8 items-center gap-2 xl:h-7">
        <span className="shrink-0 text-2xs font-medium tracking-wide text-muted-foreground/80 uppercase">
          Moves
        </span>
        {moves.length > 0 && (
          <span className="shrink-0 text-2xs font-medium tabular-nums text-muted-foreground/60">
            {moves.length}
          </span>
        )}
        <span aria-hidden className="h-px flex-1 bg-border/50" />
        <FollowUpSatellite
          followUp={followUp}
          now={now}
          onSet={onSetFollowUp}
          onClear={onClearFollowUp}
          isPending={pending?.followUp}
        />
      </div>

      {moves.length > 1 && (
        <p className="px-0.5 pb-1 text-xs text-muted-foreground/65">
          Focus one when you know it, or leave them all unfocused.
        </p>
      )}

      {moves.length > 0 && (
        <ul aria-label="Moves" className="flex flex-col gap-0.5">
          {moves.map((move) => (
            <MoveRow
              key={move._id}
              move={move}
              focused={move._id === focusedMoveId}
              onEdit={(text) => onEditMove(move._id, text)}
              onRemove={() => onRemoveMove(move._id)}
              onComplete={() => onCompleteMove(move._id)}
              onToggleFocus={() =>
                onFocusMove(move._id === focusedMoveId ? null : move._id)
              }
            />
          ))}
        </ul>
      )}

      <AddMove onAdd={onAddMove} />
    </section>
  );
}

/**
 * One Move: a line, not a card. The radio says whether it is the one; the
 * focused line is tinted in place so the list never reorders to show it.
 */
function MoveRow({
  move,
  focused,
  onEdit,
  onRemove,
  onComplete,
  onToggleFocus,
}: {
  move: Move;
  focused: boolean;
  onEdit: (text: string) => void;
  onRemove: () => void;
  onComplete: () => void;
  onToggleFocus: () => void;
}) {
  return (
    <li
      data-focused={focused || undefined}
      className={cn(
        "group/move flex min-h-10 items-center gap-2 rounded-lg px-1.5 py-1 transition-colors motion-reduce:transition-none xl:min-h-9",
        focused
          ? "bg-brand-accent/12 font-medium"
          : "text-foreground/90 hover:bg-muted/50",
      )}
    >
      <button
        type="button"
        onClick={onToggleFocus}
        aria-pressed={focused}
        aria-label={focused ? "Unfocus this move" : "Focus this move"}
        title={focused ? "Unfocus this move" : "Focus this move"}
        className="group/radio flex size-8 shrink-0 items-center justify-center rounded-full outline-none focus-visible:ring-2 focus-visible:ring-ring/40 xl:size-6"
      >
        <span
          aria-hidden
          className={cn(
            "flex size-3.5 items-center justify-center rounded-full border-[1.5px] transition-colors motion-reduce:transition-none",
            focused
              ? "border-brand-accent-strong"
              : "border-muted-foreground/50 group-hover/radio:border-brand-accent-strong",
          )}
        >
          {focused && (
            <span className="size-1.5 rounded-full bg-brand-accent-strong" />
          )}
        </span>
      </button>

      <span className="min-w-0 flex-1">
        <EditableField
          value={move.text}
          onSave={(text) => {
            if (text) onEdit(text);
          }}
          inputAriaLabel="Move"
          className="min-h-0 py-0.5 text-sm leading-snug"
          displayClassName="border-transparent hover:bg-transparent"
        />
      </span>

      {/* Always reachable on touch; on the wide rail the row stays clean until
          it is hovered or focused. */}
      <span className="flex shrink-0 items-center gap-0.5">
        <Button
          variant="ghost"
          size="icon-xs"
          onClick={onRemove}
          aria-label="Remove move"
          title="Remove"
          className="size-7 text-muted-foreground/50 transition-opacity hover:text-destructive motion-reduce:transition-none xl:size-6 xl:opacity-0 xl:group-focus-within/move:opacity-100 xl:group-hover/move:opacity-100"
        >
          <X />
        </Button>
        <Button
          variant="ghost"
          size="icon-xs"
          onClick={onComplete}
          aria-label="Complete move"
          title="Complete"
          className="size-8 shrink-0 rounded-full border border-condition-healthy/40 text-transparent hover:bg-condition-healthy/10 hover:text-condition-healthy focus-visible:text-condition-healthy xl:size-6"
        >
          <Check />
        </Button>
      </span>
    </li>
  );
}

/** The foot of the list: capture a Move with nothing to decide. */
function AddMove({ onAdd }: { onAdd: (text: string) => void }) {
  const [draft, setDraft] = useState("");

  const commit = () => {
    const text = draft.trim();
    if (!text) return;
    setDraft("");
    onAdd(text);
  };

  return (
    <div className="flex min-h-9 items-center gap-2 px-1.5 xl:min-h-8">
      <span
        aria-hidden
        className="flex size-8 shrink-0 items-center justify-center text-muted-foreground/50 xl:size-6"
      >
        <Plus className="size-3" />
      </span>
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
        className="h-9 w-full min-w-0 rounded-md border border-transparent bg-transparent px-0 text-sm outline-none transition-colors placeholder:text-muted-foreground/60 focus:border-border/60 focus:bg-muted/30 focus:px-1.5 motion-reduce:transition-none xl:h-7"
      />
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* Follow-up                                                                  */
/* -------------------------------------------------------------------------- */

/** Lateness reads in the tone the rest of the app uses for a slipping date. */
const FOLLOW_UP_TONE = {
  overdue: "text-condition-attention",
  due: "text-brand-accent-text",
} as const;

/**
 * A satellite riding the list's rule: when this Thread should come back, not a
 * deadline on any one Move.
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
  const label =
    followUp === undefined
      ? undefined
      : withTimeToken(format(followUp, "MMM d"), followUp);
  const tone = whenTone(followUp, now);

  return (
    <span className="flex shrink-0 items-center">
      <WhenPopover
        when={followUp}
        busy={isPending}
        hint="A soft date — the Thread comes back to your attention around it. A time orders it within its day."
        onSetWhen={(when) => (when === undefined ? onClear() : onSet(when))}
        trigger={
          <Button
            variant="ghost"
            size="xs"
            disabled={isPending}
            // The Bell already says "follow-up", so the label stays visually
            // to the date alone — the phrase survives as the accessible name.
            aria-label={label ? `Follow up ${label}` : undefined}
            className="h-8 gap-1.5 px-1.5 font-normal xl:h-6"
          >
            <Bell aria-hidden className="size-3 text-muted-foreground/70" />
            {label ? (
              <span
                className={cn(
                  "tabular-nums",
                  tone ? FOLLOW_UP_TONE[tone] : "text-muted-foreground",
                )}
              >
                {label}
              </span>
            ) : (
              <span className="text-muted-foreground">Add a follow-up…</span>
            )}
          </Button>
        }
      />

      {followUp !== undefined && (
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
