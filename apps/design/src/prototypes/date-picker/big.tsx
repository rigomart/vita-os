import type { Repeat } from "@vita-os/contracts";
import type { ReactElement, ReactNode } from "react";

import {
  CHIP_TIMES,
  timeSuggestions,
} from "@vita-os/application/internal/attention-list/quick-picks.ts";
import { repeatShortLabel } from "@vita-os/application/internal/attention-list/repeat.ts";
import { withTimeOfDay } from "@vita-os/core";
import {
  Drawer,
  DrawerContent,
  DrawerDescription,
  DrawerHeader,
  DrawerNested,
  DrawerTitle,
  useInsideDrawer,
} from "@vita-os/ui/components/drawer";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@vita-os/ui/components/popover";
import { useIsMobile } from "@vita-os/ui/hooks/use-mobile";
import { cn } from "@vita-os/ui/lib/utils";
import {
  CalendarDays,
  ChevronLeft,
  Clock,
  Repeat as RepeatIcon,
  X,
} from "lucide-react";
import { cloneElement, useState } from "react";

import type { PickerProps } from "./parts";

import {
  chip,
  ChoiceRow,
  dayName,
  DisclosureRow,
  landOn,
  MonthCalendar,
  QuickPickGrid,
  QuickPickRows,
  RepeatChoices,
  TimeInput,
  timeLabel,
  timeOf,
  whenSummary,
} from "./parts";

/** What a choice does, the same in every layout: save, then close unless the picker stays open on a pick. */
interface Choices {
  day: (day: number) => void;
  time: (time: string | undefined) => void;
  repeat: (repeat: Repeat | null) => void;
  clear: () => void;
}

export interface LayoutProps {
  choices: Choices;
  clearLabel: string;
  repeat: PickerProps["repeat"];
  when: number | undefined;
}

/**
 * The big picker: a popover on a wide screen laid out by `layout`, and on a
 * phone a drawer from the bottom, the same for every layout, where the
 * calendar, the time and the Repeat each open in place, one at a time.
 */
/** Controls a direction brings for the time and the Repeat, used on a phone too. */
export interface DrawerParts {
  time: (props: {
    time: string | undefined;
    onPick: (time: string | undefined) => void;
  }) => ReactNode;
  repeat: (props: {
    when: number | undefined;
    value: Repeat | undefined;
    onPick: (repeat: Repeat | null) => void;
  }) => ReactNode;
}

export function BigPicker({
  calendarOnly,
  drawerParts,
  layout: Layout,
  props,
  timeStaysOpen,
}: {
  /** No quick picks on a phone either: the drawer opens on the calendar. */
  calendarOnly?: boolean;
  drawerParts?: DrawerParts;
  layout: (props: LayoutProps) => ReactNode;
  props: PickerProps;
  /** A time saved while still being typed leaves the picker open, even on a card. */
  timeStaysOpen?: boolean;
}) {
  const {
    clearLabel = "Remove date",
    keepOpenOnPick,
    onSetWhen,
    repeat,
    title,
    trigger,
    when,
  } = props;
  const [open, setOpen] = useState(false);
  const isMobile = useIsMobile();
  const insideDrawer = useInsideDrawer();

  const after = () => {
    if (!keepOpenOnPick) setOpen(false);
  };
  const choices: Choices = {
    day: (day) => {
      void onSetWhen(landOn(day, when));
      after();
    },
    time: (time) => {
      if (when === undefined) return;
      void onSetWhen(withTimeOfDay(when, time));
      if (!timeStaysOpen) after();
    },
    repeat: (next) => {
      if (repeat === undefined) return;
      void repeat.onChange(next);
      after();
    },
    clear: () => {
      void onSetWhen(undefined);
      setOpen(false);
    },
  };
  const layoutProps = { choices, clearLabel, repeat, when };

  if (isMobile) {
    const Root = insideDrawer ? DrawerNested : Drawer;
    return (
      <>
        {cloneElement(trigger as ReactElement<{ onClick?: () => void }>, {
          onClick: () => setOpen(true),
        })}
        <Root open={open} onOpenChange={setOpen}>
          <DrawerContent>
            <WhenDrawer
              {...layoutProps}
              title={title}
              calendarOnly={calendarOnly ?? false}
              {...(drawerParts === undefined ? {} : { parts: drawerParts })}
            />
          </DrawerContent>
        </Root>
      </>
    );
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger render={trigger} />
      <PopoverContent className="w-auto gap-0 p-0" align="end">
        <Layout {...layoutProps} />
      </PopoverContent>
    </Popover>
  );
}

