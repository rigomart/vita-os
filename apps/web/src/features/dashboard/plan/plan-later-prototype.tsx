/*
 * PROTOTYPE — throwaway. Four variants of the Later drop surface on the
 * existing dashboard route, switchable via ?variant=. Delete after a direction
 * is chosen.
 *
 * Nothing here is production code: no tests, no abstraction worth keeping, and
 * the variants deliberately share the shipped chip rendering so only the
 * *placement* of the Later target differs between them.
 */

import { useDroppable } from "@dnd-kit/core";
import { cn } from "@vita-os/ui/lib/utils";
import { ChevronLeft, ChevronRight, CalendarClock } from "lucide-react";
import { useEffect, useState } from "react";

import type { SlotDropData } from "./plan-axis";
import type { LaneChrome } from "./plan-lane";
import type { Lane, PlanItem } from "./plan-model";

import { PlanChip } from "./plan-chip";
import { bayWidth } from "./plan-model";

/* ------------------------------------------------------------- variants -- */

export const VARIANTS = ["current", "rail", "overlay", "tray"] as const;

export type PlanVariant = (typeof VARIANTS)[number];

const VARIANT_LABEL: Record<PlanVariant, string> = {
  current: "Both pools below (shipped)",
  overlay: "Drag-summoned right panel",
  rail: "Collapsible right rail",
  tray: "Smarter pools below",
};

/** `?variant=` — anything unrecognised falls back to the shipped layout. */
export function readVariant(): PlanVariant {
  if (typeof window === "undefined") return "current";
  const value = new URLSearchParams(window.location.search).get("variant");
  return VARIANTS.includes(value as PlanVariant)
    ? (value as PlanVariant)
    : "current";
}

function writeVariant(variant: PlanVariant) {
  const url = new URL(window.location.href);
  if (variant === "current") url.searchParams.delete("variant");
  else url.searchParams.set("variant", variant);
  window.history.replaceState(null, "", url);
}

/* ------------------------------------------------------------- switcher -- */

/**
 * The obviously-not-design pill: fixed bottom centre, arrows either side,
 * ArrowLeft/ArrowRight anywhere on the page. Never ships — it renders nothing
 * in a production build, and nothing under the test runner either, so the
 * shipped layout's tests see exactly the DOM they always saw.
 */
export function PrototypeSwitcher({
  onChange,
  variant,
}: {
  onChange: (variant: PlanVariant) => void;
  variant: PlanVariant;
}) {
  const hidden = import.meta.env.PROD || import.meta.env.MODE === "test";

  /** Cycles, wrapping at either end. */
  function move(by: number) {
    const next =
      VARIANTS[
        (VARIANTS.indexOf(variant) + by + VARIANTS.length) % VARIANTS.length
      ];
    writeVariant(next);
    onChange(next);
  }

  useEffect(() => {
    if (hidden) return;

    function onKey(event: KeyboardEvent) {
      if (event.key !== "ArrowLeft" && event.key !== "ArrowRight") return;
      const node = document.activeElement;
      if (
        node instanceof HTMLInputElement ||
        node instanceof HTMLTextAreaElement ||
        (node instanceof HTMLElement && node.isContentEditable)
      ) {
        return;
      }
      move(event.key === "ArrowLeft" ? -1 : 1);
    }

    window.addEventListener("keydown", onKey);
    // `move` is rebuilt every render; `variant` is what it closes over, so
    // re-subscribing on a variant change is the point.
    return () => window.removeEventListener("keydown", onKey);
  }, [hidden, onChange, variant]);

  if (hidden) return null;

  return (
    <div className="fixed bottom-4 left-1/2 z-[100] flex -translate-x-1/2 items-center gap-1 rounded-full border-2 border-yellow-400 bg-black/90 px-2 py-1 font-mono text-xs text-yellow-300 shadow-lg">
      <button
        type="button"
        aria-label="Previous prototype variant"
        className="rounded-full px-1 py-0.5 hover:bg-yellow-400/20"
        onClick={() => move(-1)}
      >
        <ChevronLeft className="size-4" />
      </button>
      <span className="px-1 whitespace-nowrap">
        PROTOTYPE · {variant} — {VARIANT_LABEL[variant]}
      </span>
      <button
        type="button"
        aria-label="Next prototype variant"
        className="rounded-full px-1 py-0.5 hover:bg-yellow-400/20"
        onClick={() => move(1)}
      >
        <ChevronRight className="size-4" />
      </button>
    </div>
  );
}

