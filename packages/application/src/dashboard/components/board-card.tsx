import type { ReactNode } from "react";

import { cn } from "@vita-os/ui/lib/utils";
import { CalendarClock, Check } from "lucide-react";

import {
  followUpDateLabels,
  type RepeatControl,
  timeToken,
  WhenPopover,
  withTimeToken,
} from "../../attention-list";
import { dateToken, dateToneClassName, dayDelta } from "./dashboard-model";

/** Held in place at rest, so the footer never reflows on hover. */
export const revealed =
  "opacity-0 group-focus-within/card:opacity-100 group-hover/card:opacity-100";

/** The other half of `revealed`: shown at rest, handing its place to controls. */
export const concealed =
  "transition-opacity group-focus-within/card:opacity-0 group-hover/card:opacity-0";

/**
 * The one shape every item on the board takes, Thread or Note: a sheet with an
 * edge of its own, filed on its group's fill like a sheet in a folder, in
 * three rows that never trade places. The first two carry the words — the
 * headline, then what is next — each with the full width to itself. The third
 * is the footer: when and where on the left, the controls on the right.
 *
 * A card fills the height of its row, with the footer held to the bottom, so
 * two cards side by side end together and their footers line up.
 *
 * A late card carries a faint warm tint, unless it sits on Late's fill
 * (`onLateFill`), which already says so.
 *
 * A `dogEared` card has its top right corner folded over: the mark of a scrap
 * someone wrote, where a pill would read as one more Area.
 */
export function BoardCard({
  children,
  footer,
  late = false,
  onLateFill = false,
  dogEared = false,
}: {
  children: ReactNode;
  footer: ReactNode;
  late?: boolean;
  onLateFill?: boolean;
  dogEared?: boolean;
}) {
  return (
    <div
      className={cn(
        "group/card relative flex h-full flex-col gap-1 rounded-xl border border-border/80 bg-card px-3 py-2.5 transition-colors",
        "hover:border-foreground/15 has-focus-visible:border-ring/50",
        late &&
          !onLateFill &&
          "bg-[color-mix(in_oklab,var(--color-condition-attention)_7%,var(--color-card))]",
        // The corner is cut away, and the fold drawn over the cut.
        dogEared &&
          "[clip-path:polygon(0_0,calc(100%-18px)_0,100%_18px,100%_100%,0_100%)]",
      )}
    >
      {dogEared && (
        <span
          aria-hidden
          className="absolute top-0 right-0 size-[18px] rounded-bl-[4px] bg-[linear-gradient(to_bottom_left,transparent_calc(50%-0.5px),var(--color-border)_50%,var(--color-surface-3)_calc(50%+0.5px))]"
        />
      )}
      {children}
      <div className="mt-auto flex min-h-6 items-center gap-1.5 pt-0.5 text-[12px] leading-snug text-muted-foreground/75">
        {footer}
      </div>
    </div>
  );
}

/** Which Area, as a small muted pill in the footer. */
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
 * The item's date as a token that opens the picker. Undated — or dated under
 * a heading that already names its day, with no time to add — it is only a
 * revealed control, so `BoardCard` footers place it with the other controls.
 * Under such a heading a time is all the token says.
 */
export function BoardDate({
  busy,
  currentDate,
  inHeading = false,
  labels = followUpDateLabels,
  onSetWhen,
  repeat,
  when,
}: {
  busy?: boolean;
  currentDate: number;
  inHeading?: boolean;
  /** What the control is called: a Note's Follow-up date, or a Task's date. */
  labels?: { set: string; change: string; clear: string };
  onSetWhen: (when: number | undefined) => unknown;
  /** A Task's Repeat, held in the same picker. */
  repeat?: RepeatControl;
  when?: number;
}) {
  return (
    <WhenPopover
      busy={busy}
      when={when}
      {...(repeat === undefined ? {} : { repeat })}
      clearLabel={labels.clear}
      onSetWhen={onSetWhen}
      trigger={
        when === undefined || !showsBoardDate(when, inHeading) ? (
          <BoardControl
            disabled={busy}
            className={revealed}
            label={when === undefined ? labels.set : labels.change}
          >
            <CalendarClock className="size-3.5" />
          </BoardControl>
        ) : (
          <button
            disabled={busy}
            type="button"
            aria-label={labels.change}
            className={cn(
              "relative z-10 -mx-1 -my-0.5 inline-flex shrink-0 items-center gap-1 rounded-full px-1 py-0.5 tabular-nums transition-colors hover:bg-muted focus-visible:ring-2 focus-visible:ring-ring/40",
              dateToneClassName(when, currentDate),
            )}
          >
            <CalendarClock aria-hidden className="size-3" />
            {inHeading
              ? timeToken(when)
              : withTimeToken(dateToken(when, currentDate), when)}
          </button>
        )
      }
    />
  );
}

/**
 * Whether a card's date reads as a token at the left of its footer: a dated
 * item does unless its heading already names the day and it has no time.
 */
export function showsBoardDate(
  when: number | undefined,
  inHeading: boolean,
): when is number {
  if (when === undefined) return false;
  return !inHeading || timeToken(when) !== undefined;
}

/**
 * The control that takes an item off the board: completing a Thread's Task,
 * or archiving a Note.
 */
export function BoardCompleteButton({
  icon: Icon = Check,
  label,
  onClick,
  disabled,
}: {
  icon?: typeof Check;
  label: string;
  onClick: () => void;
  disabled?: boolean;
}) {
  return (
    <BoardControl
      label={label}
      disabled={disabled}
      onClick={onClick}
      className={cn(
        revealed,
        "bg-muted hover:bg-condition-healthy/15 hover:text-condition-healthy",
      )}
    >
      <Icon className="size-3.5" />
    </BoardControl>
  );
}

export function BoardControl({
  children,
  className,
  label,
  onClick,
  disabled,
}: {
  children: ReactNode;
  className?: string;
  label: string;
  onClick?: () => void;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      disabled={disabled}
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
