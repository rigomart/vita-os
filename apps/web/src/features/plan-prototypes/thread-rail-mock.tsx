import { Badge } from "@vita-os/ui/components/badge";
import { Button } from "@vita-os/ui/components/button";
import {
  ButtonGroup,
  ButtonGroupSeparator,
} from "@vita-os/ui/components/button-group";
import { Calendar } from "@vita-os/ui/components/calendar";
import {
  Drawer,
  DrawerContent,
  DrawerDescription,
  DrawerTitle,
} from "@vita-os/ui/components/drawer";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@vita-os/ui/components/dropdown-menu";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@vita-os/ui/components/popover";
import { Separator } from "@vita-os/ui/components/separator";
import { cn } from "@vita-os/ui/lib/utils";
import { format, isToday, isYesterday, startOfDay } from "date-fns";
import {
  Bell,
  CalendarIcon,
  Check,
  CheckCircle2,
  Ellipsis,
  MoveRight,
  X,
} from "lucide-react";
import { useEffect, useRef, useState } from "react";

import { AreaIcon } from "@/features/areas/components/area-icon";
import { useThreadPaneViewport } from "@/hooks/use-thread-pane-viewport";

import type { MockActivity, MockArea } from "./mock-data";

/**
 * A mock of the app's real Thread rail (`features/threads/thread-detail/
 * thread-detail-view.tsx`) for the Plan prototypes.
 *
 * The prototypes render outside `AppShell` and cannot use the real component —
 * it is wired to Convex end to end. This is a pure-presentation stand-in that
 * copies the real pane's geometry and section anatomy so a Plan exploration can
 * be judged against the sidebar it will actually ship next to:
 *
 * - desktop (≥1280px): a `w-[clamp(28rem,34vw,34rem)]` fixed pane on
 *   `bg-popover` with a left border, sliding in over a width spacer so content
 *   is pushed rather than covered;
 * - below that: the same bottom `Drawer` at `90dvh`;
 * - the floating `ButtonGroup` of controls at `top-4 right-4` (lifecycle menu,
 *   separator, close);
 * - header = Area picker chip, title, summary; then the two-up attention grid
 *   (Next Move, Follow-up), a `Separator`, and the Activity log timeline.
 *
 * Owns no item state: every edit is a callback. Prototypes hold the data.
 */

/** The shape a prototype's item has to expose. Deliberately structural. */
export interface ThreadRailItem {
  /** Threads only. */
  areaId?: string;
  /** Tasks only: when it landed in the Inbox. */
  createdAt?: number;
  /** Follow-up (Thread) or When (Task); undefined is a legitimate state. */
  date?: number;
  id: string;
  kind: "task" | "thread";
  /** Threads only. */
  lastActivity?: MockActivity;
  /** Threads only, and at most one. */
  nextMove?: string;
  /** Threads only. */
  summary?: string;
  title: string;
}

export interface ThreadRailMockProps {
  areaById: ReadonlyMap<string, MockArea>;
  item: ThreadRailItem;
  /** "Today" for the mock dataset. Defaults to the wall clock. */
  now?: number;
  onClose: () => void;
  /** Threads only, and optional: omit to drop the Area picker entirely. */
  onMoveArea?: (itemId: string, areaId: string) => void;
  onResolve: (itemId: string) => void;
  onSetDate: (itemId: string, date: number | undefined) => void;
  /** Empty string clears the Next Move. */
  onSetNextMove: (itemId: string, text: string) => void;
  onToggleNextMoveDone: (itemId: string) => void;
}

/** Matches the real pane's `data-[state=open]` slide. */
const TRANSITION_MS = 200;

