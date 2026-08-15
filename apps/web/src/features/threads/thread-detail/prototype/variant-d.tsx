/** PROTOTYPE (issue #280) — Variant D "Deck": upcoming moves stacked behind the Next Move. Throwaway. */
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
import { type FormEvent, type KeyboardEvent, useState } from "react";

import { EditableField } from "@/components/ui/editable-field";
import { cn } from "@/lib/utils";

import type { MockLogEntry, MockUpcomingMove } from "./mock-data";

import { useMockThread } from "./mock-data";

/** How far each card behind the front one peeks out, in pixels. */
const PEEK_STEP = 7;
/** Beyond this the stack stops reading as depth and starts reading as noise. */
const MAX_PEEKS = 3;

/**
 * The Thread as a deck: identity on top, then the Next Move as the front card
 * of a physical stack with the upcoming moves waiting behind it, then the
 * Activity log filling the floor. Completing the front card brings the next
 * one forward — the promotion is the animation, not a re-render.
 */
export function VariantD() {
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
              CONDITION_DOT[area.condition],
            )}
          />
          <span className="truncate text-xs text-muted-foreground">
            {area.name}
          </span>
          <span
            className={cn(
              "flex shrink-0 items-center gap-1.5 text-[11px]",
              thread.state === "resolved"
                ? "text-condition-healthy"
                : "text-muted-foreground",
            )}
          >
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
            onSave={(title) => title && updateThread({ title })}
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

      <Deck
        nextMove={thread.nextMove}
        followUp={thread.followUp}
        upNext={upNext}
        onComplete={completeNextMove}
        onClear={clearNextMove}
        onSetNextMove={setNextMove}
        onAdd={addUpcomingMove}
        onEdit={editUpcomingMove}
        onRemove={removeUpcomingMove}
        onReorder={reorderUpcomingMove}
        onSetFollowUp={setFollowUp}
      />

      <ActivityLog
        log={log}
        lastActivityAt={thread.lastActivityAt}
        onAddNote={addNote}
      />
    </div>
  );
}

const CONDITION_DOT = {
  healthy: "bg-condition-healthy-fill",
  needs_attention: "bg-condition-attention-fill",
  critical: "bg-condition-critical-fill",
} as const;

interface DeckProps {
  nextMove: string | undefined;
  followUp: number | undefined;
  upNext: MockUpcomingMove[];
  onComplete: () => void;
  onClear: () => void;
  onSetNextMove: (text: string) => void;
  onAdd: (text: string) => void;
  onEdit: (id: string, text: string) => void;
  onRemove: (id: string) => void;
  onReorder: (id: string, toIndex: number) => void;
  onSetFollowUp: (timestamp: number | null) => void;
}

/**
 * The stack. Collapsed, the upcoming moves are layered edges under the front
 * card — you read how much is waiting without reading what it is. Fanned open,
 * the same moves become an editable column and the depth ticks carry the order.
 */
function Deck({
  nextMove,
  followUp,
  upNext,
  onComplete,
  onClear,
  onSetNextMove,
  onAdd,
  onEdit,
  onRemove,
  onReorder,
  onSetFollowUp,
}: DeckProps) {
  const [fanned, setFanned] = useState(false);
  const peeks = upNext.slice(0, MAX_PEEKS);
  const hidden = upNext.length - peeks.length;
  const reserve = fanned ? 0 : peeks.length * PEEK_STEP;

  return (
    <section
      aria-label="Next move and Up Next"
      data-slot="deck"
      className="flex shrink-0 flex-col gap-1.5"
    >
      <div className="flex items-center gap-2">
        <h2 className="text-[10px] font-medium tracking-wide text-muted-foreground/80 uppercase">
          Next move
        </h2>
        <span aria-hidden className="h-px flex-1 bg-border/50" />
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={() => setFanned((open) => !open)}
          aria-expanded={fanned}
          className="h-6 gap-1 px-1.5 text-[11px] font-normal text-muted-foreground hover:text-foreground"
        >
          {fanned
            ? "Collapse"
            : upNext.length === 0
              ? "Up Next"
              : `${upNext.length} upcoming`}
          <ChevronDown
            aria-hidden
            className={cn(
              "size-3 transition-transform duration-200 motion-reduce:transition-none",
              fanned && "rotate-180",
            )}
          />
        </Button>
      </div>

      {/* The reserved strip below the front card is where the deck's edges
          show; it collapses to nothing when the deck is fanned open. */}
      <div
        className="relative transition-[padding] duration-300 motion-reduce:transition-none"
        style={{ paddingBottom: reserve }}
      >
        <div className="relative">
          {peeks.map((move, index) => (
            <div
              key={move.id}
              aria-hidden
              className={cn(
                // Cards behind sink toward the app's own ground colour, so the
                // stack recedes the same way in both themes.
                "absolute inset-0 rounded-xl border border-border bg-surface-1",
                "transition-[transform,opacity] duration-300 ease-out motion-reduce:transition-none",
              )}
              style={{
                transform: `translateY(${(index + 1) * PEEK_STEP}px) scaleX(${1 - (index + 1) * 0.03})`,
                opacity: fanned ? 0 : 1 - index * 0.28,
              }}
            />
          ))}

          <FrontCard
            nextMove={nextMove}
            onComplete={onComplete}
            onClear={onClear}
            onSet={onSetNextMove}
          />
        </div>

        {/* Pressing the exposed edges is the deck's own affordance. */}
        {!fanned && peeks.length > 0 && (
          <button
            type="button"
            onClick={() => setFanned(true)}
            className="absolute inset-x-6 bottom-0 rounded-b-xl focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
            style={{ height: reserve }}
          >
            <span className="sr-only">
              Show all {upNext.length} upcoming moves
            </span>
          </button>
        )}
      </div>

      {fanned ? (
        <FannedMoves
          upNext={upNext}
          onAdd={onAdd}
          onEdit={onEdit}
          onRemove={onRemove}
          onReorder={onReorder}
        />
      ) : (
        hidden > 0 && (
          <p className="pl-1 text-[11px] text-muted-foreground/70">
            {hidden} more waiting behind
          </p>
        )
      )}

      <FollowUpSatellite followUp={followUp} onSet={onSetFollowUp} />
    </section>
  );
}

