import { useDraggable, useDroppable } from "@dnd-kit/core";
import { cn } from "@vita-os/ui/lib/utils";
import { format } from "date-fns";
import { CalendarOff, Telescope } from "lucide-react";
import { useState } from "react";

import type { PlanActions } from "./item-parts";
import type { PlanItem, WeekModel } from "./model";

import { ItemEditor } from "./item-editor";
import { ItemGlyph } from "./item-parts";
import {
  BEYOND_TARGET,
  beyondTimestamp,
  dayTarget,
  SOMEDAY_TARGET,
} from "./model";

/**
 * The right pane: seven days you can drop onto, plus the two places a soft
 * date can go that are not a day — later, and nowhere.
 *
 * Days show what is already booked so the pile is triaged against real load,
 * not against an empty calendar.
 */
export function WeekPanel({
  actions,
  now,
  week,
}: {
  actions: PlanActions;
  now: number;
  week: WeekModel;
}) {
  const peak = Math.max(4, ...week.days.map((day) => day.items.length));
  const placed = week.days.reduce((sum, day) => sum + day.items.length, 0);
  const first = week.days[0].date;
  const last = week.days[week.days.length - 1].date;

  return (
    <section aria-label="The week" className="flex min-w-0 flex-col">
      <header className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1 px-2 pb-2">
        <div className="flex items-baseline gap-2">
          <h3 className="font-heading text-sm font-semibold tracking-tight">
            The week
          </h3>
          <span className="text-xs text-muted-foreground">
            {format(first, "MMM d")} – {format(last, "MMM d")}
          </span>
        </div>
        <span className="text-[11px] text-muted-foreground">
          <span className="tabular-nums">{placed}</span> already placed
        </span>
      </header>

      <div className="divide-y divide-border/50 border-y border-border/50">
        {week.days.map((day) => (
          <DayRow
            key={day.index}
            actions={actions}
            date={day.date}
            index={day.index}
            items={day.items}
            now={now}
            peak={peak}
          />
        ))}
      </div>

      <div className="mt-2 flex flex-col gap-1.5">
        <OverflowRow
          actions={actions}
          icon={<Telescope className="size-4" />}
          items={week.beyond}
          label="Beyond this week"
          landing={`lands ${format(beyondTimestamp(), "EEE d")}`}
          now={now}
          target={BEYOND_TARGET}
        />
        <SomedayRow count={week.somedayCount} />
      </div>
    </section>
  );
}

function DayRow({
  actions,
  date,
  index,
  items,
  now,
  peak,
}: {
  actions: PlanActions;
  date: Date;
  index: number;
  items: PlanItem[];
  now: number;
  peak: number;
}) {
  const { isOver, setNodeRef } = useDroppable({ id: dayTarget(index) });
  const isToday = index === 0;
  const weekday = date.getDay();
  const isWeekend = weekday === 0 || weekday === 6;

  return (
    <div
      ref={setNodeRef}
      data-drop-target={dayTarget(index)}
      className={cn(
        "flex items-start gap-3 px-2 py-2 transition-colors",
        isToday && "bg-surface-3/35",
        isOver && "bg-surface-3 inset-ring-2 inset-ring-ring/50",
      )}
    >
      <span
        className={cn(
          "flex size-9 shrink-0 flex-col items-center justify-center rounded-md",
          isToday
            ? "bg-surface-3 text-brand-accent-foreground"
            : "text-muted-foreground",
        )}
      >
        <span
          className={cn(
            "text-[9px] leading-none font-medium tracking-wider uppercase opacity-70",
            isWeekend && !isToday && "opacity-45",
          )}
        >
          {format(date, "EEE")}
        </span>
        <span
          className={cn(
            "mt-0.5 text-base leading-none font-semibold tabular-nums",
            !isToday && (isWeekend ? "text-foreground/60" : "text-foreground"),
          )}
        >
          {format(date, "d")}
        </span>
      </span>

      <div className="flex min-h-9 min-w-0 flex-1 flex-wrap content-start items-center gap-1.5 py-1">
        {items.length === 0 ? (
          <span
            className={cn(
              "text-xs text-muted-foreground/45 transition-colors",
              isOver && "text-foreground/70",
            )}
          >
            {isOver ? "Drop to schedule here" : "Open"}
          </span>
        ) : (
          items.map((item) => (
            <WeekChip key={item.id} actions={actions} item={item} now={now} />
          ))
        )}
      </div>

      <LoadMeter count={items.length} peak={peak} />
    </div>
  );
}

