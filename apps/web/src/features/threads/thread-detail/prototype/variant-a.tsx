/** PROTOTYPE (issue #280) — Variant A "Runway": attention-first stack. Throwaway. */
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
import { format, formatDistanceToNow } from "date-fns";
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
import { useState } from "react";

import { EditableField } from "@/components/ui/editable-field";
import { conditionDotClassName } from "@/features/areas/condition-presentation";
import { whenTone } from "@/features/attention-list";
import { cn } from "@/lib/utils";

import type { MockLogEntry, MockUpcomingMove } from "./mock-data";

import { useMockThread } from "./mock-data";

/**
 * Runway: the pane leads with what to do. Identity is compressed to a caption
 * and a title, the Next Move takes the hero slot, and the upcoming moves run
 * down a rail that visibly feeds back up into it. History trails off underneath.
 */
export function VariantA() {
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
    <div className="flex min-h-0 flex-1 flex-col gap-3">
      <header
        role="banner"
        aria-label="Thread header"
        className="flex shrink-0 flex-col gap-1"
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
          <span className="min-w-0 truncate text-xs text-muted-foreground">
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
      </header>

      <NowZone
        nextMove={thread.nextMove}
        followUp={thread.followUp}
        now={now}
        onComplete={completeNextMove}
        onClear={clearNextMove}
        onSet={setNextMove}
        onSetFollowUp={setFollowUp}
      />

      {/* The only scrolling region: the runway first, the record behind it. */}
      <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain">
        <Runway
          moves={upNext}
          onAdd={addUpcomingMove}
          onEdit={editUpcomingMove}
          onRemove={removeUpcomingMove}
          onReorder={reorderUpcomingMove}
        />
        <ActivityLogPanel log={log} />
      </div>

      <NoteComposer onAddNote={addNote} />
    </div>
  );
}

/* ------------------------------------------------------------------ hero -- */

/** Lateness reads in the tone the rest of the app uses for a slipping date. */
const FOLLOW_UP_TONE = {
  overdue: "text-condition-attention",
  due: "text-brand-accent-foreground",
} as const;

function NowZone({
  nextMove,
  followUp,
  now,
  onComplete,
  onClear,
  onSet,
  onSetFollowUp,
}: {
  nextMove: string | undefined;
  followUp: number | undefined;
  now: number;
  onComplete: () => void;
  onClear: () => void;
  onSet: (text: string) => void;
  onSetFollowUp: (timestamp: number | null) => void;
}) {
  return (
    <section
      aria-label="Next move"
      data-slot="runway-now"
      className="group/now shrink-0 rounded-xl border border-(--brand-gold)/60 bg-muted/40 px-3.5 pt-2.5 pb-2"
    >
      <span className="text-[10px] font-medium tracking-wide text-brand-accent-foreground uppercase">
        Next move
      </span>

      {nextMove === undefined ? (
        <NextMoveInput onCommit={onSet} />
      ) : (
        <div className="mt-1 flex items-start gap-2.5">
          <Button
            variant="ghost"
            size="icon-sm"
            onClick={onComplete}
            aria-label="Complete next move"
            className="mt-px shrink-0 rounded-full border border-condition-healthy/40 text-condition-healthy hover:bg-condition-healthy/10 hover:text-condition-healthy"
          >
            <Check className="size-4" />
          </Button>

          {/* Keyed on the text: a promotion remounts the field, so the move
              that just arrived rises into the slot instead of swapping. */}
          <span className="min-w-0 flex-1">
            <EditableField
              key={nextMove}
              value={nextMove}
              onSave={(text) => text && onSet(text)}
              inputAriaLabel="Next move"
              className="min-h-0 py-1 text-[15px] leading-snug font-medium"
              displayClassName="border-transparent whitespace-pre-wrap animate-in fade-in slide-in-from-bottom-2 duration-300 motion-reduce:animate-none"
            />
          </span>

          <Button
            variant="ghost"
            size="icon-xs"
            onClick={onClear}
            aria-label="Clear next move"
            className="mt-1 shrink-0 text-muted-foreground/50 transition-opacity hover:text-destructive motion-reduce:transition-none xl:opacity-0 xl:group-focus-within/now:opacity-100 xl:group-hover/now:opacity-100"
          >
            <X />
          </Button>
        </div>
      )}

      <FollowUpSatellite followUp={followUp} now={now} onSet={onSetFollowUp} />
    </section>
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
      className="mt-1 h-9 w-full min-w-0 rounded-md border border-border/60 bg-background/40 px-2.5 text-[15px] outline-none transition-colors placeholder:text-muted-foreground/60 focus:border-ring"
    />
  );
}