/** The When in one line, with the way to remove it beside it. */
export function SummaryLine({
  choices,
  clearLabel,
  repeat,
  when,
}: LayoutProps) {
  return (
    <div className="flex h-7 shrink-0 items-center gap-1 pl-2">
      <span className="flex-1 truncate text-xs text-muted-foreground">
        {whenSummary(when, repeat?.value)}
      </span>
      {when !== undefined && (
        <button
          type="button"
          title={clearLabel}
          aria-label={clearLabel}
          onClick={choices.clear}
          className="inline-flex size-6 items-center justify-center rounded-full text-muted-foreground hover:bg-muted hover:text-foreground [&_svg]:size-3.5"
        >
          <X />
        </button>
      )}
    </div>
  );
}

/**
 * Calendar only: the calendar is the one way to pick a day, so the column
 * beside it has room for the time and every Repeat in view, nothing folded.
 */
function CalendarOnlyLayout(props: LayoutProps) {
  const { choices, repeat, when } = props;

  return (
    <div className="flex">
      <CalendarPane {...props} />
      <Beside>
        <SummaryLine {...props} />
        <TimeRow
          disabled={when === undefined}
          time={timeOf(when)}
          onPick={choices.time}
        />
        {repeat !== undefined && (
          <>
            <div className="flex h-6 shrink-0 items-center gap-2 px-2 pt-1 text-xs text-muted-foreground [&_svg]:size-3.5">
              <RepeatIcon aria-hidden />
              Repeat
            </div>
            <RepeatChoices
              customReplaces
              layout="rows"
              when={when}
              value={repeat.value}
              onPick={choices.repeat}
            />
          </>
        )}
      </Beside>
    </div>
  );
}

/** The calendar, kept at six weeks so the column beside it can match its height. */
export function CalendarPane({ choices, when }: LayoutProps) {
  return (
    <div className="border-r p-3">
      <MonthCalendar fixedWeeks when={when} onPick={choices.day} />
    </div>
  );
}

/** A column exactly as tall as what sits beside it, scrolling past that. */
export function Beside({ children }: { children: ReactNode }) {
  return (
    <div className="relative w-64">
      <div className="absolute inset-0 flex flex-col gap-0.5 overflow-y-auto p-2">
        {children}
      </div>
    </div>
  );
}

type Part = "day" | "time" | "repeat";

/**
 * Accordion: the calendar on the left; on the right Day, Time and Repeat as
 * rows naming their value, one open at a time. Day is open first.
 */
function AccordionLayout(props: LayoutProps) {
  const { choices, repeat, when } = props;
  const [open, setOpen] = useState<Part | null>("day");
  const toggle = (part: Part) => setOpen(open === part ? null : part);
  const time = timeOf(when);

  return (
    <div className="flex">
      <CalendarPane {...props} />
      <Beside>
        <SummaryLine {...props} />
        <DisclosureRow
          icon={<CalendarDays />}
          label="Day"
          value={when === undefined ? "None" : dayName(when)}
          expanded={open === "day"}
          onClick={() => toggle("day")}
        />
        {open === "day" && (
          <div className="px-1 pb-2">
            <QuickPickGrid when={when} onPick={choices.day} />
          </div>
        )}
        <div className="relative">
          <DisclosureRow
            icon={<Clock />}
            label="Time"
            value={time === undefined ? "None" : timeLabel(time)}
            disabled={when === undefined}
            expanded={open === "time"}
            onClick={() => toggle("time")}
          />
          {/* Open, the row trades its value for the way to remove it. */}
          {open === "time" && time !== undefined && (
            <button
              type="button"
              onClick={() => choices.time(undefined)}
              className="absolute top-1/2 right-7 inline-flex -translate-y-1/2 items-center gap-1 rounded-full px-1.5 py-0.5 text-xs text-muted-foreground hover:bg-muted hover:text-foreground [&_svg]:size-3"
            >
              <X />
              Remove
            </button>
          )}
        </div>
        {open === "time" && (
          <div className="px-1 pb-2">
            <TimeInput autoFocus time={time} onPick={choices.time} />
          </div>
        )}
        {repeat !== undefined && (
          <>
            <DisclosureRow
              icon={<RepeatIcon />}
              label="Repeat"
              value={repeatShortLabel(repeat.value)}
              disabled={when === undefined}
              expanded={open === "repeat"}
              onClick={() => toggle("repeat")}
            />
            {open === "repeat" && (
              <div className="px-1 pb-2">
                <RepeatChoices
                  customReplaces
                  layout="chips"
                  when={when}
                  value={repeat.value}
                  onPick={choices.repeat}
                />
              </div>
            )}
          </>
        )}
      </Beside>
    </div>
  );
}

/**
 * Menu: the calendar on the left; on the right the shipped menu, as tall as
 * the calendar: the quick picks with their days, the time as one row of
 * chips, and Repeat, the rarest, behind a row that takes over the column.
 */
