import type { ReactElement, ReactNode } from "react";

import { repeatShortLabel } from "@vita-os/application/internal/attention-list/repeat.ts";
import { withTimeOfDay } from "@vita-os/core";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@vita-os/ui/components/popover";
import { cn } from "@vita-os/ui/lib/utils";
import { Clock, Plus, Repeat as RepeatIcon, X } from "lucide-react";
import { useState } from "react";

import type { PickerProps } from "./parts";

import {
  dayName,
  landOn,
  MonthCalendar,
  QuickPickChips,
  RepeatChoices,
  TimeInput,
  timeLabel,
  timeOf,
} from "./parts";

const token =
  "inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs tabular-nums text-muted-foreground outline-none hover:bg-muted hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring/40 [&_svg]:size-3";

/**
 * The day, the time and the Repeat as three tokens, each with a small
 * picker of its own that closes on a pick. The day's picker is the calendar
 * with chips over it; the time and the Repeat show as "+" once there is a day.
 */
export function SplitPicker({
  clearLabel = "Remove date",
  onSetWhen,
  repeat,
  trigger,
  when,
}: PickerProps) {
  const time = timeOf(when);

  return (
    <span className="inline-flex items-center gap-0.5">
      <Token
        trigger={
          when === undefined ? (
            trigger
          ) : (
            <button type="button" className={token} />
          )
        }
        label={when === undefined ? undefined : dayName(when)}
        className="w-72"
      >
        {(close) => (
          <>
            <QuickPickChips
              count={6}
              when={when}
              onPick={(day) => {
                void onSetWhen(landOn(day, when));
                close();
              }}
            />
            <MonthCalendar
              when={when}
              onPick={(day) => {
                void onSetWhen(landOn(day, when));
                close();
              }}
            />
            {when !== undefined && (
              <button
                type="button"
                onClick={() => {
                  void onSetWhen(undefined);
                  close();
                }}
                className="flex h-8 items-center gap-2 rounded-lg px-2 text-sm text-muted-foreground hover:bg-muted [&_svg]:size-3.5"
              >
                <X />
                {clearLabel}
              </button>
            )}
          </>
        )}
      </Token>
      {when !== undefined && (
        <Token
          trigger={<button type="button" className={token} />}
          label={
            time === undefined ? (
              <>
                <Plus />
                <Clock />
              </>
            ) : (
              timeLabel(time)
            )
          }
          ariaLabel={time === undefined ? "Add time" : "Change time"}
          className="w-60"
        >
          {(close) => (
            <TimeInput
              autoFocus
              time={time}
              onPick={(next) => {
                void onSetWhen(withTimeOfDay(when, next));
                close();
              }}
            />
          )}
        </Token>
      )}
      {when !== undefined && repeat !== undefined && (
        <Token
          trigger={<button type="button" className={token} />}
          label={
            repeat.value === undefined ? (
              <>
                <Plus />
                <RepeatIcon />
              </>
            ) : (
              <>
                <RepeatIcon />
                {repeatShortLabel(repeat.value)}
              </>
            )
          }
          ariaLabel={
            repeat.value === undefined ? "Add repeat" : "Change repeat"
          }
          className="w-64"
        >
          {(close) => (
            <RepeatChoices
              layout="rows"
              when={when}
              value={repeat.value}
              onPick={(next) => {
                void repeat.onChange(next);
                close();
              }}
            />
          )}
        </Token>
      )}
    </span>
  );
}

function Token({
  ariaLabel,
  children,
  className,
  label,
  trigger,
}: {
  ariaLabel?: string;
  children: (close: () => void) => ReactNode;
  className?: string;
  label?: ReactNode;
  trigger: ReactElement;
}) {
  const [open, setOpen] = useState(false);
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger
        render={trigger}
        {...(ariaLabel === undefined ? {} : { "aria-label": ariaLabel })}
      >
        {label}
      </PopoverTrigger>
      <PopoverContent align="end" className={cn("gap-2 p-3", className)}>
        {children(() => setOpen(false))}
      </PopoverContent>
    </Popover>
  );
}