/* ---------------------------------------------------------------- parts -- */

interface PoolEntry {
  item: PlanItem;
  laneId: string;
}

/** Chips pooled out of the lanes, kept in lane order so groups read the same. */
function groupsOf(
  lanes: Lane[],
  pick: (lane: Lane) => PlanItem[],
): { entries: PoolEntry[]; laneId: string; name: string }[] {
  return lanes
    .map((lane) => ({
      entries: pick(lane).map((item) => ({ item, laneId: lane.id })),
      laneId: lane.id,
      name: lane.area?.name ?? "Inbox",
    }))
    .filter((group) => group.entries.length > 0);
}

function countOf(groups: { entries: PoolEntry[] }[]): number {
  return groups.reduce((sum, group) => sum + group.entries.length, 0);
}

function GroupLabel({ children }: { children: string }) {
  return (
    <span className="block text-2xs font-semibold tracking-[0.08em] text-muted-foreground/60 uppercase">
      {children}
    </span>
  );
}

/* ----------------------------------------------------------------- rail -- */

/**
 * **rail** — a collapsible strip beside the day scroller. Collapsed it is a
 * 40px spine; a drag (or the chevron) opens it to 230px, so the Later target is
 * always at the same screen edge however far the canvas has scrolled.
 */
export function LaterRail({
  chrome,
  lanes,
}: {
  chrome: LaneChrome;
  lanes: Lane[];
}) {
  const { density, drag, now, onOpen } = chrome;
  const [pinned, setPinned] = useState(false);

  const { isOver, setNodeRef } = useDroppable({
    id: "bucket::beyond",
    data: { slotKey: "beyond" } satisfies SlotDropData,
  });

  const groups = groupsOf(lanes, (lane) => lane.beyond);
  const count = countOf(groups);
  const open = pinned || drag != null;
  const armed = drag != null && isOver;

  return (
    <div
      ref={setNodeRef}
      role="group"
      aria-label="Later"
      data-slot-key="beyond"
      className={cn(
        "relative shrink-0 self-stretch overflow-y-auto rounded-xl border border-dashed border-border bg-surface-2/60 transition-all",
        armed && "border-solid border-foreground/40 bg-surface-3/70",
      )}
      style={{ width: open ? 230 : 40 }}
    >
      {open ? (
        <div className="p-2">
          <div className="mb-2 flex items-baseline gap-1.5">
            <span className="text-2xs font-semibold tracking-[0.08em] text-muted-foreground/70 uppercase">
              Later
            </span>
            <span className="text-xs tabular-nums text-muted-foreground/70">
              {count}
            </span>
            <button
              type="button"
              aria-label="Unpin the Later rail"
              className="ml-auto text-muted-foreground/60 hover:text-foreground"
              onClick={() => setPinned(false)}
            >
              <ChevronRight className="size-3.5" />
            </button>
          </div>

          {count === 0 ? (
            <p className="text-xs text-muted-foreground/45">
              Nothing further out
            </p>
          ) : (
            <div className="flex flex-col gap-2">
              {groups.map((group) => (
                <div key={group.laneId} className="flex flex-col gap-1">
                  <GroupLabel>{group.name}</GroupLabel>
                  {group.entries.map(({ item, laneId }) => (
                    <PlanChip
                      key={item.id}
                      density={density}
                      item={item}
                      laneId={laneId}
                      now={now}
                      onOpen={onOpen}
                      slotKey="beyond"
                    />
                  ))}
                </div>
              ))}
            </div>
          )}
        </div>
      ) : (
        <button
          type="button"
          aria-label="Pin the Later rail open"
          className="flex h-full w-full flex-col items-center gap-2 py-2 text-muted-foreground/70 hover:text-foreground"
          onClick={() => setPinned(true)}
        >
          <ChevronLeft className="size-3.5" />
          <span className="text-xs tabular-nums">{count}</span>
          <span className="mt-1 text-2xs font-semibold tracking-[0.12em] uppercase [writing-mode:vertical-rl]">
            Later
          </span>
        </button>
      )}
    </div>
  );
}

/* -------------------------------------------------------------- overlay -- */