function MenuLayout(props: LayoutProps) {
  const { choices, repeat, when } = props;
  const [page, setPage] = useState<"menu" | "repeat">("menu");

  return (
    <div className="flex">
      <CalendarPane {...props} />
      <Beside>
        {page === "menu" || repeat === undefined ? (
          <>
            <SummaryLine {...props} />
            <QuickPickRows when={when} onPick={choices.day} />
            <div className="-mx-2 my-1 h-px shrink-0 bg-border/60" />
            <TimeRow
              disabled={when === undefined}
              time={timeOf(when)}
              onPick={choices.time}
            />
            {repeat !== undefined && (
              <DisclosureRow
                chevron="right"
                icon={<RepeatIcon />}
                label="Repeat"
                value={repeatShortLabel(repeat.value)}
                disabled={when === undefined}
                onClick={() => setPage("repeat")}
              />
            )}
          </>
        ) : (
          <>
            <BackHeader title="Repeat" onBack={() => setPage("menu")} />
            <RepeatChoices
              customReplaces
              layout="rows"
              when={when}
              value={repeat.value}
              onPick={(next) => {
                choices.repeat(next);
                setPage("menu");
              }}
            />
          </>
        )}
      </Beside>
    </div>
  );
}

/**
 * Panels: opens as the shipped menu's width, with no calendar. Pick a date…
 * and Repeat open a panel beside the menu, to its left, rather than in its
 * place, so the picker only grows when asked to.
 */
function PanelsLayout(props: LayoutProps) {
  const { choices, repeat, when } = props;
  const [panel, setPanel] = useState<"calendar" | "repeat" | null>(null);
  const toggle = (next: "calendar" | "repeat") =>
    setPanel(panel === next ? null : next);

  return (
    <div className="flex items-stretch">
      {panel === "calendar" && <CalendarPane {...props} />}
      {panel === "repeat" && repeat !== undefined && (
        <div className="w-60 border-r p-2">
          <RepeatChoices
            customReplaces
            layout="rows"
            when={when}
            value={repeat.value}
            onPick={(next) => {
              choices.repeat(next);
              setPanel(null);
            }}
          />
        </div>
      )}
      <div className="flex w-64 flex-col gap-0.5 p-2">
        <SummaryLine {...props} />
        <QuickPickRows when={when} onPick={choices.day} />
        <ChoiceRow
          icon={<CalendarDays />}
          label="Pick a date…"
          chosen={panel === "calendar"}
          onClick={() => toggle("calendar")}
        />
        <div className="-mx-2 my-1 h-px shrink-0 bg-border/60" />
        <TimeRow
          disabled={when === undefined}
          time={timeOf(when)}
          onPick={choices.time}
        />
        {repeat !== undefined && (
          <ChoiceRow
            icon={<RepeatIcon />}
            label="Repeat"
            detail={repeatShortLabel(repeat.value)}
            chosen={panel === "repeat"}
            disabled={when === undefined}
            onClick={() => toggle("repeat")}
          />
        )}
      </div>
    </div>
  );
}

function BackHeader({ onBack, title }: { onBack: () => void; title: string }) {
  return (
    <button
      type="button"
      onClick={onBack}
      className="flex h-7 shrink-0 items-center gap-1 rounded-lg px-1 text-xs font-medium text-muted-foreground hover:text-foreground [&_svg]:size-3.5"
    >
      <ChevronLeft />
      {title}
    </button>
  );
}

/**
 * The time on one row: a clock, the four common times, and … which turns
 * the row into a field with what the typed time could be beside it. Enter
 * takes the first; Escape goes back to the chips.
 */
function TimeRow({
  disabled,
  onPick,
  time,
}: {
  disabled?: boolean;
  onPick: (time: string | undefined) => void;
  time: string | undefined;
}) {
  const [typing, setTyping] = useState(false);
  const [text, setText] = useState("");
  const suggestions = timeSuggestions(text).slice(0, 2);
  const other =
    time !== undefined && !(CHIP_TIMES as readonly string[]).includes(time);

  function pick(next: string | undefined) {
    setTyping(false);
    setText("");
    onPick(next);
  }

  return (
    <div
      role="group"
      aria-label="Time"
      className="flex h-8 shrink-0 items-center gap-1 px-2"
    >
      <Clock
        aria-hidden
        className="mr-1 size-3.5 shrink-0 text-muted-foreground"
      />
      {typing ? (
        <>
          <input
            autoFocus
            aria-label="Type a time"
            placeholder="7, 7:45, 3pm"
            value={text}
            onChange={(event) => setText(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Escape") {
                event.stopPropagation();
                setTyping(false);
                setText("");
              }
              if (event.key === "Enter" && suggestions[0]) {
                event.preventDefault();
                pick(suggestions[0]);
              }
            }}
            className="h-7 w-0 min-w-0 flex-1 rounded-full bg-muted px-2.5 text-xs outline-none focus-visible:ring-2 focus-visible:ring-ring/40"
          />
          {suggestions.map((value, index) => (
            <button
              key={value}
              type="button"
              onClick={() => pick(value)}
              className={cn(chip, "px-2", index === 0 && "text-foreground")}
            >
              {timeLabel(value)}
            </button>
          ))}
        </>
      ) : (
        <>
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
            title="Type a time"
            onClick={() => setTyping(true)}
            className={cn(chip, "px-2")}
          >
            {other ? timeLabel(time) : "…"}
          </button>
        </>
      )}
    </div>
  );
}