function FrontCard({
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
    // Opaque on purpose: the cards behind must not read through the front one,
    // and `shadow-sm` is what falls onto their exposed edges.
    <div className="group/front relative flex min-h-14 items-center gap-2.5 rounded-xl border border-border bg-card px-3 py-2 shadow-sm">
      {nextMove === undefined ? (
        <>
          <ArrowRight
            aria-hidden
            className="size-3.5 shrink-0 text-muted-foreground/70"
          />
          <NextMoveInput onCommit={onSet} />
        </>
      ) : (
        <>
          <Button
            variant="ghost"
            size="icon-xs"
            onClick={onComplete}
            aria-label="Complete next move"
            className="size-7 shrink-0 rounded-full border border-condition-healthy/40 text-condition-healthy hover:bg-condition-healthy/10 hover:text-condition-healthy"
          >
            <Check />
          </Button>

          {/* Keyed on the text so a promoted move arrives instead of swapping. */}
          <span
            key={nextMove}
            className="min-w-0 flex-1 animate-in fade-in slide-in-from-bottom-1 duration-300 motion-reduce:animate-none"
          >
            <EditableField
              value={nextMove}
              onSave={(text) => text && onSet(text)}
              inputAriaLabel="Next move"
              className="min-h-0 py-0 text-[13px] font-medium leading-snug"
              displayClassName="border-transparent text-left"
            />
          </span>

          <Button
            variant="ghost"
            size="icon-xs"
            onClick={onClear}
            aria-label="Clear next move"
            className="size-7 shrink-0 self-start text-muted-foreground/50 transition-opacity hover:text-destructive xl:opacity-0 xl:group-focus-within/front:opacity-100 xl:group-hover/front:opacity-100"
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
      className="h-8 min-w-0 flex-1 rounded-md border border-transparent bg-transparent px-1 text-[13px] font-medium outline-none transition-colors placeholder:font-normal placeholder:text-muted-foreground/60 focus:ring-1 focus:ring-ring"
    />
  );
}

/**
 * The deck fanned out in place: one row per upcoming move, ordered top to
 * bottom, with the depth tick carrying how far back each one sits.
 */
function FannedMoves({
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
    <div className="flex flex-col gap-1 animate-in fade-in slide-in-from-top-1 duration-200 motion-reduce:animate-none">
      {upNext.length === 0 ? (
        <p className="px-1 py-1 text-[13px] text-muted-foreground">
          Nothing waiting behind the next move yet.
        </p>
      ) : (
        <ul className="flex flex-col">
          {upNext.map((move, index) => (
            <li
              key={move.id}
              className="group/move flex items-center gap-2 rounded-md py-0.5 pr-1 pl-0.5 hover:bg-muted/40"
            >
              <span
                aria-hidden
                className="h-5 w-0.5 shrink-0 rounded-full bg-border"
                style={{ opacity: Math.max(0.3, 1 - index * 0.15) }}
              />
              <span className="min-w-0 flex-1">
                <EditableField
                  value={move.text}
                  onSave={(text) => text && onEdit(move.id, text)}
                  inputAriaLabel={`Upcoming move ${index + 1}`}
                  className="min-h-0 py-1 text-[13px] leading-snug"
                  displayClassName="border-transparent text-left"
                />
              </span>
              <span className="flex shrink-0 items-center transition-opacity xl:opacity-0 xl:group-focus-within/move:opacity-100 xl:group-hover/move:opacity-100">
                <Button
                  variant="ghost"
                  size="icon-xs"
                  onClick={() => onReorder(move.id, index - 1)}
                  disabled={index === 0}
                  aria-label={`Move "${move.text}" earlier`}
                  className="size-6 text-muted-foreground/60 hover:text-foreground disabled:opacity-25"
                >
                  <ChevronUp />
                </Button>
                <Button
                  variant="ghost"
                  size="icon-xs"
                  onClick={() => onReorder(move.id, index + 1)}
                  disabled={index === upNext.length - 1}
                  aria-label={`Move "${move.text}" later`}
                  className="size-6 text-muted-foreground/60 hover:text-foreground disabled:opacity-25"
                >
                  <ChevronDown />
                </Button>
                <Button
                  variant="ghost"
                  size="icon-xs"
                  onClick={() => onRemove(move.id)}
                  aria-label={`Remove "${move.text}"`}
                  className="size-6 text-muted-foreground/50 hover:text-destructive"
                >
                  <X />
                </Button>
              </span>
            </li>
          ))}
        </ul>
      )}

      <AddMoveInput onAdd={onAdd} />
    </div>
  );
}

function AddMoveInput({ onAdd }: { onAdd: (text: string) => void }) {
  const [draft, setDraft] = useState("");

  const commit = () => {
    const text = draft.trim();
    if (!text) return;
    setDraft("");
    onAdd(text);
  };

  return (
    <div className="flex items-center gap-2 pl-0.5">
      <Plus aria-hidden className="size-3 shrink-0 text-muted-foreground/50" />
      <input
        type="text"
        value={draft}
        onChange={(event) => setDraft(event.target.value)}
        onKeyDown={(event) => {
          if (event.key === "Enter") {
            event.preventDefault();
            commit();
          }
        }}
        onBlur={commit}
        aria-label="Add an upcoming move"
        placeholder="Add an upcoming move…"
        className="h-8 min-w-0 flex-1 rounded-md border border-transparent bg-transparent px-1 text-[13px] outline-none transition-colors placeholder:text-muted-foreground/60 focus:ring-1 focus:ring-ring"
      />
    </div>
  );
}

/** The soft resurfacing date, tucked under the deck's corner. */
function FollowUpSatellite({
  followUp,
  onSet,
}: {
  followUp: number | undefined;
  onSet: (timestamp: number | null) => void;
}) {
  const [open, setOpen] = useState(false);
  const selected = followUp === undefined ? undefined : new Date(followUp);
  const isOverdue = followUp !== undefined && followUp < Date.now();

  return (
    <div className="flex items-center justify-end gap-0.5 pt-0.5">
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger
          render={
            <Button
              variant="ghost"
              size="sm"
              className="h-6 gap-1.5 px-1.5 text-[11px] font-normal"
            />
          }
        >
          <Bell aria-hidden className="size-3 text-muted-foreground/70" />
          {selected ? (
            <>
              <span className="text-muted-foreground">Resurfaces</span>
              <span
                className={cn(
                  "tabular-nums",
                  isOverdue
                    ? "text-condition-attention"
                    : "text-brand-accent-foreground",
                )}
              >
                {format(selected, "MMM d, yyyy")}
              </span>
            </>
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
          className="size-6 shrink-0 text-muted-foreground/50 hover:text-destructive"
        >
          <X />
        </Button>
      )}
    </div>
  );
}

const LOG_ICONS = {
  next_action_change: ArrowRight,
  state_change: CircleCheck,
  follow_up_change: Bell,
  area_move: MapPin,
} as const;

/** The Thread's continuity record: the only scrolling region in the pane. */
function ActivityLog({
  log,
  lastActivityAt,
  onAddNote,
}: {
  log: MockLogEntry[];
  lastActivityAt: number;
  onAddNote: (content: string) => void;
}) {
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

      <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain">
        <div className="relative pb-6">
          <div
            aria-hidden
            className="absolute top-1 bottom-0 left-[11px] w-px bg-gradient-to-b from-transparent via-border to-transparent"
          />

          <div className="relative pb-4 pl-9">
            <span
              aria-hidden
              className="absolute top-0.5 left-[11.5px] size-2.5 -translate-x-1/2 rounded-full border border-(--brand-gold) bg-background"
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
                <div className="pb-1.5 pl-9">
                  <h3 className="text-[10px] font-medium tracking-wide text-muted-foreground/80 uppercase">
                    {group.label}
                  </h3>
                </div>
                {group.entries.map((entry) =>
                  entry.type === "note" ? (
                    <NoteEntry key={entry.id} entry={entry} />
                  ) : (
                    <ChangeEntry key={entry.id} entry={entry} />
                  ),
                )}
              </section>
            ))}
          </div>
        </div>
      </div>

      <NoteComposer onAddNote={onAddNote} />
    </section>
  );
}