/** Subtle per-day load, so a heavy day is visible before you add to it. */
function LoadMeter({ count, peak }: { count: number; peak: number }) {
  const heavy = count >= 5;
  return (
    <span className="mt-3 flex w-14 shrink-0 items-center gap-1.5">
      <span className="h-1 flex-1 overflow-hidden rounded-full bg-border/60">
        <span
          className={cn(
            "block h-full rounded-full transition-all",
            heavy ? "bg-condition-attention" : "bg-brand-gold-strong/50",
          )}
          style={{ width: `${Math.min(100, (count / peak) * 100)}%` }}
        />
      </span>
      <span
        className={cn(
          "w-2 text-right text-[10px] tabular-nums",
          heavy
            ? "font-semibold text-condition-attention"
            : "text-muted-foreground/60",
        )}
      >
        {count || ""}
      </span>
    </span>
  );
}

function OverflowRow({
  actions,
  icon,
  items,
  label,
  landing,
  now,
  target,
}: {
  actions: PlanActions;
  icon: React.ReactNode;
  items: PlanItem[];
  label: string;
  /** The day a drop here writes, so the row is not a mystery bucket. */
  landing: string;
  now: number;
  target: string;
}) {
  const { isOver, setNodeRef } = useDroppable({ id: target });

  return (
    <div
      ref={setNodeRef}
      data-drop-target={target}
      className={cn(
        "flex items-start gap-3 rounded-lg border border-dashed border-border/70 px-2 py-2 transition-colors",
        isOver && "border-solid bg-surface-3 inset-ring-2 inset-ring-ring/50",
      )}
    >
      <span className="flex size-9 shrink-0 items-center justify-center rounded-md text-muted-foreground/70">
        {icon}
      </span>
      <div className="flex min-h-9 min-w-0 flex-1 flex-col justify-center gap-1.5 py-1">
        <span className="flex items-baseline gap-1.5 text-[11px] font-medium tracking-wide text-muted-foreground uppercase">
          {label}
          <span className="tabular-nums opacity-70">{items.length}</span>
          <span
            className={cn(
              "ml-auto pr-1 text-[11px] normal-case tabular-nums",
              isOver ? "text-foreground" : "text-muted-foreground/60",
            )}
          >
            {isOver ? `Drop — ${landing}` : landing}
          </span>
        </span>
        {items.length > 0 && (
          <div className="flex flex-wrap items-center gap-1.5">
            {items.map((item) => (
              <WeekChip key={item.id} actions={actions} item={item} now={now} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

/**
 * Dropping here clears the soft date. The items themselves stay in the tray
 * rather than being listed twice, so this reads as a target, not a bucket.
 */
function SomedayRow({ count }: { count: number }) {
  const { isOver, setNodeRef } = useDroppable({ id: SOMEDAY_TARGET });

  return (
    <div
      ref={setNodeRef}
      data-drop-target={SOMEDAY_TARGET}
      className={cn(
        "flex items-center gap-3 rounded-lg border border-dashed border-border/70 px-2 py-2.5 transition-colors",
        isOver && "border-solid bg-surface-3 inset-ring-2 inset-ring-ring/50",
      )}
    >
      <span className="flex size-9 shrink-0 items-center justify-center rounded-md text-muted-foreground/70">
        <CalendarOff className="size-4" />
      </span>
      <span className="text-[11px] font-medium tracking-wide text-muted-foreground uppercase">
        Someday · no date
        <span className="ml-1.5 tabular-nums opacity-70">{count}</span>
      </span>
      <span className="ml-auto pr-1 text-[11px] text-muted-foreground/60">
        {isOver ? "Drop to clear the date" : "Waits in the tray"}
      </span>
    </div>
  );
}

export function WeekChip({
  actions,
  item,
  now,
  static: isStatic,
}: {
  actions: PlanActions;
  item: PlanItem;
  now: number;
  static?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const { attributes, isDragging, listeners, setNodeRef } = useDraggable({
    data: { item },
    disabled: isStatic,
    id: item.id,
  });

  const chip = (
    <button
      type="button"
      className={cn(
        "inline-flex h-7 max-w-[16rem] items-center gap-1.5 rounded-md border px-1.5 pr-2 text-xs font-medium transition-colors",
        item.kind === "task"
          ? "border-dashed border-border bg-surface-1 text-muted-foreground hover:text-foreground"
          : "border-border/70 bg-surface-2 hover:bg-surface-3",
        item.nextMoveDone && "text-muted-foreground/70",
      )}
    >
      <ItemGlyph item={item} className="size-4 rounded-sm" />
      <span className="truncate">{item.title}</span>
    </button>
  );

  return (
    <span
      ref={setNodeRef}
      {...listeners}
      {...attributes}
      className={cn(
        "inline-flex max-w-full cursor-grab",
        isDragging && "opacity-40",
      )}
    >
      <ItemEditor
        actions={actions}
        item={item}
        now={now}
        open={open}
        onOpenChange={setOpen}
        trigger={chip}
      />
    </span>
  );
}
