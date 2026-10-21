import type { Repeat } from "@vita-os/contracts";
import type { ReactElement, ReactNode } from "react";

import {
  snapTaskDate,
  startOfLocalDay,
  timeOfDay,
  withTimeOfDay,
} from "@vita-os/core";
import { Button } from "@vita-os/ui/components/button";
import { Calendar } from "@vita-os/ui/components/calendar";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@vita-os/ui/components/popover";
import { cn } from "@vita-os/ui/lib/utils";
import { format } from "date-fns";
import {
  CalendarDays,
  Check,
  ChevronLeft,
  ChevronRight,
  Clock,
  Minus,
  Plus,
  Repeat as RepeatIcon,
  X,
} from "lucide-react";
import { useState } from "react";

import type { RepeatDraft } from "./repeat";

import { clock } from "../lib/clock";
import { browserTimeZone } from "../lib/time-zone";
import { timeToken, withTimeToken } from "./date-parts";
import { followUpDateLabels } from "./follow-up-date";
import { CHIP_TIMES, onDay, quickPicks, timeSuggestions } from "./quick-picks";
import {
  draftRepeat,
  MAX_REPEAT_DAYS,
  repeatDraft,
  repeatPresets,
  repeatShortLabel,
  repeatSummary,
  sameRepeat,
  WEEKDAYS,
} from "./repeat";

/**
 * A Task's or Standalone Note's Repeat, edited in its date picker.
 * `onChange(null)` clears it.
 */
export interface RepeatControl {
  value: Repeat | undefined;
  onChange: (repeat: Repeat | null) => unknown;
}

type Page = "menu" | "calendar" | "time" | "repeat" | "custom-repeat";

/** `HH:mm` as a card writes it: 9 AM, 7:45 PM. */
const timeLabel = (time: string) =>
  timeToken(withTimeOfDay(clock.now(), time)) ?? time;

/**
 * The picker every When shares (ADR 0040): a menu of the days a When is most
 * often set to, each with the day it lands on, then Pick a date…, the time as
 * chips, and for a Task or a Standalone Note its Repeat. The calendar, a typed time, and the
 * Repeat's choices replace the menu in place and come back with ←, so the
 * picker is never taller than a calendar.
 *
 * Every choice saves as it is made, and the picker moves on without waiting;
 * `busy` holds its controls while a write is in flight, so one choice never
 * overtakes another. A choice closes it unless `keepOpenOnPick`, which keeps
 * it open on its menu for the next. With no day yet, the time and the Repeat
 * wait for one.
 */