function NoteEntry({ entry }: { entry: MockLogEntry }) {
  return (
    <div className="relative py-1.5 pl-9">
      <span
        aria-hidden
        className="absolute top-4 left-[11.5px] size-2.5 -translate-x-1/2 rounded-full border border-(--brand-gold)/60 bg-(--brand-gold) ring-2 ring-background"
      />
      <div className="rounded-md border border-border bg-muted/40 px-3 py-2">
        <div className="mb-1 flex items-baseline justify-between gap-2">
          <span className="text-[10px] font-medium tracking-wide text-(--brand-gold) uppercase">
            Note
          </span>
          <LogTime createdAt={entry.createdAt} />
        </div>
        <p className="whitespace-pre-wrap text-[13px] leading-snug text-foreground">
          {entry.content}
        </p>
      </div>
    </div>
  );
}

function ChangeEntry({ entry }: { entry: MockLogEntry }) {
  const Icon = LOG_ICONS[entry.type as keyof typeof LOG_ICONS] ?? ArrowRight;

  return (
    <div className="relative py-1 pl-9">
      <span
        aria-hidden
        className="absolute top-[9px] left-[11.5px] size-1.5 -translate-x-1/2 rounded-full border border-muted-foreground/40 bg-background"
      />
      <div className="flex min-w-0 items-center gap-1.5 text-xs text-muted-foreground">
        <Icon className="size-3.5 shrink-0 text-muted-foreground/60" />
        <span className="shrink-0 font-medium">{entry.content}</span>
        <span className="truncate text-muted-foreground/80">
          {changeSummary(entry)}
        </span>
        <span className="ml-auto shrink-0 pl-2">
          <LogTime createdAt={entry.createdAt} />
        </span>
      </div>
    </div>
  );
}