export function ThreadRailMock(props: ThreadRailMockProps) {
  const showDesktopPane = useThreadPaneViewport();
  const { item, onClose } = props;

  // The real pane defers its close until the slide finishes (`useDeferredRoute
  // Close`); the same two-phase close, minus the router.
  const [open, setOpen] = useState(false);
  const closing = useRef(false);

  useEffect(() => {
    const frame = requestAnimationFrame(() => setOpen(true));
    return () => cancelAnimationFrame(frame);
  }, []);

  const requestClose = () => {
    if (closing.current) return;
    closing.current = true;
    setOpen(false);
    setTimeout(onClose, TRANSITION_MS);
  };

  const controls = (
    <RailControls
      kind={item.kind}
      onRequestClose={requestClose}
      onResolve={() => {
        props.onResolve(item.id);
        requestClose();
      }}
    />
  );

  if (!showDesktopPane) {
    return (
      <Drawer
        open={open}
        direction="bottom"
        onOpenChange={(next) => {
          if (!next) requestClose();
        }}
      >
        <DrawerContent className="h-[90dvh] max-h-[90dvh] p-0 before:inset-0 before:rounded-t-4xl data-[vaul-drawer-direction=bottom]:max-h-[90dvh]">
          <DrawerTitle className="sr-only">{item.title}</DrawerTitle>
          <DrawerDescription className="sr-only">
            Review and update this {item.kind === "task" ? "Task" : "Thread"}.
          </DrawerDescription>
          {controls}
          <div className="flex min-h-0 flex-1 flex-col overflow-hidden px-5 pt-8 pb-[calc(2rem+env(safe-area-inset-bottom))]">
            <RailBody key={item.id} {...props} />
          </div>
        </DrawerContent>
      </Drawer>
    );
  }

  return (
    <>
      {/* Width spacer: the pane pushes the canvas instead of covering it. */}
      <div
        data-slot="thread-rail-mock-space"
        data-state={open ? "open" : "closed"}
        className="relative w-0 min-w-0 shrink-0 transition-[width] duration-200 ease-[cubic-bezier(0.32,0.72,0,1)] data-[state=open]:w-[clamp(28rem,34vw,34rem)] motion-reduce:transition-none"
      />
      <aside
        aria-label={item.title}
        data-slot="thread-rail-mock"
        data-state={open ? "open" : "closed"}
        className="fixed inset-y-0 right-0 z-30 flex h-dvh w-[clamp(28rem,34vw,34rem)] translate-x-full flex-col border-l bg-popover text-sm text-popover-foreground shadow-xl transition-transform duration-200 ease-[cubic-bezier(0.32,0.72,0,1)] data-[state=open]:translate-x-0 motion-reduce:transition-none"
      >
        {controls}
        <div className="flex min-h-0 flex-1 flex-col overflow-hidden px-6 py-8">
          <RailBody key={item.id} {...props} />
        </div>
      </aside>
    </>
  );
}

/* -------------------------------------------------------------- controls -- */

function RailControls({
  kind,
  onRequestClose,
  onResolve,
}: {
  kind: ThreadRailItem["kind"];
  onRequestClose: () => void;
  onResolve: () => void;
}) {
  return (
    <ButtonGroup
      aria-label="Thread controls"
      className="absolute top-4 right-4 z-20 rounded-4xl bg-secondary"
    >
      <DropdownMenu>
        <DropdownMenuTrigger
          render={
            <Button
              variant="ghost"
              size="icon-sm"
              aria-label="Thread actions"
            />
          }
        >
          <Ellipsis />
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuGroup>
            <DropdownMenuItem onClick={onResolve}>
              <CheckCircle2 />
              {kind === "task" ? "Mark done" : "Resolve"}
            </DropdownMenuItem>
          </DropdownMenuGroup>
        </DropdownMenuContent>
      </DropdownMenu>
      <ButtonGroupSeparator />
      <Button
        variant="ghost"
        size="icon-sm"
        onClick={onRequestClose}
        aria-label="Close thread"
      >
        <X data-icon="inline-start" />
      </Button>
    </ButtonGroup>
  );
}

/* ------------------------------------------------------------------ body -- */