export function WhenPopover({
  busy,
  clearLabel = followUpDateLabels.clear,
  keepOpenOnPick = false,
  onSetWhen,
  repeat,
  trigger,
  when,
}: {
  busy?: boolean;
  /** What the row that removes the date says. */
  clearLabel?: string;
  /**
   * A choice leaves the picker open, on its menu. Only where the trigger stays
   * put when the When changes: a card moves to its new day's heading, or
   * trades its date control for a time token, so its picker closes.
   */
  keepOpenOnPick?: boolean;
  onSetWhen?: (when: number | undefined) => unknown;
  /** The date's Repeat; without it the picker holds a date alone. */
  repeat?: RepeatControl;
  trigger: ReactElement;
  when?: number;
}) {
  const [open, setOpen] = useState(false);
  const [page, setPage] = useState<Page>("menu");
  const time = when === undefined ? undefined : timeOfDay(when);
  const now = clock.now();

  function moveOn() {
    if (keepOpenOnPick) setPage("menu");
    else setOpen(false);
  }
  function pickDay(day: number) {
    if (busy) return;
    void onSetWhen?.(onDay(day, when));
    moveOn();
  }
  function pickTime(next: string | undefined) {
    if (busy || when === undefined) return;
    if (next !== time) void onSetWhen?.(withTimeOfDay(when, next));
    moveOn();
  }
  function pickRepeat(next: Repeat | null) {
    if (busy || repeat === undefined) return;
    if (!sameRepeat(next, repeat.value)) void repeat.onChange(next);
    moveOn();
  }

  return (
    <Popover
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (next) setPage("menu");
      }}
    >
      <PopoverTrigger render={trigger} />
      <PopoverContent className="w-64 gap-0 p-1.5" align="end">
        {page === "menu" && (
          <>
            <p className="px-2 pt-1 pb-1.5 text-xs text-muted-foreground">
              {when === undefined
                ? "No date"
                : withTimeToken(format(when, "EEE, MMM d"), when)}
            </p>
            {quickPicks(now).map((pick) => (
              <MenuRow
                key={pick.label}
                label={pick.label}
                detail={format(pick.day, "EEE, MMM d")}
                chosen={
                  when !== undefined && startOfLocalDay(when) === pick.day
                }
                disabled={busy}
                onClick={() => pickDay(pick.day)}
              />
            ))}
            <MenuRow
              icon={<CalendarDays />}
              label="Pick a date…"
              disabled={busy}
              onClick={() => setPage("calendar")}
              leads
            />
            <Divider />
            <TimeChips
              disabled={busy || when === undefined}
              time={time}
              onPick={pickTime}
              onOther={() => setPage("time")}
            />
            {repeat !== undefined && (
              <MenuRow
                icon={<RepeatIcon />}
                label="Repeat"
                detail={repeatShortLabel(repeat.value)}
                disabled={busy || when === undefined}
                onClick={() => setPage("repeat")}
                leads
              />
            )}
            {when !== undefined && (
              <>
                <Divider />
                <MenuRow
                  icon={<X />}
                  label={clearLabel}
                  muted
                  disabled={busy}
                  onClick={() => {
                    if (busy) return;
                    void onSetWhen?.(undefined);
                    setOpen(false);
                  }}
                />
              </>
            )}
          </>
        )}

        {page === "calendar" && (
          <>
            <PageHeader title="Pick a date" onBack={() => setPage("menu")} />
            <Calendar
              mode="single"
              selected={when === undefined ? undefined : new Date(when)}
              defaultMonth={when === undefined ? undefined : new Date(when)}
              today={new Date(now)}
              disabled={busy}
              onSelect={(date) => date && pickDay(date.getTime())}
              className="p-0"
            />
          </>
        )}

        {page === "time" && (
          <TimePage
            time={time}
            onBack={() => setPage("menu")}
            onPick={pickTime}
          />
        )}

        {page === "repeat" && repeat !== undefined && when !== undefined && (
          <>
            <PageHeader title="Repeat" onBack={() => setPage("menu")} />
            {repeatPresets(when, repeat.value).map((preset) => {
              const lands =
                preset.repeat === null
                  ? when
                  : snapTaskDate(when, preset.repeat, browserTimeZone());
              return (
                <MenuRow
                  key={preset.label}
                  label={preset.label}
                  // A weekly rhythm moves the date to its first chosen day: say so first.
                  detail={
                    startOfLocalDay(lands) === startOfLocalDay(when)
                      ? undefined
                      : `from ${format(lands, "EEE")}`
                  }
                  chosen={sameRepeat(preset.repeat, repeat.value)}
                  disabled={busy}
                  onClick={() => pickRepeat(preset.repeat)}
                />
              );
            })}
            <MenuRow
              label="Custom…"
              chosen={
                repeat.value !== undefined &&
                !repeatPresets(when, repeat.value).some((preset) =>
                  sameRepeat(preset.repeat, repeat.value),
                )
              }
              disabled={busy}
              onClick={() => setPage("custom-repeat")}
              leads
            />
          </>
        )}

        {page === "custom-repeat" &&
          repeat !== undefined &&
          when !== undefined && (
            <CustomRepeat
              value={repeat.value}
              when={when}
              onBack={() => setPage("repeat")}
              onSave={pickRepeat}
            />
          )}
      </PopoverContent>
    </Popover>
  );
}

/** One row of the picker: its label, what it lands on, and › when it opens a page. */
function MenuRow({
  chosen,
  detail,
  disabled,
  icon,
  label,
  leads,
  muted,
  onClick,
}: {
  chosen?: boolean;
  detail?: string;
  disabled?: boolean;
  icon?: ReactNode;
  label: string;
  /** It opens a page rather than choosing. */
  leads?: boolean;
  muted?: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      disabled={disabled}
      aria-label={detail === undefined ? label : `${label}, ${detail}`}
      aria-pressed={leads ? undefined : (chosen ?? false)}
      onClick={onClick}
      className={cn(
        "flex h-8 w-full shrink-0 items-center gap-2 rounded-lg px-2 text-left text-sm outline-none hover:bg-muted focus-visible:bg-muted disabled:pointer-events-none disabled:opacity-50 [&_svg]:size-3.5 [&_svg]:shrink-0 [&_svg]:text-muted-foreground",
        muted && "text-muted-foreground",
      )}
    >
      {icon}
      <span className="min-w-0 flex-1 truncate">{label}</span>
      {detail !== undefined && (
        <span className="text-xs text-muted-foreground tabular-nums">
          {detail}
        </span>
      )}
      {chosen && <Check aria-hidden />}
      {leads && <ChevronRight aria-hidden />}
    </button>
  );
}

