/** PROTOTYPE (issue #280) — Variant B "Journal & Dock": journal-first with a collapsible Up Next dock. Throwaway. */
import type { LucideIcon } from "lucide-react";

import { Button } from "@vita-os/ui/components/button";
import { Calendar } from "@vita-os/ui/components/calendar";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@vita-os/ui/components/collapsible";
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
  ChevronRight,
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
 * The production pane's soul, unchanged: identity, one attention line, and the
 * Activity log filling the body under a pinned composer. Up Next is a dock —
 * a hairline handle under the attention line that unfolds a forward-running
 * rail, the mirror image of the log's backward one. Collapsed by default, so
 * the journal keeps its space until you ask about what comes after.
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

  const [dockOpen, setDockOpen] = useState(false);
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

      <AttentionBar
        nextMove={thread.nextMove}
        followUp={thread.followUp}
        now={now}
        onSetNextMove={setNextMove}
        onClearNextMove={clearNextMove}
        onCompleteNextMove={completeNextMove}
        onSetFollowUp={setFollowUp}
      />

      <UpNextDock
        open={dockOpen}
        onOpenChange={setDockOpen}
        upNext={upNext}
        onAdd={addUpcomingMove}
        onEdit={editUpcomingMove}
        onRemove={removeUpcomingMove}
        onReorder={reorderUpcomingMove}
      />

      <ActivityLog
        log={log}
        lastActivityAt={thread.lastActivityAt}
        onAddNote={addNote}
      />
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Attention                                                           */
/* ------------------------------------------------------------------ */

const FOLLOW_UP_TONE = {
  overdue: "text-condition-attention",
  due: "text-brand-accent-foreground",
} as const;

function AttentionBar({
  nextMove,
  followUp,
  now,
  onSetNextMove,
  onClearNextMove,
  onCompleteNextMove,
  onSetFollowUp,
}: {
  nextMove: string | undefined;
  followUp: number | undefined;
  now: number;
  onSetNextMove: (text: string) => void;
  onClearNextMove: () => void;
  onCompleteNextMove: () => void;
  onSetFollowUp: (timestamp: number | null) => void;
}) {
  return (
    <section
      role="region"
      aria-label="Thread attention"
      className="-mt-1 flex shrink-0 flex-col gap-1.5 xl:flex-row xl:items-center xl:gap-2"
    >
      <div className="group/next-move flex min-h-9 min-w-0 items-center gap-2 xl:min-h-8 xl:flex-1">
        <ArrowRight
          aria-hidden
          className="size-3.5 shrink-0 text-muted-foreground/70"
        />

        {nextMove === undefined ? (
          <CommitInput
            ariaLabel="Next move"
            placeholder="Set the next move…"
            onCommit={onSetNextMove}
          />
        ) : (
          <>
            <Button
              variant="ghost"
              size="icon-xs"
              onClick={onCompleteNextMove}
              aria-label="Complete next move"
              className="size-8 rounded-full border border-condition-healthy/40 text-condition-healthy hover:bg-condition-healthy/10 hover:text-condition-healthy xl:size-6"
            >
              <Check />
            </Button>

            <span className="min-w-0 flex-1">
              <EditableField
                value={nextMove}
                onSave={(text) => {
                  if (text) onSetNextMove(text);
                }}
                inputAriaLabel="Next move"
                className="min-h-0 py-1 text-[13px] font-medium xl:py-0"
                displayClassName="block truncate border-transparent text-left"
              />
            </span>

            <Button
              variant="ghost"
              size="icon-xs"
              onClick={onClearNextMove}
              aria-label="Clear next move"
              className="size-8 shrink-0 text-muted-foreground/50 transition-opacity hover:text-destructive motion-reduce:transition-none xl:size-6 xl:opacity-0 xl:group-focus-within/next-move:opacity-100 xl:group-hover/next-move:opacity-100"
            >
              <X />
            </Button>
          </>
        )}
      </div>

      <span
        aria-hidden
        className="hidden h-3.5 w-px shrink-0 bg-border/60 xl:block"
      />

      <FollowUpControl
        followUp={followUp}
        now={now}
        onSet={(timestamp) => onSetFollowUp(timestamp)}
        onClear={() => onSetFollowUp(null)}
      />
    </section>
  );
}

