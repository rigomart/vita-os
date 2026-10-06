import type { Repeat } from "@vita-os/contracts";
import type { LucideIcon } from "lucide-react";
import type { ReactElement, ReactNode } from "react";

import { Link } from "@tanstack/react-router";
import { timeOfDay, withTimeOfDay } from "@vita-os/core";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@vita-os/ui/components/alert-dialog";
import { Button } from "@vita-os/ui/components/button";
import { Calendar } from "@vita-os/ui/components/calendar";
import { Checkbox } from "@vita-os/ui/components/checkbox";
import { Input } from "@vita-os/ui/components/input";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@vita-os/ui/components/popover";
import { cn } from "@vita-os/ui/lib/utils";
import {
  Clock,
  Minus,
  Plus,
  Repeat as RepeatIcon,
  Trash2,
  X,
} from "lucide-react";
import { useEffect, useRef, useState } from "react";

import type { ProductSearch } from "../navigation/search-params";
import type { AttentionRowModel } from "./attention-row-model";
import type { RepeatDraft } from "./repeat";

import { AreaIcon } from "../areas/components/area-icon";
import { browserTimeZone } from "../lib/time-zone";
import { followUpDateLabels } from "./follow-up-date";
import {
  draftRepeat,
  MAX_REPEAT_DAYS,
  repeatDraft,
  repeatSummary,
  sameRepeat,
  WEEKDAYS,
} from "./repeat";

export function RowShell({
  children,
  className,
  row,
}: {
  children: ReactNode;
  className?: string;
  row: AttentionRowModel;
}) {
  const linkTo = row.linkTo;
  if (!linkTo) {
    return <div className={className}>{children}</div>;
  }

  return (
    <Link
      to="."
      search={(prev: ProductSearch): ProductSearch => ({
        ...prev,
        thread: linkTo.threadSlug,
      })}
      className={cn("outline-none", className)}
    >
      {children}
    </Link>
  );
}

export function RowCheckbox({
  className,
  row,
}: {
  className?: string;
  row: AttentionRowModel;
}) {
  return (
    <Checkbox
      checked={row.done ?? false}
      onCheckedChange={() => {
        if (!row.toggleBusy) row.onToggleDone?.();
      }}
      disabled={row.toggleBusy}
      aria-busy={row.toggleBusy}
      aria-label={row.done ? "Mark note open" : "Mark note done"}
      className={cn("border-border/80 bg-surface-1", className)}
    />
  );
}

export function AreaTag({
  area,
  className,
  iconClassName,
}: {
  area: NonNullable<AttentionRowModel["area"]>;
  className?: string;
  iconClassName?: string;
}) {
  return (
    <span className={cn("inline-flex min-w-0 items-center gap-1", className)}>
      <AreaIcon
        icon={area.icon}
        className={cn("size-3 shrink-0", iconClassName)}
      />
      <span className="truncate">{area.name}</span>
    </span>
  );
}

/**
 * A Task's Repeat, edited in its date picker. `onChange(null)` clears it.
 */
export interface RepeatControl {
  value: Repeat | undefined;
  onChange: (repeat: Repeat | null) => void;
}

/**
 * The picker every When shares: a day, and optionally a time on it.
 *
 * The time stays behind an Add time button until asked for, then is typed
 * rather than picked. Picking a day saves at once, carrying whatever time is
 * typed. A time typed
 * for a day already chosen waits until the popover closes — Enter closes it —
 * so editing it writes one change, not one per keystroke. The time only
 * orders a day's items; it never moves one to another day or column.
 *
 * A Task's picker (`repeat`) also holds its Repeat, under the time, and
 * closes with Done. The Repeat choice is saved when the picker closes, like
 * the time, and before a newly picked day, so the day is judged by the rhythm
 * on screen: a weekly one moves it to the first chosen day. With no day the
 * choices are disabled; clearing the date clears the Repeat too.
 */