function RailBody({
  areaById,
  item,
  now = Date.now(),
  onMoveArea,
  onSetDate,
  onSetNextMove,
  onToggleNextMoveDone,
}: ThreadRailMockProps) {
  const isTask = item.kind === "task";
  const area = item.areaId == null ? undefined : areaById.get(item.areaId);

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-5">
      <header
        role="banner"
        aria-label="Thread header"
        className="flex shrink-0 flex-col gap-3 pb-1"
      >
        <div className="flex items-center gap-2 pr-24">
          {isTask ? (
            <Badge variant="secondary">Inbox task</Badge>
          ) : onMoveArea ? (
            <AreaPickerMock
              areas={[...areaById.values()]}
              selectedAreaId={item.areaId}
              onSelect={(areaId) => onMoveArea(item.id, areaId)}
            />
          ) : (
            <Badge variant="secondary">
              <AreaIcon icon={area?.icon} className="size-3" />
              {area?.name}
            </Badge>
          )}
        </div>
        <div className="flex flex-col gap-0.5">
          <h2 className="font-heading text-xl font-semibold tracking-tight">
            {item.title}
          </h2>
          <p className="min-h-9 py-1.5 text-sm leading-relaxed text-muted-foreground">
            {isTask
              ? item.createdAt == null
                ? null
                : `Captured ${agoLabel(item.createdAt, now)}`
              : item.summary}
          </p>
        </div>
      </header>

      <section
        role="region"
        aria-label="Thread attention"
        className="flex shrink-0 flex-col gap-5"
      >
        <div className="grid grid-cols-[repeat(auto-fit,minmax(14rem,1fr))] gap-5">
          {!isTask && (
            <NextMoveMock
              nextMove={item.nextMove}
              onSet={(text) => onSetNextMove(item.id, text)}
              onComplete={() => onToggleNextMoveDone(item.id)}
            />
          )}
          <WhenMock
            date={item.date}
            kind={item.kind}
            now={now}
            onSet={(date) => onSetDate(item.id, date)}
          />
        </div>
        <Separator />
      </section>

      {!isTask && (
        <div className="flex min-h-0 flex-1 flex-col">
          <ActivityMock lastActivity={item.lastActivity} />
        </div>
      )}
    </div>
  );
}

/* ----------------------------------------------------------------- area -- */

/** Mirrors `features/areas/components/area-picker.tsx`. */
function AreaPickerMock({
  areas,
  selectedAreaId,
  onSelect,
}: {
  areas: MockArea[];
  selectedAreaId: string | undefined;
  onSelect: (areaId: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const selected = areas.find((area) => area.id === selectedAreaId);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger
        render={
          <Button variant="outline" size="sm" className="h-7 gap-1.5 text-xs" />
        }
      >
        <AreaIcon icon={selected?.icon} className="h-3 w-3" />
        {selected ? selected.name : "Area"}
      </PopoverTrigger>
      <PopoverContent className="w-48 p-1" align="start">
        {areas.map((area) => (
          <button
            key={area.id}
            type="button"
            onClick={() => {
              onSelect(area.id);
              setOpen(false);
            }}
            className="flex w-full items-center gap-2 rounded-sm px-2 py-1.5 text-sm transition-colors hover:bg-surface-3"
          >
            <AreaIcon icon={area.icon} className="size-3.5 shrink-0" />
            {area.name}
          </button>
        ))}
      </PopoverContent>
    </Popover>
  );
}

/* ------------------------------------------------------------ next move -- */

/** Mirrors `features/threads/components/next-move.tsx`. */
function NextMoveMock({
  nextMove,
  onSet,
  onComplete,
}: {
  nextMove: string | undefined;
  onComplete: () => void;
  onSet: (text: string) => void;
}) {
  const [addText, setAddText] = useState("");

  const handleAdd = () => {
    const text = addText.trim();
    if (!text) return;
    onSet(text);
    setAddText("");
  };

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center gap-2 text-xs font-medium text-muted-foreground">
        <MoveRight className="size-3.5" />
        Next Move
      </div>

      {nextMove ? (
        <NextMoveTaskMock
          key={nextMove}
          text={nextMove}
          onSet={onSet}
          onClear={() => onSet("")}
          onComplete={onComplete}
        />
      ) : (
        <input
          type="text"
          value={addText}
          onChange={(event) => setAddText(event.target.value)}
          onBlur={handleAdd}
          onKeyDown={(event) => {
            if (event.key === "Enter") {
              event.preventDefault();
              handleAdd();
            }
          }}
          placeholder="Add a next move..."
          aria-label="Next Move"
          className="w-full rounded bg-transparent px-2 py-1.5 text-sm outline-none placeholder:text-muted-foreground/50 focus:ring-1 focus:ring-ring"
        />
      )}
    </div>
  );
}

