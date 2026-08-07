import { useDraggable, useDroppable } from "@dnd-kit/core";
import { cn } from "@vita-os/ui/lib/utils";
import { format } from "date-fns";
import { ArrowRight, CircleDashed, Inbox } from "lucide-react";

import { AreaIcon } from "@/features/areas/components/area-icon";

import type { MockArea } from "../mock-data";
import type { PlanItem, Section } from "./model";

import {
  agoLabel,
  dayLabel,
  latenessLabel,
  LATER_ID,
  OVERDUE_ID,
} from "./model";

export interface RowContext {
  areaById: ReadonlyMap<string, MockArea>;
  now: number;
  onSelect: (id: string) => void;
  registerNode: (id: string, node: HTMLElement | null) => void;
  selectedId?: string;
}

// --- density strip ----------------------------------------------------------

/**
 * Fourteen-day density preview plus the overdue zone. Clicking a cell scrolls
 * the timeline to that day.
 */
export function DensityStrip({
  onJump,
  sections,
}: {
  onJump: (sectionId: string) => void;
  sections: Section[];
}) {
  const days = sections.filter((section) => section.kind === "day");
  const overdue = sections.find((section) => section.kind === "overdue");
  const peak = Math.max(1, ...days.map((day) => day.items.length));

  return (
    <div className="flex items-stretch gap-1.5">
      <button
        type="button"
        onClick={() => onJump(OVERDUE_ID)}
        title={`${overdue?.items.length ?? 0} overdue`}
        className={cn(
          "flex w-11 flex-col items-center justify-center rounded-md px-1 py-1 transition-colors",
          (overdue?.items.length ?? 0) > 0
            ? "bg-condition-attention/12 text-condition-attention hover:bg-condition-attention/20"
            : "bg-surface-3/60 text-muted-foreground/60 hover:bg-surface-3",
        )}
      >
        <span className="text-sm leading-none font-semibold tabular-nums">
          {overdue?.items.length ?? 0}
        </span>
        <span className="mt-1 text-[9px] leading-none tracking-wider uppercase opacity-80">
          late
        </span>
      </button>

      <span className="my-1 w-px shrink-0 bg-border" aria-hidden />

      <div className="flex min-w-0 flex-1 items-stretch gap-[3px]">
        {days.map((day) => {
          if (day.kind !== "day") return null;
          const date = new Date(day.date);
          const isToday = day.offset === 0;
          const isWeekend = date.getDay() === 0 || date.getDay() === 6;
          const count = day.items.length;
          const height = count === 0 ? 3 : 8 + Math.round((count / peak) * 20);

          return (
            <button
              key={day.id}
              type="button"
              onClick={() => onJump(day.id)}
              title={`${format(date, "EEE, MMM d")} · ${count} item${count === 1 ? "" : "s"}`}
              className="group flex min-w-0 flex-1 flex-col items-center gap-1"
            >
              <span
                className={cn(
                  "flex h-8 w-full items-end justify-center rounded-sm ring-1 transition-colors ring-inset",
                  isToday
                    ? "bg-brand-gold-strong/10 ring-brand-gold-strong/30"
                    : isWeekend
                      ? "bg-surface-3/25 ring-border/40"
                      : "bg-surface-3/45 ring-border/40",
                )}
              >
                <span
                  style={{ height: `${height}px` }}
                  className={cn(
                    "w-full rounded-sm transition-colors",
                    isToday
                      ? "bg-brand-gold-strong"
                      : count === 0
                        ? "bg-border"
                        : "bg-foreground/45 group-hover:bg-foreground/70",
                  )}
                />
              </span>
              <span
                className={cn(
                  "text-[9px] leading-none tracking-wide uppercase",
                  isToday
                    ? "font-semibold text-foreground"
                    : "text-muted-foreground/60",
                )}
              >
                {format(date, "EEEEE")}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

// --- sections ---------------------------------------------------------------

export function SectionBlock({
  context,
  section,
}: {
  context: RowContext;
  section: Section;
}) {
  const droppable = section.kind !== "overdue";
  const { isOver, setNodeRef } = useDroppable({
    id: section.id,
    disabled: !droppable,
  });

  if (section.kind === "overdue") {
    if (section.items.length === 0) return null;

    return (
      <div
        ref={(node) => {
          context.registerNode(section.id, node);
        }}
        className="scroll-mt-1 rounded-lg border border-condition-attention/25 bg-condition-attention/[0.05] p-1.5 pt-0"
      >
        <SectionHeading
          count={section.items.length}
          hint="waiting for you to re-engage"
          label="Overdue"
          tone="attention"
        />
        <div className="flex flex-col">
          {section.items.map((item) => (
            <ItemRow key={item.id} context={context} inOverdue item={item} />
          ))}
        </div>
      </div>
    );
  }

  if (section.kind === "day") {
    const date = new Date(section.date);
    const isToday = section.offset === 0;
    const relative = dayLabel(section.offset);
    const isEmpty = section.items.length === 0;

    if (isEmpty && !isToday) {
      return (
        <div
          ref={(node) => {
            setNodeRef(node);
            context.registerNode(section.id, node);
          }}
          className={cn(
            "flex h-7 scroll-mt-9 items-center gap-2.5 rounded-md px-1.5 transition-colors",
            isOver &&
              "bg-brand-gold-strong/15 ring-1 ring-brand-gold-strong/60",
          )}
        >
          <span className="w-28 shrink-0 text-[11px] text-muted-foreground/45 tabular-nums">
            {format(date, "EEE · MMM d")}
          </span>
          <span className="h-px flex-1 bg-border/40" aria-hidden />
        </div>
      );
    }

    return (
      <div
        ref={(node) => {
          setNodeRef(node);
          context.registerNode(section.id, node);
        }}
        className={cn(
          "scroll-mt-9 rounded-md transition-colors",
          isOver && "bg-brand-gold-strong/10 ring-1 ring-brand-gold-strong/60",
        )}
      >
        <div className="sticky top-0 z-10 flex items-center gap-2.5 bg-surface-1 px-1.5 pt-2.5 pb-1">
          <span className="flex shrink-0 items-baseline gap-1.5">
            {isToday && (
              <span
                aria-hidden
                className="size-1.5 self-center rounded-full bg-brand-gold-strong"
              />
            )}
            <span
              className={cn(
                "text-xs tabular-nums",
                isToday
                  ? "font-semibold text-foreground"
                  : "font-medium text-muted-foreground",
              )}
            >
              {relative ?? format(date, "EEE · MMM d")}
            </span>
            {relative && (
              <span className="text-[11px] text-muted-foreground/60 tabular-nums">
                {format(date, "EEE, MMM d")}
              </span>
            )}
          </span>
          <span
            className={cn(
              "h-px flex-1",
              isToday ? "bg-brand-gold-strong/40" : "bg-border/60",
            )}
            aria-hidden
          />
          {section.items.length > 0 && (
            <span className="text-[11px] text-muted-foreground/60 tabular-nums">
              {section.items.length}
            </span>
          )}
        </div>

        {isEmpty ? (
          <p className="px-1.5 pt-0.5 pb-2 text-xs text-muted-foreground/50">
            Nothing resurfacing today.
          </p>
        ) : (
          <div className="flex flex-col pb-0.5">
            {section.items.map((item) => (
              <ItemRow key={item.id} context={context} item={item} />
            ))}
          </div>
        )}
      </div>
    );
  }

  const isLater = section.id === LATER_ID;
  if (section.items.length === 0) return null;

  return (
    <div
      ref={(node) => {
        setNodeRef(node);
        context.registerNode(section.id, node);
      }}
      className={cn(
        "mt-3 scroll-mt-9 rounded-md transition-colors",
        isOver && "bg-brand-gold-strong/10 ring-1 ring-brand-gold-strong/60",
      )}
    >
      <SectionHeading
        count={section.items.length}
        hint={isLater ? "beyond two weeks" : "no follow-up set"}
        label={isLater ? "Later" : "No date"}
        tone="muted"
      />
      <div className="flex flex-col">
        {section.items.map((item) => (
          <ItemRow key={item.id} context={context} item={item} />
        ))}
      </div>
    </div>
  );
}

function SectionHeading({
  count,
  hint,
  label,
  tone,
}: {
  count: number;
  hint: string;
  label: string;
  tone: "attention" | "muted";
}) {
  return (
    <div
      className={cn(
        "flex items-baseline gap-2.5 px-1.5 pt-2.5 pb-1",
        // The overdue zone sits inside a tinted box, so a sticky heading would
        // have nothing opaque to sit on; only the flat sections stick.
        tone === "muted" && "sticky top-0 z-10 bg-surface-1",
      )}
    >
      <span
        className={cn(
          "text-xs font-semibold tracking-wide uppercase",
          tone === "attention"
            ? "text-condition-attention"
            : "text-muted-foreground",
        )}
      >
        {label}
      </span>
      <span className="truncate text-[11px] text-muted-foreground/60">
        {hint}
      </span>
      <span
        className={cn(
          "h-px flex-1 self-center",
          tone === "attention" ? "bg-condition-attention/25" : "bg-border/60",
        )}
        aria-hidden
      />
      <span className="text-[11px] text-muted-foreground/60 tabular-nums">
        {count}
      </span>
    </div>
  );
}

// --- rows -------------------------------------------------------------------

export function ItemRow({
  context,
  inOverdue = false,
  item,
}: {
  context: RowContext;
  inOverdue?: boolean;
  item: PlanItem;
}) {
  const { attributes, isDragging, listeners, setNodeRef } = useDraggable({
    id: item.id,
  });
  const isSelected = context.selectedId === item.id;
  const area = item.areaId ? context.areaById.get(item.areaId) : undefined;
  const isToday =
    item.date !== undefined &&
    new Date(item.date).toDateString() === new Date(context.now).toDateString();

  return (
    <button
      type="button"
      ref={(node) => {
        setNodeRef(node);
        context.registerNode(item.id, node);
      }}
      {...listeners}
      {...attributes}
      tabIndex={isSelected ? 0 : -1}
      aria-current={isSelected}
      onClick={() => {
        context.onSelect(item.id);
      }}
      className={cn(
        "group relative flex h-9 w-full scroll-mt-11 scroll-mb-2 items-center gap-2.5 rounded-md pr-2 pl-4 text-left transition-colors outline-none",
        isSelected ? "bg-surface-3" : "hover:bg-surface-3/50",
        isDragging && "opacity-40",
      )}
    >
      <span
        aria-hidden
        className={cn(
          "absolute top-1.5 bottom-1.5 left-1 w-[3px] rounded-full transition-colors",
          inOverdue
            ? "bg-condition-attention"
            : isToday
              ? "bg-brand-gold-strong"
              : isSelected
                ? "bg-foreground/40"
                : "bg-border",
        )}
      />

      {item.kind === "task" ? (
        <Inbox className="size-3.5 shrink-0 text-muted-foreground/70" />
      ) : area ? (
        <AreaIcon
          icon={area.icon}
          className="size-3.5 shrink-0 text-muted-foreground"
        />
      ) : (
        <CircleDashed className="size-3.5 shrink-0 text-muted-foreground/50" />
      )}

      <span
        className={cn(
          "shrink-0 truncate text-sm font-medium",
          item.nextMove ? "max-w-[46%]" : "max-w-full",
        )}
      >
        {item.title}
      </span>

      {item.nextMove && (
        <span className="flex min-w-0 flex-1 items-baseline gap-1 text-xs text-muted-foreground/80">
          <ArrowRight className="size-3 shrink-0 translate-y-0.5" />
          <span className="truncate">
            {item.nextMove}
            {inOverdue && item.lastActivity && (
              <span className="text-muted-foreground/50">
                {" · touched "}
                {agoLabel(item.lastActivity.createdAt, context.now)}
              </span>
            )}
          </span>
        </span>
      )}
      {!item.nextMove && <span className="flex-1" />}

      {inOverdue && item.date !== undefined && (
        <span className="shrink-0 rounded-full bg-condition-attention/12 px-1.5 py-0.5 text-[10px] font-medium text-condition-attention tabular-nums">
          {latenessLabel(item.date, context.now)}
        </span>
      )}

      <span className="hidden w-24 shrink-0 truncate text-right text-[11px] text-muted-foreground/60 lg:block">
        {item.kind === "task" ? "Inbox" : (area?.name ?? "")}
      </span>
    </button>
  );
}

/** Ghost shown under the cursor while dragging a row. */
export function DragGhost({ area, item }: { area?: MockArea; item: PlanItem }) {
  return (
    <div className="flex h-9 max-w-md items-center gap-2 rounded-md border border-border bg-surface-2 pr-3 pl-2.5 shadow-lg">
      {item.kind === "task" ? (
        <Inbox className="size-3.5 shrink-0 text-muted-foreground/70" />
      ) : area ? (
        <AreaIcon
          icon={area.icon}
          className="size-3.5 shrink-0 text-muted-foreground"
        />
      ) : null}
      <span className="truncate text-sm font-medium">{item.title}</span>
    </div>
  );
}
