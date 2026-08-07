import {
  type CollisionDetection,
  closestCorners,
  DndContext,
  DragOverlay,
  type DragEndEvent,
  type DragStartEvent,
  PointerSensor,
  pointerWithin,
  useSensor,
  useSensors,
} from "@dnd-kit/core";
import { cn } from "@vita-os/ui/lib/utils";
import { Eye, EyeOff } from "lucide-react";
import { useEffect, useMemo, useState } from "react";

import type { MockThread } from "../mock-data";
import type { BoardNotice } from "./board-controls";
import type { Placement } from "./horizon-model";

import { mockAreaById, mockAreas, mockThreads, NOW } from "../mock-data";
import { BoardCard } from "./board-card";
import { BoardColumn } from "./board-column";
import { AreaFilter, NoticePill } from "./board-controls";
import {
  buildHorizons,
  followUpLabel,
  groupByPlacement,
  placementOf,
} from "./horizon-model";
import { NoDateTray } from "./no-date-tray";
import { ThreadCard } from "./thread-card";

/**
 * Horizon board — planning as flow between "when will I re-engage with this".
 *
 * Threads are laid out across fuzzy time horizons instead of exact dates.
 * Dragging a card between columns rewrites its Follow-up; the No-date tray
 * below the board is a first-class peer of the columns, since an undated
 * Thread is legitimate rather than a backlog failure.
 *
 * All state is local and seeded from the shared mock dataset.
 */

const RESOLVE_EXIT_MS = 260;
const LANDED_FLASH_MS = 1100;

/** Pointer-first so column hit areas feel exact; keyboard drags fall back. */
const collisionDetection: CollisionDetection = (args) => {
  const pointerHits = pointerWithin(args);
  return pointerHits.length > 0 ? pointerHits : closestCorners(args);
};

function parseDropTarget(id: string | number): Placement | undefined {
  const raw = String(id);
  return raw.startsWith("horizon:") ? (raw.slice(8) as Placement) : undefined;
}

