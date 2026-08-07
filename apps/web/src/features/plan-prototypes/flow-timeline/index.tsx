import {
  DndContext,
  DragOverlay,
  PointerSensor,
  pointerWithin,
  useSensor,
  useSensors,
} from "@dnd-kit/core";
import { Button } from "@vita-os/ui/components/button";
import { Kbd } from "@vita-os/ui/components/kbd";
import { cn } from "@vita-os/ui/lib/utils";
import { Undo2 } from "lucide-react";
import { useEffect, useReducer, useRef, useState } from "react";

import type { PlanItem, QuickTarget } from "./model";

import { mockAreaById, NOW } from "../mock-data";
import {
  buildSections,
  dayOffsetFrom,
  dropDate,
  flattenOrder,
  quickDate,
  seedItems,
  UNDATED_ID,
} from "./model";
import { planReducer } from "./plan-state";
import { ThreadRail } from "./rail";
import { DensityStrip, DragGhost, SectionBlock } from "./timeline";

/**
 * Flow timeline — a continuous two-week agenda with a persistent editing rail.
 *
 * The bet: planning is a sweep, not a series of round trips. Every row is one
 * keystroke from being rescheduled, rewritten, or resolved, and the rail keeps
 * the current Thread's context on screen while you move through the list.
 */
