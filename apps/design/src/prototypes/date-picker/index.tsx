import { WhenPopover } from "@vita-os/application/internal/attention-list/when-popover.tsx";

import { definePrototype } from "@/lab/prototype";

import type { PickerProps } from "./parts";

import {
  AccordionPicker,
  CalendarOnlyPicker,
  MenuPicker,
  PanelsPicker,
} from "./big";
import { DialogPicker } from "./dialog";
import { TimeFieldPicker, TimeGridPicker, TimeListPicker } from "./inside";
import { OnePagePicker } from "./one-page";
import { SplitPicker } from "./split";
import { PickerStage } from "./stage";
import { WidePicker } from "./wide";

const Current = ({ title: _title, ...props }: PickerProps) => (
  <WhenPopover {...props} />
);

/**
 * Directions for the picker every When shares (ADR 0040), which has grown
 * five pages deep. Each keeps every choice the shipped one holds. Round 2
 * settles on a big popover beside a calendar, with less in view at once, and
 * a drawer on a phone; round 1's directions follow it.
 */
export default definePrototype({
  title: "Date picker",
  description:
    "Calendar only, settled: how its time and Repeat controls should look inside it.",
  variants: [
    {
      key: "current",
      name: "Current",
      description:
        "As it ships: a menu of quick picks, time chips and Repeat, with the calendar, a typed time, Repeat and Custom each on a page of their own.",
      component: () => <PickerStage picker={Current} />,
    },
    {
      key: "time-list",
      name: "Inside · time list",
      description:
        "Calendar only, with Repeat in one word per choice and the time as a field over a list of every half hour, scrolled to 9 AM. Typing narrows the list.",
      component: () => <PickerStage picker={TimeListPicker} />,
    },
    {
      key: "time-grid",
      name: "Inside · hour grid",
      description:
        "Calendar only, with Repeat in one word per choice and the time as a grid of hours, 6 AM to 11 PM, with the quarter hours under it. No typing.",
      component: () => <PickerStage picker={TimeGridPicker} />,
    },
    {
      key: "time-field",
      name: "Inside · time field",
      description:
        "Calendar only, with Repeat in one word per choice and the time as one field to type into or step with the arrows; the system's wheel on a phone.",
      component: () => <PickerStage picker={TimeFieldPicker} />,
    },
    {
      key: "calendar-only",
      name: "Big · calendar only",
      description:
        "No quick picks: the calendar picks the day, so the time and every Repeat fit beside it with nothing folded. A drawer on a phone that opens on the calendar.",
      component: () => <PickerStage picker={CalendarOnlyPicker} />,
    },
    {
      key: "accordion",
      name: "Big · accordion",
      description:
        "Calendar on the left; Day, Time and Repeat on the right as rows naming their value, one open at a time. As tall as the calendar. A drawer on a phone.",
      component: () => <PickerStage picker={AccordionPicker} />,
    },
    {
      key: "menu",
      name: "Big · menu beside",
      description:
        "Calendar on the left; the shipped menu on the right, as tall as the calendar: quick picks, the time as one row of chips, and Repeat behind a row. A drawer on a phone.",
      component: () => <PickerStage picker={MenuPicker} />,
    },
    {
      key: "panels",
      name: "Big · panels on demand",
      description:
        "Opens at the menu's width with no calendar; Pick a date… and Repeat open a panel beside it, so it only grows when asked. A drawer on a phone.",
      component: () => <PickerStage picker={PanelsPicker} />,
    },
    {
      key: "wide",
      name: "Round 1 · Wide popover",
      description:
        "Everything in view at once, taller than the calendar beside it.",
      component: () => <PickerStage picker={WidePicker} />,
    },
    {
      key: "one-page",
      name: "Round 1 · One page",
      description:
        "The calendar always in view under three day chips; Time and Repeat open beside the picker.",
      component: () => <PickerStage picker={OnePagePicker} />,
    },
    {
      key: "dialog",
      name: "Round 1 · Dialog",
      description:
        "A centred dialog holding a draft: nothing is written until Save.",
      component: () => <PickerStage picker={DialogPicker} />,
    },
    {
      key: "split",
      name: "Round 1 · Split tokens",
      description:
        "Day, time and Repeat as three tokens, each with a small picker of its own.",
      component: () => <PickerStage picker={SplitPicker} />,
    },
  ],
});