function NextMoveTaskMock({
  text,
  onClear,
  onComplete,
  onSet,
}: {
  onClear: () => void;
  onComplete: () => void;
  onSet: (text: string) => void;
  text: string;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(text);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (editing) inputRef.current?.focus();
  }, [editing]);

  const commit = () => {
    setEditing(false);
    const trimmed = draft.trim();
    if (trimmed && trimmed !== text) onSet(trimmed);
    else setDraft(text);
  };

  return (
    <div className="group flex items-center gap-2 rounded-md px-1 py-1.5 transition-colors hover:bg-muted/50">
      <Button
        variant="ghost"
        size="icon-xs"
        onClick={onComplete}
        className="rounded-full border border-condition-healthy/40 text-condition-healthy hover:bg-condition-healthy/10 hover:text-condition-healthy"
        aria-label="Complete next move"
      >
        <Check />
      </Button>

      {editing ? (
        <input
          ref={inputRef}
          type="text"
          value={draft}
          onChange={(event) => setDraft(event.target.value)}
          onBlur={commit}
          onKeyDown={(event) => {
            if (event.key === "Enter") commit();
            if (event.key === "Escape") {
              event.stopPropagation();
              setEditing(false);
              setDraft(text);
            }
          }}
          aria-label="Next Move"
          className="min-w-0 flex-1 rounded border-none bg-transparent px-1 py-0.5 text-sm outline-none ring-1 ring-ring"
        />
      ) : (
        <button
          type="button"
          onClick={() => setEditing(true)}
          className="min-w-0 flex-1 cursor-text truncate rounded px-1 py-0.5 text-left text-sm font-medium transition-colors hover:bg-muted/50"
        >
          {text}
        </button>
      )}

      <Button
        variant="ghost"
        size="icon-xs"
        onClick={onClear}
        className="text-muted-foreground/40 opacity-0 hover:text-destructive group-hover:opacity-100"
        aria-label="Clear next move"
      >
        <X />
      </Button>
    </div>
  );
}

/* ------------------------------------------------------ follow-up / when -- */

/**
 * Mirrors `features/threads/components/follow-up.tsx` (label + `DatePicker`),
 * with the presets the Plan explorations need folded into the popover the way
 * the attention list's `WhenPopover` folds in its Clear row.
 */
function WhenMock({
  date,
  kind,
  now,
  onSet,
}: {
  date: number | undefined;
  kind: ThreadRailItem["kind"];
  now: number;
  onSet: (date: number | undefined) => void;
}) {
  const [open, setOpen] = useState(false);
  const isTask = kind === "task";
  const selected = date == null ? undefined : new Date(date);
  const status = whenStatus(date, kind, now);

  const set = (next: number | undefined) => {
    onSet(next);
    setOpen(false);
  };

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center gap-2 text-xs font-medium text-muted-foreground">
        <Bell className="size-3.5" />
        {isTask ? "When" : "Follow-up"}
      </div>

      <Popover open={open} onOpenChange={setOpen}>
        <div className="flex items-center gap-1">
          <PopoverTrigger
            render={
              <Button
                variant="ghost"
                size="sm"
                className={cn(
                  "h-7 justify-start gap-1.5 px-2 text-xs font-normal",
                  !selected && "text-muted-foreground",
                )}
              />
            }
          >
            <CalendarIcon className="h-3 w-3" />
            {selected
              ? format(selected, "MMM d, yyyy")
              : isTask
                ? "Add a when..."
                : "Add a follow-up..."}
          </PopoverTrigger>
          {selected && (
            <Button
              variant="ghost"
              size="icon"
              className="h-5 w-5"
              onClick={() => onSet(undefined)}
              aria-label="Clear date"
            >
              <X className="h-3 w-3" />
            </Button>
          )}
        </div>
        <PopoverContent className="w-auto gap-0 p-0" align="start">
          <div className="flex flex-wrap gap-1 border-b border-border/60 p-2">
            {presets(now).map((preset) => (
              <Button
                key={preset.label}
                variant="ghost"
                size="xs"
                className="text-xs"
                onClick={() => set(preset.at)}
              >
                {preset.label}
              </Button>
            ))}
          </div>
          <Calendar
            mode="single"
            selected={selected}
            onSelect={(picked) => {
              if (!picked) return;
              const next = new Date(picked);
              next.setHours(9, 0, 0, 0);
              set(next.getTime());
            }}
          />
          {selected && (
            <div className="border-t border-border/60 p-2">
              <Button
                variant="ghost"
                size="sm"
                className="w-full justify-start text-muted-foreground"
                onClick={() => set(undefined)}
              >
                Clear
              </Button>
            </div>
          )}
        </PopoverContent>
      </Popover>

      <p className={cn("text-[11px]", status.className)}>{status.text}</p>
    </div>
  );
}

/* -------------------------------------------------------------- activity -- */

const RAIL_LEFT = "left-[11px]";
const NODE_LEFT = "left-[11.5px]";
const ENTRY_PAD = "pl-9";