export function HorizonBoardPlan() {
  const now = NOW;
  const horizons = useMemo(() => buildHorizons(now), [now]);

  const [threads, setThreads] = useState<MockThread[]>(() => mockThreads);
  const [activeAreas, setActiveAreas] = useState<ReadonlySet<string>>(
    () => new Set(mockAreas.map((area) => area.id)),
  );
  const [collapseEmpty, setCollapseEmpty] = useState(true);
  const [editorId, setEditorId] = useState<string | null>(null);
  const [draggingId, setDraggingId] = useState<string | null>(null);
  const [landedId, setLandedId] = useState<string | null>(null);
  const [resolvingId, setResolvingId] = useState<string | null>(null);
  const [notice, setNotice] = useState<BoardNotice | null>(null);

  // Pointer only. A KeyboardSensor would swallow Enter/Space on a focused card
  // to start a keyboard drag, and those keys belong to the card editor here.
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
  );

  const areaCounts = useMemo(() => {
    const counts = new Map<string, number>();
    for (const thread of threads) {
      counts.set(thread.areaId, (counts.get(thread.areaId) ?? 0) + 1);
    }
    return counts;
  }, [threads]);

  const visible = useMemo(
    () => threads.filter((thread) => activeAreas.has(thread.areaId)),
    [threads, activeAreas],
  );
  const groups = useMemo(() => groupByPlacement(visible, now), [visible, now]);

  const undated = groups.get("none") ?? [];
  const overdue = groups.get("overdue") ?? [];
  const columns = horizons.filter(
    (horizon) => horizon.key !== "overdue" || overdue.length > 0,
  );

  useEffect(() => {
    if (!landedId) return;
    const timer = setTimeout(() => setLandedId(null), LANDED_FLASH_MS);
    return () => clearTimeout(timer);
  }, [landedId]);

  // Removal is driven by the exit animation, so clearing `resolvingId` (which
  // is what Undo does) cancels the pending removal instead of racing it.
  useEffect(() => {
    if (!resolvingId) return;
    const timer = setTimeout(() => {
      setThreads((prev) => prev.filter((thread) => thread.id !== resolvingId));
      setResolvingId(null);
    }, RESOLVE_EXIT_MS);
    return () => clearTimeout(timer);
  }, [resolvingId]);

  function announce(
    text: string,
    tone: BoardNotice["tone"],
    onUndo?: () => void,
  ) {
    setNotice({ id: Date.now(), text, tone, onUndo });
  }

  /** Put a snapshot back on the board, re-adding it if it had left. */
  function restore(snapshot: MockThread) {
    setThreads((prev) =>
      prev.some((thread) => thread.id === snapshot.id)
        ? prev.map((thread) => (thread.id === snapshot.id ? snapshot : thread))
        : [...prev, snapshot],
    );
    setNotice(null);
  }

  function patchThread(id: string, patch: Partial<MockThread>) {
    setThreads((prev) =>
      prev.map((thread) =>
        thread.id === id ? { ...thread, ...patch } : thread,
      ),
    );
  }

  function setFollowUp(id: string, followUp: number | undefined) {
    const snapshot = threads.find((thread) => thread.id === id);
    if (!snapshot) return;

    patchThread(id, { followUp });
    setLandedId(id);
    announce(
      followUpLabel(followUp),
      followUp == null ? "cleared" : "moved",
      () => restore(snapshot),
    );
  }

  function dropOnHorizon(id: string, target: Placement) {
    const snapshot = threads.find((thread) => thread.id === id);
    if (!snapshot) return;
    if (placementOf(snapshot.followUp, now) === target) return;

    const landing =
      target === "none"
        ? undefined
        : horizons.find((horizon) => horizon.key === target)?.landing;
    if (target !== "none" && landing == null) return;

    setFollowUp(id, landing);
  }

  function completeNextMove(id: string) {
    const snapshot = threads.find((thread) => thread.id === id);
    if (!snapshot?.nextMove) return;

    patchThread(id, { nextMove: undefined });
    announce(`Next move done — ${snapshot.nextMove}`, "resolved", () =>
      restore(snapshot),
    );
  }

  function resolveThread(id: string) {
    const snapshot = threads.find((thread) => thread.id === id);
    if (!snapshot) return;

    setEditorId(null);
    setResolvingId(id);
    announce(`Resolved — ${snapshot.title}`, "resolved", () => {
      setResolvingId(null);
      restore(snapshot);
    });
  }

  function toggleArea(areaId: string) {
    setActiveAreas((prev) => {
      // All on: first click means "plan just this Area".
      if (prev.size === mockAreas.length) return new Set([areaId]);

      const next = new Set(prev);
      if (next.has(areaId)) next.delete(areaId);
      else next.add(areaId);

      return next.size === 0 ? new Set(mockAreas.map((area) => area.id)) : next;
    });
  }

  function onDragStart(event: DragStartEvent) {
    setEditorId(null);
    setDraggingId(String(event.active.id));
  }

  function onDragEnd(event: DragEndEvent) {
    setDraggingId(null);
    const target = event.over ? parseDropTarget(event.over.id) : undefined;
    if (target) dropOnHorizon(String(event.active.id), target);
  }

  function renderCard(thread: MockThread, placement: Placement, quiet = false) {
    return (
      <BoardCard
        key={thread.id}
        area={mockAreaById.get(thread.areaId)}
        editorOpen={editorId === thread.id}
        horizons={horizons}
        landed={landedId === thread.id}
        now={now}
        onCompleteNextMove={() => completeNextMove(thread.id)}
        onEditorOpenChange={(open) => setEditorId(open ? thread.id : null)}
        onResolve={() => resolveThread(thread.id)}
        onSetFollowUp={(followUp) => setFollowUp(thread.id, followUp)}
        onSetNextMove={(text) =>
          patchThread(thread.id, { nextMove: text || undefined })
        }
        placement={placement}
        quiet={quiet}
        resolving={resolvingId === thread.id}
        thread={thread}
      />
    );
  }

  const dragged = threads.find((thread) => thread.id === draggingId);

  return (
    <section className="relative flex flex-col gap-4">
      <BoardHeader
        collapseEmpty={collapseEmpty}
        counts={{
          overdue: overdue.length,
          total: visible.length,
          undated: undated.length,
        }}
        onToggleCollapse={() => setCollapseEmpty((value) => !value)}
      />

      <AreaFilter
        activeAreas={activeAreas}
        areas={mockAreas}
        counts={areaCounts}
        onReset={() =>
          setActiveAreas(new Set(mockAreas.map((area) => area.id)))
        }
        onToggle={toggleArea}
      />

      {threads.length === 0 ? (
        <BoardEmpty
          message="Every Thread is resolved. Nothing is waiting on you."
          title="Board clear"
        />
      ) : visible.length === 0 ? (
        <BoardEmpty
          message="No Threads in the Areas you're planning right now."
          title="Nothing in view"
        />
      ) : (
        <DndContext
          collisionDetection={collisionDetection}
          onDragCancel={() => setDraggingId(null)}
          onDragEnd={onDragEnd}
          onDragStart={onDragStart}
          sensors={sensors}
        >
          <div className="-mx-1 flex items-stretch gap-2.5 overflow-x-auto px-1 pb-1">
            {columns.map((horizon) => {
              const bucket = groups.get(horizon.key) ?? [];
              const isCollapsed = collapseEmpty && bucket.length === 0;

              return (
                <BoardColumn
                  key={horizon.key}
                  collapsed={isCollapsed}
                  count={bucket.length}
                  horizon={horizon}
                >
                  {bucket.map((thread) => renderCard(thread, horizon.key))}
                </BoardColumn>
              );
            })}
          </div>

          <NoDateTray count={undated.length}>
            {undated.map((thread) => renderCard(thread, "none", true))}
          </NoDateTray>

          <DragOverlay
            dropAnimation={{
              duration: 220,
              easing: "cubic-bezier(0.18, 0.89, 0.32, 1.28)",
            }}
          >
            {dragged && (
              <div className="w-52">
                <ThreadCard
                  area={mockAreaById.get(dragged.areaId)}
                  now={now}
                  overlay
                  placement={placementOf(dragged.followUp, now)}
                  thread={dragged}
                />
              </div>
            )}
          </DragOverlay>
        </DndContext>
      )}

      {notice && (
        <NoticePill notice={notice} onDismiss={() => setNotice(null)} />
      )}
    </section>
  );
}

