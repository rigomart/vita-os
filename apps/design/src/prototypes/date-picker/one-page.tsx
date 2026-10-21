import { repeatShortLabel } from "@vita-os/application/internal/attention-list/repeat.ts";
import { withTimeOfDay } from "@vita-os/core";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@vita-os/ui/components/popover";
import { cn } from "@vita-os/ui/lib/utils";
import { ChevronRight, Clock, Repeat as RepeatIcon, X } from "lucide-react";
import { useState } from "react";

import type { PickerProps } from "./parts";

import {
  landOn,
  MonthCalendar,
  QuickPickChips,
  RepeatChoices,
  TimeInput,
  timeLabel,
  timeOf,
  whenSummary,
} from "./parts";

/**
 * One page, never replaced: three day chips over the calendar, then a Time
 * row and a Repeat row that open their choices beside the picker instead of
 * in place of it. Nothing to go back from.
 */
export function OnePagePicker({
  clearLabel = "Remove date",
  keepOpenOnPick,
  onSetWhen,
  repeat,
  trigger,
  when,
}: PickerProps) {
  const [open, setOpen] = useState(false);
  const time = timeOf(when);

  function done() {
    if (!keepOpenOnPick) setOpen(false);
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger render={trigger} />
      <PopoverContent className="w-72 gap-2 p-3" align="end">
        <p className="px-1 text-xs text-muted-foreground">
          {whenSummary(when, repeat?.value)}
        </p>
        <QuickPickChips
          when={when}
          onPick={(day) => {
            void onSetWhen(landOn(day, when));
            done();
          }}
        />
        <MonthCalendar
          when={when}
          className="self-center"
          onPick={(day) => {
            void onSetWhen(landOn(day, when));
            done();
          }}
        />
        <div className="-mx-3 h-px bg-border/60" />
        <SideRow
          icon={<Clock />}
          label="Time"
          value={time === undefined ? "None" : timeLabel(time)}
          disabled={when === undefined}
        >
          {(close) => (
            <TimeInput
              autoFocus
              time={time}
              onPick={(next) => {
                if (when === undefined) return;
                void onSetWhen(withTimeOfDay(when, next));
                close();
              }}
            />
          )}
        </SideRow>
        {repeat !== undefined && (
          <SideRow
            icon={<RepeatIcon />}
            label="Repeat"
            value={repeatShortLabel(repeat.value)}
            disabled={when === undefined}
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
          </SideRow>
        )}
        {when !== undefined && (
          <button
            type="button"
            onClick={() => {
              void onSetWhen(undefined);
              setOpen(false);
            }}
            className="flex h-8 items-center gap-2 rounded-lg px-2 text-sm text-muted-foreground hover:bg-muted [&_svg]:size-3.5"
          >
            <X />
            {clearLabel}
          </button>
        )}
      </PopoverContent>
    </Popover>
  );
}

/** A row naming its value, whose choices open in a popover of their own, to the side. */
function SideRow({
  children,
  disabled,
  icon,
  label,
  value,
}: {
  children: (close: () => void) => React.ReactNode;
  disabled?: boolean;
  icon: React.ReactNode;
  label: string;
  value: string;
}) {
  const [open, setOpen] = useState(false);
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger
        disabled={disabled}
        render={
          <button
            type="button"
            className={cn(
              "flex h-8 items-center gap-2 rounded-lg px-2 text-sm outline-none hover:bg-muted focus-visible:bg-muted disabled:opacity-50 [&_svg]:size-3.5 [&_svg]:text-muted-foreground",
              open && "bg-muted",
            )}
          />
        }
      >
        {icon}
        <span className="flex-1 text-left">{label}</span>
        <span className="text-xs text-muted-foreground">{value}</span>
        <ChevronRight />
      </PopoverTrigger>
      <PopoverContent side="right" align="start" className="w-64 gap-2 p-2">
        {children(() => setOpen(false))}
      </PopoverContent>
    </Popover>
  );
}