/**
 * **overlay** — the canvas keeps its two pools, and a drop zone is *summoned*
 * by the drag itself: a panel pinned to the right edge of the viewport for as
 * long as a chip is in the air.
 */
export function LaterOverlay({ dragging }: { dragging: boolean }) {
  const { isOver, setNodeRef } = useDroppable({
    id: "overlay::beyond",
    data: { slotKey: "beyond" } satisfies SlotDropData,
  });

  // Mounted the whole time, invisible until a chip is in the air: dnd-kit
  // measures droppables as the drag starts, and a node that appears in that
  // same frame can miss the measuring pass.
  return (
    <div
      ref={setNodeRef}
      role="group"
      aria-label="Later"
      data-slot-key="beyond"
      className={cn(
        "fixed top-1/2 right-3 z-50 flex h-[40vh] w-[150px] -translate-y-1/2 flex-col items-center justify-center gap-2 rounded-2xl border-2 border-dashed border-border bg-surface-2/85 p-3 text-center backdrop-blur-sm transition-all",
        dragging ? "opacity-100" : "pointer-events-none opacity-0",
        isOver && "border-solid border-foreground/50 bg-surface-3/90",
      )}
    >
      <CalendarClock className="size-5 text-muted-foreground/70" />
      <span className="text-2xs font-semibold tracking-[0.08em] text-muted-foreground/70 uppercase">
        Later
      </span>
      <span className="text-xs text-muted-foreground/60">
        Drop to pick a further day
      </span>
    </div>
  );
}

/* ----------------------------------------------------------------- tray -- */

/**
 * **tray** — the shipped pools, sharpened: each hides when it is empty and only
 * reappears as a target while a drag is live, the Later pool names the horizon
 * it starts after, and its chips group by Area.
 */
export function TrayPool({
  chrome,
  empty,
  hint,
  label,
  lanes,
  note,
  pick,
  slotKey,
}: {
  chrome: LaneChrome;
  empty: string;
  hint: string;
  label: string;
  lanes: Lane[];
  /** The Later pool names where it begins, e.g. "after Thu 3 Sep". */
  note?: string;
  pick: (lane: Lane) => PlanItem[];
  slotKey: string;
}) {
  const { density, drag, now, onOpen } = chrome;

  const { isOver, setNodeRef } = useDroppable({
    id: `bucket::${slotKey}`,
    data: { slotKey } satisfies SlotDropData,
  });

  const groups = groupsOf(lanes, pick);
  const count = countOf(groups);
  const dragging = drag != null;
  const armed = dragging && isOver;

  // Empty and nothing in the air: the pool is not worth the room it takes.
  if (count === 0 && !dragging) return null;

  return (
    <div
      ref={setNodeRef}
      role="group"
      aria-label={label}
      data-slot-key={slotKey}
      className={cn(
        "relative min-w-0 rounded-xl border border-dashed border-border bg-surface-2/60 transition-colors",
        density === "compact" ? "p-2.5" : "p-3",
        dragging && "border-foreground/25 ring-1 ring-foreground/20",
        armed && "border-solid border-foreground/40 bg-surface-3/70 ring-2",
      )}
    >
      <div className="mb-2 flex items-baseline gap-1.5">
        <span className="text-2xs font-semibold tracking-[0.08em] text-muted-foreground/70 uppercase">
          {label}
        </span>
        <span className="text-xs tabular-nums text-muted-foreground/70">
          {count}
        </span>
        {note != null && (
          <span className="text-xs text-muted-foreground/50">{note}</span>
        )}
        <span className="ml-2 truncate text-xs text-muted-foreground/50">
          {hint}
        </span>
      </div>

      {count === 0 ? (
        <p className="text-xs text-muted-foreground/45">{empty}</p>
      ) : (
        <div className="flex flex-col gap-2">
          {groups.map((group) => (
            <div key={group.laneId} className="flex flex-col gap-1">
              <GroupLabel>{group.name}</GroupLabel>
              <div
                className={cn(
                  "flex flex-wrap",
                  density === "compact" ? "gap-1.5" : "gap-2",
                )}
              >
                {group.entries.map(({ item, laneId }) => (
                  <div key={item.id} style={{ width: bayWidth(density) }}>
                    <PlanChip
                      density={density}
                      item={item}
                      laneId={laneId}
                      now={now}
                      onOpen={onOpen}
                      slotKey={slotKey}
                    />
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