function LogTime({ createdAt }: { createdAt: number }) {
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

function NoteComposer({ onAddNote }: { onAddNote: (content: string) => void }) {
  const [text, setText] = useState("");

  const submit = () => {
    const trimmed = text.trim();
    if (!trimmed) return;
    setText("");
    onAddNote(trimmed);
  };

  const handleSubmit = (event: FormEvent) => {
    event.preventDefault();
    submit();
  };

  const handleKeyDown = (event: KeyboardEvent<HTMLTextAreaElement>) => {
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      submit();
    }
  };

  return (
    <div className="relative shrink-0 pt-2">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-0 -top-4 h-6 bg-gradient-to-t from-popover to-transparent"
      />
      <form onSubmit={handleSubmit}>
        <label htmlFor="variant-d-note" className="sr-only">
          Activity log note
        </label>
        <InputGroup className="bg-muted/50 has-[textarea]:rounded-3xl has-data-[align=block-end]:rounded-3xl">
          <InputGroupTextarea
            id="variant-d-note"
            value={text}
            onChange={(event) => setText(event.target.value)}
            onKeyDown={handleKeyDown}
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
              disabled={!text.trim()}
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

function groupByDay(log: MockLogEntry[]) {
  const groups = new Map<string, MockLogEntry[]>();

  for (const entry of [...log].sort((a, b) => b.createdAt - a.createdAt)) {
    const key = format(new Date(entry.createdAt), "yyyy-MM-dd");
    const group = groups.get(key) ?? [];
    group.push(entry);
    groups.set(key, group);
  }

  return [...groups.entries()].map(([key, entries]) => ({
    key,
    label: dayLabel(entries[0]!.createdAt),
    entries,
  }));
}

function dayLabel(createdAt: number) {
  const date = new Date(createdAt);
  if (isToday(date)) return "Today";
  if (isYesterday(date)) return "Yesterday";
  return format(date, "MMMM d, yyyy");
}

function changeSummary(entry: MockLogEntry) {
  if (entry.previousValue && entry.newValue) {
    return `${entry.previousValue} → ${entry.newValue}`;
  }
  if (entry.newValue) return `Set to ${entry.newValue}`;
  if (entry.previousValue) return entry.previousValue;
  return "";
}