export function WhenPopover({
  busy,
  clearLabel = followUpDateLabels.clear,
  hint = followUpDateLabels.hint,
  keepOpenOnPick = false,
  onSetWhen,
  repeat,
  trigger,
  when,
}: {
  busy?: boolean;
  /** What the button that removes the date says. */
  clearLabel?: string;
  /** A line above the calendar saying what the date means. */
  hint?: string;
  /**
   * Picking a day saves it and leaves the picker open, so a Repeat can follow
   * it. Only where the trigger stays put when the date changes: a card moves
   * to its new day's heading, and its picker closes as it always has.
   */
  keepOpenOnPick?: boolean;
  onSetWhen?: (when: number | undefined) => void;
  /** A Task's Repeat; without it the picker holds a date alone. */
  repeat?: RepeatControl;
  trigger: ReactElement;
  when?: number;
}) {
  const [open, setOpen] = useState(false);
  const [time, setTime] = useState("");
  const [addingTime, setAddingTime] = useState(false);
  const [draft, setDraft] = useState<RepeatDraft>(() =>
    repeatDraft(repeat?.value),
  );
  const selected = when === undefined ? undefined : new Date(when);
  const savedTime = when === undefined ? "" : (timeOfDay(when) ?? "");

  /** Saves the Repeat choice, if it is a whole one and differs from the Task's. */
  function commitRepeat() {
    if (repeat === undefined || when === undefined || busy) return;
    const chosen = draftRepeat(draft);
    if (chosen !== undefined && !sameRepeat(chosen, repeat.value)) {
      repeat.onChange(chosen);
    }
  }

  /** What closing saves: the Repeat choice, then a time typed for the day. */
  function saveDrafts() {
    commitRepeat();
    if (when !== undefined && time !== savedTime && !busy) {
      onSetWhen?.(withTimeOfDay(when, time));
    }
  }

  // A picker that goes away while open — the surface navigates away or
  // unmounts — saves its drafts as closing it would. `openNow` is cleared the
  // moment the picker closes, so a close and an unmount never both save.
  const openNow = useRef(false);
  const saveOnUnmount = useRef(saveDrafts);
  useEffect(() => {
    saveOnUnmount.current = saveDrafts;
  });
  useEffect(
    () => () => {
      if (openNow.current) {
        openNow.current = false;
        saveOnUnmount.current();
      }
    },
    [],
  );

  function handleOpenChange(next: boolean) {
    if (next) {
      setTime(savedTime);
      setAddingTime(savedTime !== "");
      setDraft(repeatDraft(repeat?.value));
    } else if (openNow.current) {
      saveDrafts();
    }
    openNow.current = next;
    setOpen(next);
  }

  return (
    <Popover open={open} onOpenChange={handleOpenChange}>
      <PopoverTrigger render={trigger} />
      <PopoverContent className="w-auto gap-0 p-0" align="end">
        {hint && (
          <p className="max-w-56 border-b border-border/60 px-3 py-2 text-xs leading-snug text-muted-foreground">
            {hint}
          </p>
        )}
        <Calendar
          mode="single"
          selected={selected}
          defaultMonth={selected}
          disabled={busy}
          onSelect={(date) => {
            if (!date || busy) return;
            commitRepeat();
            onSetWhen?.(withTimeOfDay(date.getTime(), time));
            if (!keepOpenOnPick) {
              openNow.current = false;
              setOpen(false);
            }
          }}
        />
        <div className="border-t border-border/60 p-2">
          {addingTime ? (
            <div className="flex items-center gap-1.5">
              <Input
                type="time"
                aria-label="Time"
                autoFocus
                value={time}
                disabled={busy}
                onChange={(event) => setTime(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key !== "Enter") return;
                  event.preventDefault();
                  handleOpenChange(false);
                }}
                // Typed, never picked: the browser's own time dropdown is hidden.
                className="h-8 flex-1 appearance-none rounded-lg bg-background px-2.5 text-sm tabular-nums [&::-webkit-calendar-picker-indicator]:hidden [&::-webkit-calendar-picker-indicator]:appearance-none"
              />
              <Button
                type="button"
                variant="ghost"
                size="icon-sm"
                aria-label="Remove time"
                disabled={busy}
                onClick={() => {
                  setTime("");
                  setAddingTime(false);
                }}
                className="text-muted-foreground"
              >
                <X />
              </Button>
            </div>
          ) : (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              disabled={busy}
              onClick={() => setAddingTime(true)}
              className="w-full justify-start text-muted-foreground"
            >
              <Clock />
              Add time
            </Button>
          )}
        </div>
        {repeat !== undefined && (
          <RepeatSection
            disabled={busy || when === undefined}
            draft={draft}
            onDraftChange={setDraft}
            when={when}
          />
        )}
        {(selected || repeat !== undefined) && (
          <div className="flex items-center gap-1 border-t border-border/60 p-2">
            {selected && (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="flex-1 justify-start text-muted-foreground"
                disabled={busy}
                onClick={() => {
                  if (busy) return;
                  onSetWhen?.(undefined);
                  openNow.current = false;
                  setOpen(false);
                }}
              >
                {clearLabel}
              </Button>
            )}
            {repeat !== undefined && (
              <Button
                type="button"
                size="sm"
                className="ml-auto"
                onClick={() => handleOpenChange(false)}
              >
                Done
              </Button>
            )}
          </div>
        )}
      </PopoverContent>
    </Popover>
  );
}

const REPEAT_MODES = [
  { mode: "never", label: "Never" },
  { mode: "daily", label: "Daily" },
  { mode: "everyN", label: "Every N days" },
  { mode: "weekly", label: "Weekly" },
] as const;

/**
 * The Repeat choices under a Task's date: Never, Daily, Every N days with a
 * stepper, or Weekly with a toggle per weekday, and one line saying what the
 * Task will do. Choosing Weekly starts from the date's own weekday, so the
 * date stays where it is until another day is chosen.
 */