function FollowUpControl({
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
    <div className="flex min-h-9 items-center gap-1 xl:min-h-8 xl:shrink-0">
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger
          render={
            <Button
              variant="ghost"
              size="sm"
              className="h-9 w-full justify-start gap-2 px-2 text-[13px] font-normal xl:h-7 xl:w-auto xl:gap-1.5 xl:text-xs"
            />
          }
        >
          <Bell aria-hidden className="size-3.5 text-muted-foreground/70" />
          {selected ? (
            <>
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
          className="size-8 shrink-0 text-muted-foreground/50 hover:text-destructive xl:size-6"
        >
          <X />
        </Button>
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Up Next dock                                                        */
/* ------------------------------------------------------------------ */

// Dock rail geometry, tuned tighter than the log's so the narrow pane keeps
// its measure. The rail runs down the left of the moves; nodes centre on it.
const DOCK_RAIL_LEFT = "left-[7px]";
const DOCK_NODE_LEFT = "left-[7.5px]";
const DOCK_ROW_PAD = "pl-6";

/**
 * The dock: a hairline handle that reads without opening — how many moves are
 * waiting and which one fills the slot next — and unfolds into the ordered
 * list when asked. Closed, it costs one line; open, the journal keeps the rest.
 */
function UpNextDock({
  open,
  onOpenChange,
  upNext,
  onAdd,
  onEdit,
  onRemove,
  onReorder,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  upNext: MockUpcomingMove[];
  onAdd: (text: string) => void;
  onEdit: (id: string, text: string) => void;
  onRemove: (id: string) => void;
  onReorder: (id: string, toIndex: number) => void;
}) {
  const front = upNext[0];

  return (
    <Collapsible
      open={open}
      onOpenChange={onOpenChange}
      className="-mt-2 shrink-0"
    >
      <h2 className="flex">
        <CollapsibleTrigger className="group/dock -mx-2 flex w-full min-w-0 items-center gap-2 rounded-md px-2 py-1 text-left outline-none transition-colors hover:bg-muted/50 focus-visible:ring-3 focus-visible:ring-ring/30 motion-reduce:transition-none">
          <ChevronRight
            aria-hidden
            className="size-3.5 shrink-0 text-muted-foreground/60 transition-transform group-data-[state=open]/dock:rotate-90 motion-reduce:transition-none"
          />
          <span className="shrink-0 text-[10px] font-medium tracking-wide text-muted-foreground/80 uppercase">
            Up Next
          </span>
          {upNext.length > 0 && (
            <span className="shrink-0 rounded-full bg-surface-3 px-1.5 py-0.5 text-[10px] font-medium tabular-nums text-muted-foreground">
              {upNext.length}
            </span>
          )}
          {front ? (
            <span className="min-w-0 flex-1 truncate text-xs text-muted-foreground/70 transition-opacity group-data-[state=open]/dock:opacity-0 motion-reduce:transition-none">
              then: {front.text}
            </span>
          ) : (
            <span className="min-w-0 flex-1 truncate text-xs text-muted-foreground/60">
              Nothing waiting
            </span>
          )}
        </CollapsibleTrigger>
      </h2>

      {/* No panel animation: matches the app's other collapsibles, which snap. */}
      <CollapsibleContent>
        <div className="mt-1.5 rounded-lg border border-border/60 bg-muted/30 px-2.5 py-2">
          {upNext.length === 0 ? (
            <p className="px-1 pb-1.5 text-[13px] leading-snug text-muted-foreground">
              Nothing waiting behind the next move. Add what comes after it and
              it will fill the slot when this one is done.
            </p>
          ) : (
            <div className="relative pb-1">
              <div
                aria-hidden
                className={cn(
                  "absolute top-3 bottom-3 w-px",
                  DOCK_RAIL_LEFT,
                  "bg-gradient-to-b from-border to-transparent",
                )}
              />
              <ol className="flex flex-col">
                {upNext.map((move, index) => (
                  <UpcomingMoveRow
                    key={move.id}
                    move={move}
                    index={index}
                    isLast={index === upNext.length - 1}
                    onEdit={onEdit}
                    onRemove={onRemove}
                    onReorder={onReorder}
                  />
                ))}
              </ol>
            </div>
          )}

          <div className={cn("flex items-center gap-2 pt-1", DOCK_ROW_PAD)}>
            <Plus aria-hidden className="size-3.5 text-muted-foreground/60" />
            <CommitInput
              ariaLabel="New upcoming move"
              placeholder="Add an upcoming move…"
              onCommit={onAdd}
              clearOnCommit
            />
          </div>
        </div>
      </CollapsibleContent>
    </Collapsible>
  );
}

/**
 * One waiting move. The front one is stated in full weight with a gold node —
 * it is the one that fills the slot next; the rest sit quieter behind it.
 */
function UpcomingMoveRow({
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
  const isFront = index === 0;

  return (
    <li
      className={cn(
        "group/move relative flex min-w-0 items-center gap-1 py-0.5",
        DOCK_ROW_PAD,
      )}
    >
      <span
        aria-hidden
        className={cn(
          "absolute top-1/2 size-2 -translate-x-1/2 -translate-y-1/2 rounded-full",
          DOCK_NODE_LEFT,
          isFront
            ? "border border-(--brand-gold)/60 bg-(--brand-gold)"
            : "border border-muted-foreground/40 bg-background",
        )}
      />

      <span className="min-w-0 flex-1">
        <EditableField
          value={move.text}
          onSave={(text) => {
            if (text) onEdit(move.id, text);
          }}
          inputAriaLabel="Upcoming move"
          className={cn(
            "min-h-0 py-0.5 text-[13px] leading-snug",
            isFront ? "text-foreground" : "text-muted-foreground",
          )}
          displayClassName="block truncate border-transparent text-left"
        />
      </span>

      <span className="flex shrink-0 items-center opacity-100 transition-opacity motion-reduce:transition-none xl:opacity-0 xl:group-focus-within/move:opacity-100 xl:group-hover/move:opacity-100">
        <Button
          variant="ghost"
          size="icon-xs"
          disabled={isFront}
          onClick={() => onReorder(move.id, index - 1)}
          aria-label="Move earlier"
          className="size-6 text-muted-foreground/60 hover:text-foreground"
        >
          <ChevronUp />
        </Button>
        <Button
          variant="ghost"
          size="icon-xs"
          disabled={isLast}
          onClick={() => onReorder(move.id, index + 1)}
          aria-label="Move later"
          className="size-6 text-muted-foreground/60 hover:text-foreground"
        >
          <ChevronDown />
        </Button>
        <Button
          variant="ghost"
          size="icon-xs"
          onClick={() => onRemove(move.id)}
          aria-label="Remove upcoming move"
          className="size-6 text-muted-foreground/50 hover:text-destructive"
        >
          <X />
        </Button>
      </span>
    </li>
  );
}

/** Shared one-line committer: Enter or blur commits, Escape abandons. */
function CommitInput({
  ariaLabel,
  placeholder,
  onCommit,
  clearOnCommit = false,
}: {
  ariaLabel: string;
  placeholder: string;
  onCommit: (text: string) => void;
  clearOnCommit?: boolean;
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
      onBlur={clearOnCommit ? undefined : commit}
      onKeyDown={(event) => {
        if (event.key === "Enter") {
          event.preventDefault();
          commit();
        }
        if (event.key === "Escape") setDraft("");
      }}
      aria-label={ariaLabel}
      placeholder={placeholder}
      className="h-9 min-w-0 flex-1 rounded-md border border-border/60 bg-muted/30 px-2.5 text-[13px] outline-none transition-colors placeholder:text-muted-foreground/60 focus:border-ring focus:bg-transparent motion-reduce:transition-none xl:h-7 xl:border-transparent xl:bg-transparent xl:px-1 xl:focus:ring-1 xl:focus:ring-ring"
    />
  );
}

/* ------------------------------------------------------------------ */
/* Activity log                                                        */
/* ------------------------------------------------------------------ */

const LOG_ICONS: Record<Exclude<MockLogEntry["type"], "note">, LucideIcon> = {
  next_action_change: ArrowRight,
  state_change: CircleCheck,
  follow_up_change: Bell,
  area_move: MapPin,
};

const RAIL_LEFT = "left-[11px]";
const NODE_LEFT = "left-[11.5px]";
const ENTRY_PAD = "pl-9";

function ActivityLog({
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
        {log.length > 0 && (
          <span className="rounded-full bg-surface-3 px-2 py-0.5 text-[11px] font-medium tabular-nums text-muted-foreground">
            {log.length}
          </span>
        )}
        <span aria-hidden className="ml-1 h-px flex-1 bg-border/50" />
        <span className="text-[10px] font-medium tracking-wide text-muted-foreground/60 uppercase">
          Newest first
        </span>
      </div>

      {/* The pane's only scroll region. */}
      <div
        ref={scrollRef}
        className="min-h-0 flex-1 scroll-smooth overflow-y-auto overscroll-contain motion-reduce:scroll-auto"
      >
        <div className="relative pb-6">
          <div
            aria-hidden
            className={cn(
              "absolute top-1 bottom-0 w-px",
              RAIL_LEFT,
              "bg-gradient-to-b from-transparent via-border to-transparent",
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
            {groupLogsByDay(log).map((group) => (
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
                    <AutomaticChange key={entry.id} entry={entry} />
                  ),
                )}
              </section>
            ))}
          </div>
        </div>
      </div>

      <LogComposer
        onAddNote={(text) => {
          onAddNote(text);
          scrollRef.current?.scrollTo?.({ top: 0 });
        }}
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

function AutomaticChange({ entry }: { entry: MockLogEntry }) {
  const Icon =
    LOG_ICONS[entry.type as Exclude<MockLogEntry["type"], "note">] ??
    ArrowRight;

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
        <span className="shrink-0 font-medium">
          {getActivityLogEntryLabel(entry.type)}
        </span>
        <span className="truncate text-muted-foreground/80">
          {summariseChange(entry)}
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

function LogComposer({ onAddNote }: { onAddNote: (text: string) => void }) {
  const [noteText, setNoteText] = useState("");

  const submit = () => {
    const text = noteText.trim();
    if (!text) return;
    setNoteText("");
    onAddNote(text);
  };

  return (
    <div className="relative shrink-0 pt-2">
      {/* Fade the scrolled timeline out from under the bar. */}
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
        <InputGroup className="bg-muted/50 has-[textarea]:rounded-3xl has-data-[align=block-end]:rounded-3xl">
          <InputGroupTextarea
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

function summariseChange(entry: MockLogEntry) {
  if (entry.previousValue && entry.newValue) {
    return `${entry.previousValue} → ${entry.newValue}`;
  }
  if (entry.newValue) return `Set to ${entry.newValue}`;
  if (entry.previousValue) {
    return entry.content.toLowerCase().includes("completed")
      ? `Completed ${entry.previousValue}`
      : `Cleared ${entry.previousValue}`;
  }
  return entry.content;
}