/** Mirrors `features/threads/components/thread-log.tsx`, read-only. */
function ActivityMock({ lastActivity }: { lastActivity?: MockActivity }) {
  return (
    <section className="flex min-h-0 flex-1 flex-col gap-3.5">
      <div className="flex shrink-0 items-center gap-1">
        <h3 className="text-[11px] font-medium text-muted-foreground">
          Activity log
        </h3>
        {lastActivity && (
          <Badge
            variant="ghost"
            className="h-4 px-1.5 text-[10px] text-muted-foreground"
          >
            1
          </Badge>
        )}
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain">
        <div className="relative pb-6">
          <div
            aria-hidden
            className={cn(
              "absolute top-1 bottom-0 w-px bg-gradient-to-b from-transparent via-border to-transparent",
              RAIL_LEFT,
            )}
          />

          {lastActivity ? (
            <>
              <div className={cn("pb-1.5", ENTRY_PAD)}>
                <h4 className="text-[10px] font-medium tracking-wide text-muted-foreground/80 uppercase">
                  {dayLabel(lastActivity.createdAt)}
                </h4>
              </div>
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
                    <time
                      dateTime={new Date(lastActivity.createdAt).toISOString()}
                      className="shrink-0 text-[10px] text-muted-foreground/60"
                    >
                      {format(new Date(lastActivity.createdAt), "h:mm a")}
                    </time>
                  </div>
                  <p className="text-[13px] leading-snug whitespace-pre-wrap">
                    {lastActivity.content}
                  </p>
                </div>
              </div>
            </>
          ) : (
            <div className={cn("relative pb-2", ENTRY_PAD)}>
              <span
                aria-hidden
                className={cn(
                  "absolute top-1 size-2 -translate-x-1/2 rounded-full border border-border bg-background",
                  NODE_LEFT,
                )}
              />
              <p className="text-[13px] leading-snug text-muted-foreground">
                Nothing on the timeline yet.
              </p>
            </div>
          )}
        </div>
      </div>
    </section>
  );
}

/* ----------------------------------------------------------------- dates -- */

function dayDelta(when: number, now: number): number {
  return Math.round(
    (startOfDay(new Date(when)).getTime() -
      startOfDay(new Date(now)).getTime()) /
      86_400_000,
  );
}

function dayAt(offset: number, now: number, hour: number): number {
  const base = new Date(now);
  return new Date(
    base.getFullYear(),
    base.getMonth(),
    base.getDate() + offset,
    hour,
  ).getTime();
}

function presets(now: number): { at: number; label: string }[] {
  const today = new Date(now);
  const isoDay = (today.getDay() + 6) % 7;
  return [
    { label: "Today", at: dayAt(0, now, 17) },
    { label: "Tomorrow", at: dayAt(1, now, 9) },
    { label: "Weekend", at: dayAt((6 - today.getDay() + 7) % 7, now, 10) },
    { label: "Next week", at: dayAt(6 - isoDay + 1, now, 9) },
  ];
}

/**
 * The soft-date sentence. A Follow-up resurfaces — it is never due, and a date
 * already passed means the item has been waiting, not that it failed.
 */
function whenStatus(
  date: number | undefined,
  kind: ThreadRailItem["kind"],
  now: number,
): { className: string; text: string } {
  if (date == null) {
    return {
      className: "text-muted-foreground/60",
      text: kind === "task" ? "No when set" : "No Follow-up set",
    };
  }

  const verb = kind === "task" ? "Comes back" : "Resurfaces";
  const delta = dayDelta(date, now);

  if (delta < 0) {
    return {
      className: "text-condition-attention",
      text: `Waiting since ${format(new Date(date), "EEE, MMM d")}`,
    };
  }
  if (delta === 0) {
    return { className: "text-brand-accent-foreground", text: `${verb} today` };
  }
  return {
    className: "text-muted-foreground/60",
    text: delta === 1 ? `${verb} tomorrow` : `${verb} in ${delta} days`,
  };
}

function agoLabel(timestamp: number, now: number): string {
  const days = -dayDelta(timestamp, now);
  if (days <= 0) return "today";
  if (days === 1) return "yesterday";
  return `${days}d ago`;
}

function dayLabel(createdAt: number): string {
  const date = new Date(createdAt);
  if (isToday(date)) return "Today";
  if (isYesterday(date)) return "Yesterday";
  return format(date, "MMMM d, yyyy");
}