function PageHeader({ onBack, title }: { onBack: () => void; title: string }) {
  return (
    <div className="flex items-center gap-1 pb-1">
      <Button
        type="button"
        variant="ghost"
        size="icon-xs"
        aria-label="Back"
        onClick={onBack}
      >
        <ChevronLeft />
      </Button>
      <span className="text-xs font-medium text-muted-foreground">{title}</span>
    </div>
  );
}

const Divider = () => <div className="-mx-1.5 my-1 h-px bg-border/60" />;

const chip =
  "h-7 rounded-full border border-border px-2 text-xs font-medium whitespace-nowrap tabular-nums text-muted-foreground outline-none hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring/40 disabled:pointer-events-none disabled:opacity-50 aria-pressed:border-primary aria-pressed:bg-primary aria-pressed:text-primary-foreground";

/**
 * The time as four chips under a Time label, each saved in one click; the
 * chosen one again removes it. A time that is none of them stands in for
 * Other…, which opens the typed time either way.
 */
function TimeChips({
  disabled,
  onOther,
  onPick,
  time,
}: {
  disabled: boolean;
  onOther: () => void;
  onPick: (time: string | undefined) => void;
  time: string | undefined;
}) {
  const other =
    time !== undefined && !(CHIP_TIMES as readonly string[]).includes(time);

  return (
    <div
      role="group"
      aria-label="Time"
      className="flex flex-col gap-1.5 px-2 py-1"
    >
      <span className="flex items-center gap-2 text-sm">
        <Clock aria-hidden className="size-3.5 text-muted-foreground" />
        Time
      </span>
      <div className="flex gap-1">
        {CHIP_TIMES.map((value) => (
          <button
            key={value}
            type="button"
            disabled={disabled}
            aria-pressed={time === value}
            title={time === value ? "Remove time" : undefined}
            onClick={() => onPick(time === value ? undefined : value)}
            className={cn(chip, "flex-1 px-0")}
          >
            {timeLabel(value)}
          </button>
        ))}
        <button
          type="button"
          disabled={disabled}
          aria-pressed={other}
          aria-label={other ? `Other time: ${timeLabel(time)}` : "Other time"}
          onClick={onOther}
          className={chip}
        >
          {other ? timeLabel(time) : "Other…"}
        </button>
      </div>
    </div>
  );
}

/**
 * A typed time, on a page of its own: it offers what a partly typed time
 * could be ("7" is 7 AM or 7 PM) and Enter saves the highlighted one, which
 * ↑ and ↓ move. Before anything is typed it offers No time.
 */
function TimePage({
  onBack,
  onPick,
  time,
}: {
  onBack: () => void;
  onPick: (time: string | undefined) => void;
  time: string | undefined;
}) {
  const [text, setText] = useState("");
  const [highlight, setHighlight] = useState(0);
  const typed = text.trim() !== "";
  const suggestions = timeSuggestions(text);

  return (
    <>
      <PageHeader title="Time" onBack={onBack} />
      <input
        autoFocus
        aria-label="Time"
        placeholder="Type a time: 7, 7:45, 3pm"
        value={text}
        onChange={(event) => {
          setText(event.target.value);
          setHighlight(0);
        }}
        onKeyDown={(event) => {
          if (event.key === "ArrowDown" || event.key === "ArrowUp") {
            if (suggestions.length === 0) return;
            event.preventDefault();
            const step = event.key === "ArrowDown" ? 1 : -1;
            setHighlight(
              (at) => (at + step + suggestions.length) % suggestions.length,
            );
          }
          if (event.key === "Enter") {
            event.preventDefault();
            const chosen = suggestions[highlight];
            if (chosen) onPick(chosen);
          }
        }}
        className="mb-1 h-8 w-full shrink-0 rounded-lg bg-muted px-2.5 text-sm outline-none placeholder:text-muted-foreground focus-visible:ring-2 focus-visible:ring-ring/40"
      />
      {!typed ? (
        <MenuRow
          label="No time"
          chosen={time === undefined}
          onClick={() => onPick(undefined)}
        />
      ) : suggestions.length === 0 ? (
        <p className="px-2 py-1.5 text-xs text-muted-foreground">
          That isn’t a time. Try 7, 7:45 or 3pm.
        </p>
      ) : (
        suggestions.map((value, index) => (
          <div
            key={value}
            data-highlighted={index === highlight || undefined}
            onPointerEnter={() => setHighlight(index)}
            className="rounded-lg data-highlighted:bg-muted"
          >
            <MenuRow
              label={timeLabel(value)}
              chosen={value === time}
              onClick={() => onPick(value)}
            />
          </div>
        ))
      )}
    </>
  );
}