/** The date is a satellite, not a deadline: it sits under the move, quietly. */
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
    <div className="mt-1.5 flex items-center gap-1 border-t border-border/50 pt-1.5 pl-[2.625rem]">
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger
          render={
            <Button
              variant="ghost"
              size="xs"
              className="-ml-2 gap-1.5 px-2 font-normal text-muted-foreground"
            />
          }
        >
          <Bell aria-hidden className="size-3 text-muted-foreground/70" />
          {selected ? (
            <>
              <span>Follow-up</span>
              <span
                className={cn(
                  "tabular-nums",
                  tone ? FOLLOW_UP_TONE[tone] : "text-foreground",
                )}
              >
                {format(selected, "MMM d")}
              </span>
              <span className="text-muted-foreground/60">
                · {formatDistanceToNow(selected, { addSuffix: true })}
              </span>
            </>
          ) : (
            <span>Add a follow-up…</span>
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
          className="shrink-0 text-muted-foreground/50 hover:text-destructive"
        >
          <X />
        </Button>
      )}
    </div>
  );
}

/* ---------------------------------------------------------------- runway -- */

// Rail geometry matches the Activity log's: the 1px line spans left 11–12px,
// so markers sit at 11.5px with -translate-x-1/2 and bodies clear it at pl-9.
const RAIL_LEFT = "left-[11px]";
const NODE_LEFT = "left-[11.5px]";

/** Distance from the slot reads as distance from full ink. */
const RUNWAY_TONE = [
  "text-foreground",
  "text-foreground/85",
  "text-muted-foreground",
  "text-muted-foreground/75",
];

