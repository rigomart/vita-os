import { Button } from "@vita-os/ui/components/button";
import { Calendar } from "@vita-os/ui/components/calendar";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@vita-os/ui/components/popover";
import { format } from "date-fns";
import { ArrowRight, Bell, Check, X } from "lucide-react";
import { useState } from "react";

import { EditableField } from "@/components/ui/editable-field";
import { whenTone } from "@/features/attention-list";
import { cn } from "@/lib/utils";

export interface ThreadAttentionPending {
  set?: boolean;
  clear?: boolean;
  complete?: boolean;
  followUp?: boolean;
}

interface ThreadAttentionBarProps {
  nextMove: string | undefined;
  followUp: number | undefined;
  /** The shared attention clock, so lateness matches every other surface. */
  now: number;
  onSetNextMove: (text: string) => void;
  onClearNextMove: () => void;
  onCompleteNextMove: () => void;
  onSetFollowUp: (date: number) => void;
  onClearFollowUp: () => void;
  pending?: ThreadAttentionPending;
}

/**
 * The Thread's whole attention state on one strip: what happens next and when
 * it comes back. Nothing here is behind a disclosure — reading it costs no
 * interaction, only editing does.
 *
 * `xl` is the Thread pane's breakpoint (THREAD_PANE_BREAKPOINT): from there up
 * the pane is a rail and the strip is one line; below it the Thread is a bottom
 * drawer, so the two controls stack into full-width rows.
 */
export function ThreadAttentionBar({
  nextMove,
  followUp,
  now,
  onSetNextMove,
  onClearNextMove,
  onCompleteNextMove,
  onSetFollowUp,
  onClearFollowUp,
  pending,
}: ThreadAttentionBarProps) {
  return (
    <section
      role="region"
      aria-label="Thread attention"
      data-slot="thread-attention-bar"
      className="flex shrink-0 flex-col gap-1.5 xl:flex-row xl:items-center xl:gap-2"
    >
      <NextMoveLine
        nextMove={nextMove}
        onSet={onSetNextMove}
        onClear={onClearNextMove}
        onComplete={onCompleteNextMove}
        pending={pending}
      />

      <span
        aria-hidden
        className="hidden h-3.5 w-px shrink-0 bg-border/60 xl:block"
      />

      <FollowUpControl
        followUp={followUp}
        now={now}
        onSet={onSetFollowUp}
        onClear={onClearFollowUp}
        isPending={pending?.followUp}
      />
    </section>
  );
}

function NextMoveLine({
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
    <div className="group/next-move flex min-h-9 min-w-0 items-center gap-2 xl:min-h-8 xl:flex-1">
      <ArrowRight
        aria-hidden
        className="size-3.5 shrink-0 text-muted-foreground/70"
      />

      {nextMove === undefined ? (
        <NextMoveInput disabled={pending?.set} onCommit={onSet} />
      ) : (
        <>
          <Button
            variant="ghost"
            size="icon-xs"
            onClick={onComplete}
            disabled={pending?.complete}
            aria-busy={pending?.complete}
            aria-label="Complete next move"
            className="size-8 rounded-full border border-condition-healthy/40 text-condition-healthy hover:bg-condition-healthy/10 hover:text-condition-healthy xl:size-6"
          >
            <Check />
          </Button>

          {/* EditableField fills its parent, so the line constrains it. */}
          <span className="min-w-0 flex-1">
            <EditableField
              value={nextMove}
              onSave={(text) => {
                if (!text || pending?.set) return;
                onSet(text);
              }}
              disabled={pending?.set}
              inputAriaLabel="Next move"
              className="min-h-0 py-1 text-[13px] font-medium xl:py-0"
              displayClassName="block truncate border-transparent text-left"
            />
          </span>

          {/* Always reachable on touch; a quiet hover affordance on the rail. */}
          <Button
            variant="ghost"
            size="icon-xs"
            onClick={onClear}
            disabled={pending?.clear}
            aria-busy={pending?.clear}
            aria-label="Clear next move"
            className="size-8 shrink-0 text-muted-foreground/50 transition-opacity hover:text-destructive xl:size-6 xl:opacity-0 xl:group-focus-within/next-move:opacity-100 xl:group-hover/next-move:opacity-100"
          >
            <X />
          </Button>
        </>
      )}
    </div>
  );
}

function NextMoveInput({
  disabled,
  onCommit,
}: {
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
      aria-label="Next move"
      placeholder="Set the next move…"
      className="h-9 min-w-0 flex-1 rounded-md border border-border/60 bg-muted/30 px-2.5 text-[13px] outline-none transition-colors placeholder:text-muted-foreground/60 focus:border-ring focus:bg-transparent disabled:opacity-50 xl:h-7 xl:border-transparent xl:bg-transparent xl:px-1 xl:focus:ring-1 xl:focus:ring-ring"
    />
  );
}

/** Lateness reads in the tone the rest of the app uses for a slipping date. */
const FOLLOW_UP_TONE = {
  overdue: "text-condition-attention",
  due: "text-brand-accent-foreground",
} as const;

function FollowUpControl({
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
    <div className="flex min-h-9 items-center gap-1 xl:min-h-8 xl:shrink-0">
      <Popover open={open} onOpenChange={isPending ? undefined : setOpen}>
        <PopoverTrigger
          render={
            <Button
              variant="ghost"
              size="sm"
              disabled={isPending}
              className="h-9 w-full justify-start gap-2 px-2 text-[13px] font-normal xl:h-7 xl:w-auto xl:gap-1.5 xl:text-xs"
            />
          }
        >
          <Bell aria-hidden className="size-3.5 text-muted-foreground/70" />
          {selected ? (
            <>
              {/* Visible only when stacked, but always named for a reader. */}
              <span className="text-muted-foreground xl:sr-only">
                Follow-up
              </span>
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
          className="size-8 shrink-0 text-muted-foreground/50 hover:text-destructive xl:size-6"
        >
          <X />
        </Button>
      )}
    </div>
  );
}