function BoardHeader({
  collapseEmpty,
  counts,
  onToggleCollapse,
}: {
  collapseEmpty: boolean;
  counts: { overdue: number; total: number; undated: number };
  onToggleCollapse: () => void;
}) {
  return (
    <header className="flex flex-wrap items-end justify-between gap-x-6 gap-y-3">
      <div>
        <h2 className="font-heading text-lg font-semibold tracking-tight">
          Horizon
        </h2>
        <p className="mt-0.5 text-sm text-muted-foreground">
          Drag a Thread to change when you'll re-engage with it.
        </p>
      </div>

      <div className="flex items-end gap-5">
        <Stat label="On the board" value={counts.total} />
        <Stat label="Overdue" tone="attention" value={counts.overdue} />
        <Stat label="No date" value={counts.undated} />

        <button
          type="button"
          onClick={onToggleCollapse}
          aria-pressed={collapseEmpty}
          className={cn(
            "flex h-7 items-center gap-1.5 rounded-full px-2.5 text-[11px] font-medium ring-1 transition-colors",
            collapseEmpty
              ? "bg-surface-3 text-foreground ring-border"
              : "text-muted-foreground ring-border/50 hover:text-foreground",
          )}
        >
          {collapseEmpty ? (
            <EyeOff className="size-3" />
          ) : (
            <Eye className="size-3" />
          )}
          Hide empty
        </button>
      </div>
    </header>
  );
}

function Stat({
  label,
  tone,
  value,
}: {
  label: string;
  tone?: "attention";
  value: number;
}) {
  return (
    <div className="flex flex-col items-start">
      <span
        className={cn(
          "font-heading text-lg leading-none font-semibold tabular-nums",
          tone === "attention" && value > 0
            ? "text-condition-attention"
            : value === 0
              ? "text-muted-foreground/40"
              : "text-foreground",
        )}
      >
        {value}
      </span>
      <span className="mt-1 text-[10px] font-medium tracking-wider text-muted-foreground/70 uppercase">
        {label}
      </span>
    </div>
  );
}

function BoardEmpty({ message, title }: { message: string; title: string }) {
  return (
    <div className="flex min-h-64 flex-col items-center justify-center gap-1 rounded-xl border border-dashed border-border/70 px-6 text-center">
      <p className="font-heading text-sm font-semibold">{title}</p>
      <p className="max-w-sm text-xs text-muted-foreground">{message}</p>
    </div>
  );
}