function Runway({
  moves,
  onAdd,
  onEdit,
  onRemove,
  onReorder,
}: {
  moves: MockUpcomingMove[];
  onAdd: (text: string) => void;
  onEdit: (id: string, text: string) => void;
  onRemove: (id: string) => void;
  onReorder: (id: string, toIndex: number) => void;
}) {
  return (
    <section aria-label="Up Next" className="flex flex-col">
      <div className="sticky top-0 z-10 flex items-center gap-2 bg-popover pb-1.5">
        <h2 className="font-heading text-sm font-semibold tracking-tight">
          Up Next
        </h2>
        {moves.length > 0 && (
          <span className="rounded-full bg-surface-3 px-2 py-0.5 text-[11px] font-medium tabular-nums text-muted-foreground">
            {moves.length}
          </span>
        )}
        <span aria-hidden className="ml-1 h-px flex-1 bg-border/50" />
        <span className="text-[10px] font-medium tracking-wide text-muted-foreground/60 uppercase">
          In order
        </span>
      </div>

      <div className="relative pt-3">
        {/* The rail feeds upward: gold where it meets the slot, fading with
            distance. The caret is the only thing that states the direction. */}
        <ChevronUp
          aria-hidden
          className={cn(
            "absolute top-0 size-3 -translate-x-1/2 text-brand-accent-foreground/70",
            NODE_LEFT,
          )}
        />
        {moves.length > 0 && (
          <div
            aria-hidden
            className={cn(
              "absolute top-3 bottom-1 w-px bg-gradient-to-b from-(--brand-gold) via-border to-border/20",
              RAIL_LEFT,
            )}
          />
        )}

        {moves.length === 0 ? (
          <p className="pl-9 text-[13px] leading-snug text-muted-foreground">
            Nothing behind this move yet. Add what comes after it.
          </p>
        ) : (
          <ol className="flex flex-col">
            {moves.map((move, index) => (
              <RunwayRow
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

        <AddUpcomingMove onAdd={onAdd} />
      </div>
    </section>
  );
}

function RunwayRow({
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
        "group/move relative flex min-h-8 items-center gap-0.5 pl-9 transition-colors duration-300 motion-reduce:transition-none",
        RUNWAY_TONE[Math.min(index, RUNWAY_TONE.length - 1)],
      )}
    >
      <span
        aria-hidden
        className={cn(
          "absolute top-2 flex size-4 -translate-x-1/2 items-center justify-center rounded-full border bg-popover text-[9px] font-medium tabular-nums",
          NODE_LEFT,
          index === 0
            ? "border-(--brand-gold)/60 text-brand-accent-foreground"
            : "border-border text-muted-foreground/70",
        )}
      >
        {index + 1}
      </span>

      <span className="min-w-0 flex-1">
        <EditableField
          value={move.text}
          onSave={(text) => text && onEdit(move.id, text)}
          inputAriaLabel="Upcoming move"
          className="min-h-0 py-1 text-[13px] leading-snug"
          displayClassName="border-transparent"
        />
      </span>

      <span className="flex shrink-0 items-center transition-opacity motion-reduce:transition-none xl:opacity-0 xl:group-focus-within/move:opacity-100 xl:group-hover/move:opacity-100">
        <Button
          variant="ghost"
          size="icon-xs"
          disabled={index === 0}
          onClick={() => onReorder(move.id, index - 1)}
          aria-label="Move up"
          className="text-muted-foreground/60 hover:text-foreground"
        >
          <ChevronUp />
        </Button>
        <Button
          variant="ghost"
          size="icon-xs"
          disabled={isLast}
          onClick={() => onReorder(move.id, index + 1)}
          aria-label="Move down"
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

function AddUpcomingMove({ onAdd }: { onAdd: (text: string) => void }) {
  const [draft, setDraft] = useState("");

  const commit = () => {
    const text = draft.trim();
    if (!text) return;
    setDraft("");
    onAdd(text);
  };

  return (
    <div className="relative pt-1 pl-9">
      <span
        aria-hidden
        className={cn(
          "absolute top-3 flex size-4 -translate-x-1/2 items-center justify-center rounded-full border border-dashed border-border bg-popover text-muted-foreground/70",
          NODE_LEFT,
        )}
      >
        <Plus className="size-2.5" />
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
        }}
        aria-label="Add an upcoming move"
        placeholder="Add an upcoming move…"
        className="h-8 w-full min-w-0 rounded-md border border-transparent bg-transparent px-1 text-[13px] outline-none transition-colors placeholder:text-muted-foreground/60 focus:border-border/60 focus:bg-muted/30"
      />
    </div>
  );
}

/* ------------------------------------------------------------------- log -- */

const LOG_ICONS: Record<Exclude<MockLogEntry["type"], "note">, LucideIcon> = {
  next_action_change: ArrowRight,
  state_change: CircleCheck,
  follow_up_change: Bell,
  area_move: MapPin,
};

function ActivityLogPanel({ log }: { log: MockLogEntry[] }) {
  return (
    <section aria-label="Activity log" className="mt-6 flex flex-col">
      <div className="sticky top-0 z-10 flex items-center gap-2 bg-popover pt-1 pb-1.5">
        <h2 className="font-heading text-sm font-semibold tracking-tight text-muted-foreground">
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

      <div className="flex flex-col gap-1.5 pb-4">
        {log.map((entry) =>
          entry.type === "note" ? (
            <LogNote key={entry.id} entry={entry} />
          ) : (
            <LogChange key={entry.id} entry={entry} />
          ),
        )}
      </div>
    </section>
  );
}

function LogNote({ entry }: { entry: MockLogEntry }) {
  return (
    <div className="rounded-md border border-border bg-muted/40 px-3 py-2">
      <div className="mb-1 flex items-baseline justify-between gap-2">
        <span className="text-[10px] font-medium tracking-wide text-(--brand-gold) uppercase">
          Note
        </span>
        <LogTimestamp createdAt={entry.createdAt} />
      </div>
      <p className="text-[13px] leading-snug whitespace-pre-wrap text-foreground/90">
        {entry.content}
      </p>
    </div>
  );
}

function LogChange({ entry }: { entry: MockLogEntry }) {
  const Icon = LOG_ICONS[entry.type as Exclude<MockLogEntry["type"], "note">];
  const summary =
    entry.previousValue && entry.newValue
      ? `${entry.previousValue} → ${entry.newValue}`
      : (entry.newValue ?? entry.previousValue ?? "");

  return (
    <div className="flex min-w-0 items-center gap-1.5 px-1 text-xs text-muted-foreground">
      <Icon
        aria-hidden
        className="size-3.5 shrink-0 text-muted-foreground/60"
      />
      <span className="shrink-0 font-medium">{entry.content}</span>
      <span className="truncate text-muted-foreground/80">{summary}</span>
      <span className="ml-auto shrink-0 pl-2">
        <LogTimestamp createdAt={entry.createdAt} />
      </span>
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
      {format(date, "MMM d, h:mm a")}
    </time>
  );
}

function NoteComposer({ onAddNote }: { onAddNote: (text: string) => void }) {
  const [draft, setDraft] = useState("");

  const submit = () => {
    const text = draft.trim();
    if (!text) return;
    setDraft("");
    onAddNote(text);
  };

  return (
    <div className="relative shrink-0 pt-2">
      {/* Fade the scrolled record out from under the bar. */}
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
        <label htmlFor="variant-a-note" className="sr-only">
          Activity log note
        </label>
        <InputGroup className="bg-muted/50 has-[textarea]:rounded-3xl has-data-[align=block-end]:rounded-3xl">
          <InputGroupTextarea
            id="variant-a-note"
            value={draft}
            onChange={(event) => setDraft(event.target.value)}
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
              disabled={!draft.trim()}
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