/**
 * A Repeat the presets don't hold: every N days with a stepper, or weekly on
 * chosen weekdays, with the line saying what it will do, and where a
 * weekly one moves its date, before Save.
 */
function CustomRepeat({
  onBack,
  onSave,
  value,
  when,
}: {
  onBack: () => void;
  onSave: (repeat: Repeat) => void;
  value: Repeat | undefined;
  when: number;
}) {
  const initial = repeatDraft(value?.kind === "monthly" ? undefined : value);
  const [draft, setDraft] = useState<RepeatDraft>(
    initial.mode === "never"
      ? { mode: "everyN", every: 2 }
      : initial.mode === "daily"
        ? { mode: "everyN", every: 1 }
        : initial,
  );
  const chosen = draftRepeat(draft);

  return (
    <div
      role="group"
      aria-label="Custom repeat"
      className="flex flex-col gap-2.5 px-1 pb-1"
    >
      <PageHeader title="Custom repeat" onBack={onBack} />
      <div className="grid grid-cols-2 gap-0.5 rounded-lg bg-muted p-0.5">
        {(
          [
            ["everyN", "Every N days"],
            ["weekly", "Weekly"],
          ] as const
        ).map(([mode, label]) => (
          <button
            key={mode}
            type="button"
            aria-pressed={draft.mode === mode}
            onClick={() => {
              if (draft.mode === mode) return;
              setDraft(
                mode === "everyN"
                  ? { mode, every: 2 }
                  : { mode, weekdays: [new Date(when).getDay()] },
              );
            }}
            className={cn(
              "h-7 rounded-md text-xs font-medium text-muted-foreground outline-none hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring/40",
              draft.mode === mode && "bg-background text-foreground shadow-xs",
            )}
          >
            {label}
          </button>
        ))}
      </div>

      {draft.mode === "everyN" && (
        <div className="flex items-center justify-center gap-2 text-sm">
          Every
          <Button
            type="button"
            variant="outline"
            size="icon-xs"
            aria-label="Fewer days"
            disabled={draft.every <= 1}
            onClick={() => setDraft({ mode: "everyN", every: draft.every - 1 })}
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
            onClick={() => setDraft({ mode: "everyN", every: draft.every + 1 })}
          >
            <Plus />
          </Button>
          {draft.every === 1 ? "day" : "days"}
        </div>
      )}

      {draft.mode === "weekly" && (
        <div className="flex items-center justify-between">
          {WEEKDAYS.map(({ day, name, letter }) => {
            const on = draft.weekdays.includes(day);
            return (
              <button
                key={day}
                type="button"
                aria-pressed={on}
                aria-label={name}
                title={name}
                onClick={() =>
                  setDraft({
                    mode: "weekly",
                    weekdays: on
                      ? draft.weekdays.filter((other) => other !== day)
                      : [...draft.weekdays, day],
                  })
                }
                className={cn(
                  "flex size-7 items-center justify-center rounded-full border text-xs font-medium outline-none focus-visible:ring-2 focus-visible:ring-ring/40",
                  on
                    ? "border-primary bg-primary text-primary-foreground"
                    : "border-border text-muted-foreground hover:text-foreground",
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
      <Button
        type="button"
        size="sm"
        disabled={!chosen}
        onClick={() => chosen && onSave(chosen)}
      >
        Save repeat
      </Button>
    </div>
  );
}