/**
 * On a phone, one column in a drawer: the quick picks, then the calendar,
 * the time and the Repeat as rows that each open in place, one at a time.
 * `calendarOnly` drops the quick picks and keeps the calendar open.
 */
function WhenDrawer({
  calendarOnly,
  choices,
  clearLabel,
  parts,
  repeat,
  title,
  when,
}: LayoutProps & {
  calendarOnly: boolean;
  parts?: DrawerParts;
  title: string;
}) {
  const [open, setOpen] = useState<"calendar" | Part | null>(null);
  const toggle = (part: "calendar" | Part) =>
    setOpen(open === part ? null : part);
  const time = timeOf(when);

  return (
    <div className="flex flex-col gap-1 overflow-y-auto px-2 pb-2">
      <DrawerHeader className="px-0 pb-2">
        <DrawerTitle className="truncate">{title}</DrawerTitle>
        <DrawerDescription>
          {whenSummary(when, repeat?.value)}
        </DrawerDescription>
      </DrawerHeader>
      {calendarOnly ? (
        <MonthCalendar
          when={when}
          onPick={choices.day}
          className="self-center pb-2 [--cell-size:--spacing(10)]"
        />
      ) : (
        <QuickPickGrid columns={3} when={when} onPick={choices.day} />
      )}
      <div className="mt-2 flex flex-col gap-0.5">
        {!calendarOnly && (
          <DisclosureRow
            icon={<CalendarDays />}
            label="Pick a date"
            value={when === undefined ? "None" : dayName(when)}
            expanded={open === "calendar"}
            onClick={() => toggle("calendar")}
          />
        )}
        {!calendarOnly && open === "calendar" && (
          <MonthCalendar
            when={when}
            onPick={choices.day}
            className="self-center pb-2 [--cell-size:--spacing(10)]"
          />
        )}
        <div className="relative">
          <DisclosureRow
            icon={<Clock />}
            label="Time"
            value={time === undefined ? "None" : timeLabel(time)}
            disabled={when === undefined}
            expanded={open === "time"}
            onClick={() => toggle("time")}
          />
          {/* Open, the row trades its value for the way to remove it. */}
          {open === "time" && time !== undefined && (
            <button
              type="button"
              onClick={() => choices.time(undefined)}
              className="absolute top-1/2 right-7 inline-flex -translate-y-1/2 items-center gap-1 rounded-full px-1.5 py-0.5 text-xs text-muted-foreground hover:bg-muted hover:text-foreground [&_svg]:size-3"
            >
              <X />
              Remove
            </button>
          )}
        </div>
        {open === "time" && (
          <div className="px-1 pb-2">
            {parts ? (
              parts.time({ time, onPick: choices.time })
            ) : (
              <TimeInput time={time} onPick={choices.time} />
            )}
          </div>
        )}
        {repeat !== undefined && (
          <>
            <DisclosureRow
              icon={<RepeatIcon />}
              label="Repeat"
              value={repeatShortLabel(repeat.value)}
              disabled={when === undefined}
              expanded={open === "repeat"}
              onClick={() => toggle("repeat")}
            />
            {open === "repeat" && (
              <div className="px-1 pb-2">
                {parts ? (
                  parts.repeat({
                    when,
                    value: repeat.value,
                    onPick: choices.repeat,
                  })
                ) : (
                  <RepeatChoices
                    layout="rows"
                    when={when}
                    value={repeat.value}
                    onPick={choices.repeat}
                  />
                )}
              </div>
            )}
          </>
        )}
        {when !== undefined && (
          <ChoiceRow
            icon={<X />}
            label={clearLabel}
            muted
            onClick={choices.clear}
          />
        )}
      </div>
    </div>
  );
}

export const AccordionPicker = (props: PickerProps) => (
  <BigPicker layout={AccordionLayout} props={props} />
);
export const MenuPicker = (props: PickerProps) => (
  <BigPicker layout={MenuLayout} props={props} />
);
export const PanelsPicker = (props: PickerProps) => (
  <BigPicker layout={PanelsLayout} props={props} />
);
export const CalendarOnlyPicker = (props: PickerProps) => (
  <BigPicker calendarOnly layout={CalendarOnlyLayout} props={props} />
);