export function FlowTimelinePlan() {
  const now = NOW;
  const [items, dispatch] = useReducer(planReducer, undefined, seedItems);
  const [selectedId, setSelectedId] = useState<string | undefined>(undefined);
  const [draggingId, setDraggingId] = useState<string | undefined>(undefined);
  const [removed, setRemoved] = useState<PlanItem | undefined>(undefined);
  const [focusSignal, setFocusSignal] = useState(0);

  const nodes = useRef(new Map<string, HTMLElement>());
  const sections = buildSections(items, now);
  const order = flattenOrder(sections);
  const selected = items.find((item) => item.id === selectedId);

  const overdueCount = items.filter(
    (item) => item.date !== undefined && dayOffsetFrom(item.date, now) < 0,
  ).length;
  const todayCount = items.filter(
    (item) => item.date !== undefined && dayOffsetFrom(item.date, now) === 0,
  ).length;
  const undatedCount = items.filter((item) => item.date === undefined).length;

  const registerNode = (id: string, node: HTMLElement | null) => {
    if (node) nodes.current.set(id, node);
    else nodes.current.delete(id);
  };

  const reveal = (id: string) => {
    nodes.current.get(id)?.scrollIntoView({ block: "nearest" });
  };

  const select = (id: string | undefined) => {
    setSelectedId(id);
    if (id) reveal(id);
  };

  const move = (delta: number) => {
    if (order.length === 0) return;
    const index = selectedId ? order.indexOf(selectedId) : -1;
    const next =
      index === -1
        ? delta > 0
          ? 0
          : order.length - 1
        : Math.min(order.length - 1, Math.max(0, index + delta));
    select(order[next]);
  };

  const remove = (id: string) => {
    const item = items.find((entry) => entry.id === id);
    if (!item) return;
    const index = order.indexOf(id);
    dispatch({ id, kind: "remove" });
    setRemoved(item);
    const nextId = order[index + 1] ?? order[index - 1];
    setSelectedId(nextId);
  };

  const setDate = (id: string, date: number | undefined) => {
    dispatch({ date, id, kind: "set-date" });
    setSelectedId(id);
    // Let the row land in its new day before scrolling to it.
    requestAnimationFrame(() => {
      reveal(id);
    });
  };

  // Global keyboard flow. Re-bound every render so the handler always closes
  // over the current selection; cheap, and keeps the reducer state honest.
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      if (
        target?.isContentEditable ||
        (target && ["INPUT", "SELECT", "TEXTAREA"].includes(target.tagName))
      ) {
        return;
      }
      if (event.metaKey || event.ctrlKey || event.altKey) return;

      const quick: Record<string, QuickTarget> = {
        e: "weekend",
        m: "tomorrow",
        t: "today",
        w: "next-week",
      };

      switch (event.key) {
        case "ArrowDown":
        case "j":
          event.preventDefault();
          move(1);
          return;
        case "ArrowUp":
        case "k":
          event.preventDefault();
          move(-1);
          return;
        case "Escape":
          setSelectedId(undefined);
          return;
        case "Enter":
          if (selectedId) {
            event.preventDefault();
            setFocusSignal((value) => value + 1);
          }
          return;
        default:
          break;
      }

      if (!selectedId) return;

      const key = event.key.toLowerCase();
      if (key in quick) {
        event.preventDefault();
        setDate(selectedId, quickDate(quick[key], now));
        return;
      }
      if (key === "x") {
        event.preventDefault();
        setDate(selectedId, undefined);
        return;
      }
      if (key === "r") {
        event.preventDefault();
        remove(selectedId);
      }
    };

    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("keydown", onKeyDown);
    };
  });

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
  );
  const dragging = items.find((item) => item.id === draggingId);

  const context = {
    areaById: mockAreaById,
    now,
    onSelect: select,
    registerNode,
    selectedId,
  };

  return (
    <section aria-label="Plan" className="flex flex-col gap-3">
      <header className="flex flex-wrap items-end justify-between gap-x-6 gap-y-3">
        <div className="flex flex-col gap-0.5">
          <h2 className="font-heading text-xl leading-none font-semibold tracking-tight">
            The next two weeks
          </h2>
          <p className="flex flex-wrap items-center gap-x-1.5 text-xs text-muted-foreground">
            <span
              className={cn(
                "font-medium tabular-nums",
                overdueCount > 0 && "text-condition-attention",
              )}
            >
              {overdueCount} overdue
            </span>
            <span aria-hidden>·</span>
            <span className="tabular-nums">{todayCount} today</span>
            <span aria-hidden>·</span>
            <span className="tabular-nums">{undatedCount} undated</span>
          </p>
        </div>

        <div className="w-full max-w-[420px] min-w-[280px] flex-1">
          <DensityStrip
            sections={sections}
            onJump={(sectionId) => {
              nodes.current
                .get(sectionId)
                ?.scrollIntoView({ behavior: "smooth", block: "start" });
            }}
          />
        </div>
      </header>

      <DndContext
        sensors={sensors}
        collisionDetection={pointerWithin}
        onDragStart={({ active }) => {
          setDraggingId(String(active.id));
        }}
        onDragEnd={({ active, over }) => {
          setDraggingId(undefined);
          if (!over) return;
          const sectionId = String(over.id);
          if (sectionId === UNDATED_ID) {
            setDate(String(active.id), undefined);
            return;
          }
          const date = dropDate(sectionId, now);
          if (date !== undefined) setDate(String(active.id), date);
        }}
        onDragCancel={() => {
          setDraggingId(undefined);
        }}
      >
        <div className="relative flex h-[min(660px,calc(100svh_-_22rem))] min-h-[420px] gap-4">
          <div className="-mx-1.5 min-w-0 flex-1 overflow-y-auto px-1.5 pb-10">
            {sections.map((section) => (
              <SectionBlock
                key={section.id}
                context={context}
                section={section}
              />
            ))}
            <p className="px-1.5 pt-6 text-[11px] text-muted-foreground/50">
              That's everything on the plan.
            </p>
          </div>

          <ThreadRail
            area={
              selected?.areaId ? mockAreaById.get(selected.areaId) : undefined
            }
            focusSignal={focusSignal}
            item={selected}
            now={now}
            handlers={{
              onClose: () => {
                setSelectedId(undefined);
              },
              onRemove: remove,
              onSetDate: setDate,
              onSetNextMove: (id, nextMove) => {
                dispatch({ id, kind: "set-next-move", nextMove });
              },
              onSetTitle: (id, title) => {
                dispatch({ id, kind: "set-title", title });
              },
            }}
            className={cn(
              "absolute inset-y-0 right-0 z-30 shadow-xl xl:static xl:z-auto xl:shadow-none",
              !selected && "hidden xl:flex",
            )}
          />
        </div>

        <DragOverlay dropAnimation={null}>
          {dragging ? (
            <DragGhost
              item={dragging}
              area={
                dragging.areaId ? mockAreaById.get(dragging.areaId) : undefined
              }
            />
          ) : null}
        </DragOverlay>
      </DndContext>

      <footer className="flex flex-wrap items-center justify-between gap-x-5 gap-y-2 border-t border-border/60 pt-2.5">
        <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 text-[11px] text-muted-foreground/70">
          <Hint keys={["J", "K"]} label="move" />
          <Hint keys={["T"]} label="today" />
          <Hint keys={["M"]} label="tomorrow" />
          <Hint keys={["E"]} label="weekend" />
          <Hint keys={["W"]} label="next week" />
          <Hint keys={["X"]} label="clear date" />
          <Hint keys={["R"]} label="resolve" />
          <Hint keys={["↵"]} label="edit next move" />
        </div>

        {removed && (
          <div className="flex items-center gap-2 text-[11px] text-muted-foreground">
            <span className="max-w-56 truncate">
              Resolved “{removed.title}”
            </span>
            <Button
              variant="ghost"
              size="xs"
              onClick={() => {
                dispatch({ item: removed, kind: "restore" });
                setSelectedId(removed.id);
                setRemoved(undefined);
              }}
            >
              <Undo2 />
              Undo
            </Button>
          </div>
        )}
      </footer>
    </section>
  );
}

function Hint({ keys, label }: { keys: string[]; label: string }) {
  return (
    <span className="flex items-center gap-1">
      {keys.map((key) => (
        <Kbd key={key} className="text-[10px]">
          {key}
        </Kbd>
      ))}
      <span>{label}</span>
    </span>
  );
}
