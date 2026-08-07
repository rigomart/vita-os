import { cn } from "@vita-os/ui/lib/utils";
import {
  CalendarCheck,
  CalendarOff,
  CircleCheckBig,
  Undo2,
  X,
} from "lucide-react";

import { AreaIcon } from "@/features/areas/components/area-icon";

import type { MockArea } from "../mock-data";

export interface AreaFilterProps {
  /** Areas currently shown. Resetting turns them all back on. */
  activeAreas: ReadonlySet<string>;
  areas: MockArea[];
  counts: ReadonlyMap<string, number>;
  onReset: () => void;
  onToggle: (areaId: string) => void;
}

/** Chip row for planning one life Area at a time. */

export function AreaFilter({
  activeAreas,
  areas,
  counts,
  onReset,
  onToggle,
}: AreaFilterProps) {
  const allActive = activeAreas.size === areas.length;

  return (
    <div className="flex flex-wrap items-center gap-1.5">
      <button
        type="button"
        onClick={onReset}
        aria-pressed={allActive}
        className={cn(
          "h-7 rounded-full px-2.5 text-[11px] font-medium transition-colors",
          allActive
            ? "bg-foreground text-surface-1"
            : "bg-surface-3 text-muted-foreground hover:text-foreground",
        )}
      >
        All areas
      </button>

      {areas.map((area) => {
        const active = activeAreas.has(area.id);
        const count = counts.get(area.id) ?? 0;

        return (
          <button
            key={area.id}
            type="button"
            onClick={() => onToggle(area.id)}
            aria-pressed={active}
            className={cn(
              "flex h-7 items-center gap-1.5 rounded-full px-2.5 text-[11px] font-medium ring-1 transition-colors",
              active
                ? "bg-surface-2 text-foreground ring-border"
                : "bg-transparent text-muted-foreground/45 ring-border/40 hover:text-muted-foreground",
            )}
          >
            <AreaIcon
              icon={area.icon}
              className={cn("size-3", !active && "opacity-50")}
            />
            <span>{area.name}</span>
            <span
              className={cn(
                "tabular-nums",
                active ? "text-muted-foreground" : "text-muted-foreground/40",
              )}
            >
              {count}
            </span>
          </button>
        );
      })}
    </div>
  );
}

export type NoticeTone = "cleared" | "moved" | "resolved";

export interface BoardNotice {
  id: number;
  /** Present when the action can be reversed. */
  onUndo?: () => void;
  text: string;
  tone: NoticeTone;
}

const noticeIcon: Record<NoticeTone, typeof Undo2> = {
  cleared: CalendarOff,
  moved: CalendarCheck,
  resolved: CircleCheckBig,
};

/**
 * Confirmation for the last board action. It stays until dismissed: an Undo
 * that expires on a timer is an Undo you cannot rely on.
 */
export function NoticePill({
  notice,
  onDismiss,
}: {
  notice: BoardNotice;
  onDismiss: () => void;
}) {
  const Icon = noticeIcon[notice.tone];

  return (
    <div
      role="status"
      aria-live="polite"
      className="pointer-events-none fixed inset-x-0 bottom-6 z-50 flex justify-center px-4"
    >
      <div
        key={notice.id}
        className="pointer-events-auto flex max-w-[min(90vw,28rem)] items-center gap-2.5 rounded-full bg-foreground py-1.5 pr-1.5 pl-3.5 shadow-lg duration-200 animate-in fade-in slide-in-from-bottom-2"
      >
        <Icon className="size-3.5 shrink-0 text-surface-1/60" />
        <span className="truncate text-[12px] font-medium text-surface-1 tabular-nums">
          {notice.text}
        </span>
        {notice.onUndo && (
          <button
            type="button"
            onClick={notice.onUndo}
            className="flex items-center gap-1 rounded-full bg-surface-1/10 px-2.5 py-1 text-[11px] font-medium text-surface-1 transition-colors hover:bg-surface-1/20"
          >
            <Undo2 className="size-3" />
            Undo
          </button>
        )}
        <button
          type="button"
          onClick={onDismiss}
          aria-label="Dismiss"
          className="flex size-6 shrink-0 items-center justify-center rounded-full text-surface-1/60 transition-colors hover:bg-surface-1/10 hover:text-surface-1"
        >
          <X className="size-3.5" />
        </button>
      </div>
    </div>
  );
}
