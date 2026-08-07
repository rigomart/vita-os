import type { DragEndEvent, DragStartEvent } from "@dnd-kit/core";

import {
  DndContext,
  DragOverlay,
  KeyboardSensor,
  PointerSensor,
  pointerWithin,
  useSensor,
  useSensors,
} from "@dnd-kit/core";
import { Button } from "@vita-os/ui/components/button";
import { format } from "date-fns";
import { Sparkles } from "lucide-react";
import { useState } from "react";

import type { PlanActions } from "./item-parts";
import type { PlanItem } from "./model";

import { NOW } from "../mock-data";
import { ItemGlyph, NextMoveLine } from "./item-parts";
import {
  buildInitialItems,
  buildTray,
  buildWeek,
  targetWhen,
  trayQueue,
} from "./model";
import { ReviewMode } from "./review";
import { PlanningTray } from "./tray";
import { WeekPanel } from "./week";

/**
 * "Weekly ritual" — planning as a finite pass, not a wall of dates.
 *
 * Left: a tray of everything that still wants a decision, grouped by the kind
 * of decision it wants. Right: the seven days ahead, showing the load already
 * on them. Drag from tray to day to set a Follow-up (Thread) or a When (Task);
 * drag between days to reschedule; open any item in place to edit exactly.
 *
 * "Start review" turns the same data into a guided, keyboard-first pass over
 * the tray, one card at a time, ending when the pile is empty.
 */
export function WeeklyRitualPlan() {
  const now = NOW;
  const [items, setItems] = useState<PlanItem[]>(buildInitialItems);
  const [dragging, setDragging] = useState<PlanItem | undefined>();
  const [reviewQueue, setReviewQueue] = useState<string[] | undefined>();

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(KeyboardSensor),
  );

  function update(id: string, patch: (item: PlanItem) => PlanItem) {
    setItems((current) =>
      current.map((item) => (item.id === id ? patch(item) : item)),
    );
  }

  const actions: PlanActions = {
    resolve: (id) => update(id, (item) => ({ ...item, resolved: true })),
    setNextMove: (id, text) =>
      update(id, (item) => ({
        ...item,
        nextMove: text.length > 0 ? text : undefined,
        nextMoveDone: text.length > 0 ? item.nextMoveDone : undefined,
      })),
    setWhen: (id, when) => update(id, (item) => ({ ...item, when })),
    toggleNextMoveDone: (id) =>
      update(id, (item) => ({ ...item, nextMoveDone: !item.nextMoveDone })),
  };

  const active = items.filter((item) => !item.resolved);
  const tray = buildTray(active, now);
  const week = buildWeek(active, now);
  const trayCount = tray.reduce((sum, group) => sum + group.items.length, 0);
  const weekCount = week.days.reduce((sum, day) => sum + day.items.length, 0);

  function onDragStart(event: DragStartEvent) {
    setDragging(event.active.data.current?.item as PlanItem | undefined);
  }

  function onDragEnd(event: DragEndEvent) {
    setDragging(undefined);
    const over = event.over;
    if (!over) return;
    const target = targetWhen(String(over.id));
    if (!target) return;
    actions.setWhen(String(event.active.id), target.when);
  }

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={pointerWithin}
      onDragStart={onDragStart}
      onDragCancel={() => setDragging(undefined)}
      onDragEnd={onDragEnd}
    >
      <section className="flex flex-col gap-4">
        <RitualHeader
          now={now}
          onStartReview={() => setReviewQueue(trayQueue(tray))}
          reviewing={reviewQueue !== undefined}
          trayCount={trayCount}
          weekCount={weekCount}
        />

        {reviewQueue ? (
          <ReviewMode
            actions={actions}
            items={items}
            now={now}
            onExit={() => setReviewQueue(undefined)}
            queue={reviewQueue}
            week={week}
          />
        ) : (
          <div className="grid min-h-0 items-start gap-5 lg:grid-cols-[minmax(19rem,22rem)_minmax(0,1fr)]">
            <PlanningTray actions={actions} groups={tray} now={now} />
            <WeekPanel actions={actions} now={now} week={week} />
          </div>
        )}
      </section>

      <DragOverlay dropAnimation={null}>
        {dragging && <DragGhost item={dragging} />}
      </DragOverlay>
    </DndContext>
  );
}

function RitualHeader({
  now,
  onStartReview,
  reviewing,
  trayCount,
  weekCount,
}: {
  now: number;
  onStartReview: () => void;
  reviewing: boolean;
  trayCount: number;
  weekCount: number;
}) {
  return (
    <header className="flex flex-wrap items-end justify-between gap-x-4 gap-y-2 border-b border-border/50 pb-4">
      <div className="flex items-center gap-3">
        <span className="flex size-11 flex-col items-center justify-center rounded-lg bg-surface-3 text-brand-accent-foreground">
          <span className="text-[9px] leading-none font-medium tracking-wider uppercase opacity-70">
            {format(new Date(now), "MMM")}
          </span>
          <span className="mt-0.5 text-lg leading-none font-semibold tabular-nums">
            {format(new Date(now), "d")}
          </span>
        </span>
        <div>
          <h2 className="font-heading text-xl font-semibold tracking-tight">
            Plan the week
          </h2>
          <p className="mt-0.5 text-xs text-muted-foreground">
            <span className="tabular-nums">{trayCount}</span> waiting on a
            decision · <span className="tabular-nums">{weekCount}</span> already
            on the week
          </p>
        </div>
      </div>

      {!reviewing && (
        <Button onClick={onStartReview} disabled={trayCount === 0}>
          <Sparkles data-icon="inline-start" />
          Start review
          <span className="ml-0.5 tabular-nums opacity-70">{trayCount}</span>
        </Button>
      )}
    </header>
  );
}

/** What follows the cursor: a compact restatement of the item being placed. */
function DragGhost({ item }: { item: PlanItem }) {
  return (
    <div className="flex max-w-72 cursor-grabbing items-start gap-2 rounded-lg border border-border/70 bg-popover px-2 py-1.5 shadow-lg ring-1 ring-foreground/5">
      <ItemGlyph item={item} className="mt-0.5" />
      <div className="flex min-w-0 flex-col gap-0.5">
        <span className="truncate text-sm leading-snug font-medium">
          {item.title}
        </span>
        <NextMoveLine item={item} />
      </div>
    </div>
  );
}
