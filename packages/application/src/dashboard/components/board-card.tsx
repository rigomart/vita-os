import type { ReactNode } from "react";

import { cn } from "@vita-os/ui/lib/utils";
import { CalendarClock, Check } from "lucide-react";

import { WhenPopover } from "../../attention-list";
import { dateToken, dateToneClassName, dayDelta } from "./dashboard-model";

/** Held in place at rest, so the footer never reflows on hover. */
export const revealed =
  "opacity-0 group-focus-within/card:opacity-100 group-hover/card:opacity-100";

/**
 * The one shape every item on the board takes, Thread or Note: a quiet row
 * with no frame, filled only on hover, in three rows that never trade places.
 * The first two carry the words — the headline, then what is next — each with
 * the full width to itself. The third is the footer: when and where on the
 * left, the controls on the right.
 *
 * On the No date tray the row lifts to the page's surface instead of sinking
 * into the tray's fill.
 */
export function BoardCard({
  children,
  footer,
  late = false,
  onTray = false,
}: {
  children: ReactNode;
  footer: ReactNode;
  late?: boolean;
  onTray?: boolean;
}) {
  return (
    <div
      className={cn(
        "group/card relative flex flex-col gap-1 rounded-xl px-3 py-2.5 transition-colors",
        onTray
          ? "hover:bg-surface-2 has-focus-visible:bg-surface-2"
          : "hover:bg-muted/60 has-focus-visible:bg-muted/60",
        late && "bg-condition-attention/[0.06]",
      )}
    >
      {children}
      <div className="mt-0.5 flex min-h-6 items-center gap-1.5 text-[12px] leading-snug text-muted-foreground/75">
        {footer}
      </div>
    </div>
  );
}

/** What kind of thing or which Area, as a small muted pill in the footer. */
export function BoardTag({ icon, label }: { icon: ReactNode; label: string }) {
  return (
    <span
      title={label}
      className="inline-flex max-w-40 min-w-0 items-center gap-1 rounded-full bg-muted/70 px-1.5 py-px text-[11px] text-muted-foreground"
    >
      {icon}
      <span className="truncate">{label}</span>
    </span>
  );
}

/**
 * The item's date as a token that opens the picker. Undated, it is only a
 * revealed control, so `BoardCard` footers place it with the other controls.
 */
export function BoardDate({
  currentDate,
  labels,
  onSetWhen,
  when,
}: {
  currentDate: number;
  labels: { change: string; set: string };
  onSetWhen: (when: number | undefined) => void;
  when?: number;
}) {
  return (
    <WhenPopover
      when={when}
      onSetWhen={onSetWhen}
      trigger={
        when === undefined ? (
          <BoardControl className={revealed} label={labels.set}>
            <CalendarClock className="size-3.5" />
          </BoardControl>
        ) : (
          <button
            type="button"
            aria-label={labels.change}
            className={cn(
              "relative z-10 -mx-1 -my-0.5 inline-flex shrink-0 items-center gap-1 rounded-full px-1 py-0.5 tabular-nums transition-colors hover:bg-muted focus-visible:ring-2 focus-visible:ring-ring/40",
              dateToneClassName(when, currentDate),
            )}
          >
            <CalendarClock aria-hidden className="size-3" />
            {dateToken(when, currentDate)}
          </button>
        )
      }
    />
  );
}

/** The complete control both kinds of item share. */
export function BoardCompleteButton({
  label,
  onClick,
}: {
  label: string;
  onClick: () => void;
}) {
  return (
    <BoardControl
      label={label}
      onClick={onClick}
      className={cn(
        revealed,
        "bg-muted hover:bg-condition-healthy/15 hover:text-condition-healthy",
      )}
    >
      <Check className="size-3.5" />
    </BoardControl>
  );
}

export function BoardControl({
  children,
  className,
  label,
  onClick,
}: {
  children: ReactNode;
  className?: string;
  label: string;
  onClick?: () => void;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      onClick={onClick}
      className={cn(
        "relative z-10 -my-1 inline-flex size-6 shrink-0 items-center justify-center rounded-full text-muted-foreground transition-[color,background-color,transform,opacity] hover:bg-muted hover:text-foreground active:scale-90 focus-visible:ring-2 focus-visible:ring-ring/40",
        className,
      )}
    >
      {children}
    </button>
  );
}

export function isLate(when: number | undefined, currentDate: number) {
  return when !== undefined && dayDelta(when, currentDate) < 0;
}