function RepeatSection({
  disabled,
  draft,
  onDraftChange,
  when,
}: {
  disabled: boolean;
  draft: RepeatDraft;
  onDraftChange: (draft: RepeatDraft) => void;
  when?: number;
}) {
  const choose = (mode: RepeatDraft["mode"]) => {
    if (mode === draft.mode) return;
    if (mode === "everyN") onDraftChange({ mode, every: 2 });
    else if (mode === "weekly") {
      onDraftChange({
        mode,
        weekdays: when === undefined ? [] : [new Date(when).getDay()],
      });
    } else onDraftChange({ mode });
  };

  return (
    <div
      role="group"
      aria-label="Repeat"
      aria-disabled={disabled || undefined}
      // Takes the calendar's width rather than widening the picker.
      className="flex w-0 min-w-full flex-col gap-2 border-t border-border/60 p-2"
    >
      <div className="flex items-center gap-1.5 px-1 text-xs font-medium text-muted-foreground">
        <RepeatIcon aria-hidden className="size-3.5" />
        Repeat
      </div>
      <div className="grid grid-cols-2 gap-0.5 rounded-lg bg-muted p-0.5">
        {REPEAT_MODES.map(({ mode, label }) => {
          const pressed = !disabled && draft.mode === mode;
          return (
            <button
              key={mode}
              type="button"
              aria-pressed={pressed}
              disabled={disabled}
              onClick={() => choose(mode)}
              className={cn(
                "h-7 rounded-md px-2 text-xs font-medium text-muted-foreground transition-colors outline-none hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring/40 disabled:pointer-events-none disabled:opacity-50",
                pressed && "bg-background text-foreground shadow-xs",
              )}
            >
              {label}
            </button>
          );
        })}
      </div>

      {!disabled && draft.mode === "everyN" && (
        <div className="flex items-center gap-2 px-1 text-xs">
          Every
          <Button
            type="button"
            variant="outline"
            size="icon-xs"
            aria-label="Fewer days"
            disabled={draft.every <= 1}
            onClick={() =>
              onDraftChange({ mode: "everyN", every: draft.every - 1 })
            }
          >
            <Minus />
          </Button>
          <span className="min-w-6 text-center font-medium tabular-nums">
            {draft.every}
          </span>
          <Button
            type="button"
            variant="outline"
            size="icon-xs"
            aria-label="More days"
            disabled={draft.every >= MAX_REPEAT_DAYS}
            onClick={() =>
              onDraftChange({ mode: "everyN", every: draft.every + 1 })
            }
          >
            <Plus />
          </Button>
          days
        </div>
      )}

      {!disabled && draft.mode === "weekly" && (
        <div className="flex items-center justify-between px-0.5">
          {WEEKDAYS.map(({ day, name, letter }) => {
            const chosen = draft.weekdays.includes(day);
            return (
              <button
                key={day}
                type="button"
                aria-pressed={chosen}
                aria-label={name}
                title={name}
                onClick={() =>
                  onDraftChange({
                    mode: "weekly",
                    weekdays: chosen
                      ? draft.weekdays.filter((other) => other !== day)
                      : [...draft.weekdays, day],
                  })
                }
                className={cn(
                  "flex size-7 items-center justify-center rounded-full border text-xs font-medium transition-colors outline-none focus-visible:ring-2 focus-visible:ring-ring/40",
                  chosen
                    ? "border-primary bg-primary text-primary-foreground"
                    : "border-border bg-background text-muted-foreground hover:text-foreground",
                )}
              >
                {letter}
              </button>
            );
          })}
        </div>
      )}

      <p
        aria-live="polite"
        className="px-1 text-xs leading-snug text-muted-foreground"
      >
        {repeatSummary(when, draft, browserTimeZone())}
      </p>
    </div>
  );
}

export function RowIconAction({
  icon: Icon,
  label,
  onSelect,
}: {
  icon: LucideIcon;
  label: string;
  onSelect: () => void;
}) {
  return (
    <Button
      variant="ghost"
      size="icon-xs"
      aria-label={label}
      onClick={onSelect}
      className="text-muted-foreground"
    >
      <Icon />
    </Button>
  );
}

export function RowDeleteAction({
  busy,
  confirmLabel,
  description,
  label,
  onConfirm,
  title,
}: {
  busy?: boolean;
  confirmLabel: string;
  description: string;
  label: string;
  onConfirm: () => void;
  title: string;
}) {
  return (
    <AlertDialog>
      <AlertDialogTrigger
        render={
          <Button
            variant="ghost"
            size="icon-xs"
            aria-label={label}
            className="text-muted-foreground"
          />
        }
      >
        <Trash2 />
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{title}</AlertDialogTitle>
          <AlertDialogDescription>{description}</AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Cancel</AlertDialogCancel>
          <AlertDialogAction
            onClick={onConfirm}
            disabled={busy}
            aria-busy={busy}
            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
          >
            {confirmLabel}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
