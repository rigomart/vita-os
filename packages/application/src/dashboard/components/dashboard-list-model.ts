import { markdownToPlainText } from "@vita-os/ui/components/markdown";

import type { BoardGroup, BoardItem } from "./attention-board-model";

/**
 * How a group of the Dashboard's list reads, by how far it stands from today:
 * 0 is Late and Today, 1 Tomorrow, 2 two or three days out, 3 the rest of the
 * week, 4 the weeks after it, 5 the months. Every group is a ruled heading
 * over lines; the nearer it is, the larger, bolder and darker both read, with
 * more room around them, so what is asking stands out and what is far off
 * recedes.
 */
export interface GroupLook {
  distance: number;
  heading: {
    /** The room under the group. */
    section: string;
    /** The rule above the heading and the room around it. */
    rule: string;
    /** The date's number, for a group that names one day. */
    numeral: string;
    label: string;
  };
  line: LineLook;
}

/** How each item's line reads at a group's distance. */
export interface LineLook {
  /** The line's room, type size and ink. */
  frame: string;
  /** Holds the marker on the first line of text. */
  marker: string;
  task: string;
  thread: string;
  /** The Area, date and controls at the right. */
  meta: string;
}

const distanceByTone: Record<Exclude<BoardGroup["tone"], "far">, number> = {
  late: 0,
  today: 0,
  near: 1,
  soon: 2,
  week: 3,
};

const headings: GroupLook["heading"][] = [
  {
    section: "pb-5",
    rule: "border-border/80 pt-4 pb-1.5",
    numeral: "text-3xl font-semibold",
    label: "text-xl font-semibold",
  },
  {
    section: "pb-4",
    rule: "border-border/70 pt-3.5 pb-1",
    numeral: "text-2xl font-semibold text-foreground/85",
    label: "text-lg font-semibold",
  },
  {
    section: "pb-3",
    rule: "border-border/60 pt-3 pb-1",
    numeral: "text-xl font-medium text-foreground/60",
    label: "text-base font-medium text-foreground/85",
  },
  {
    section: "pb-2.5",
    rule: "border-border/50 pt-2.5 pb-0.5",
    numeral: "text-lg font-medium text-foreground/45",
    label: "text-[15px] font-medium text-foreground/70",
  },
  {
    section: "pb-2",
    rule: "border-border/40 pt-2.5 pb-0.5",
    numeral: "",
    label: "text-sm font-medium text-muted-foreground",
  },
  {
    section: "pb-2",
    rule: "border-border/30 pt-2 pb-0.5",
    numeral: "",
    label: "text-[13px] font-medium text-muted-foreground/70",
  },
];

const lines: LineLook[] = [
  {
    frame: "py-2.5 text-[17px] text-foreground",
    marker: "h-[1.55rem]",
    task: "font-semibold",
    thread: "text-sm",
    meta: "h-[1.55rem]",
  },
  {
    frame: "py-2 text-[15px] text-foreground",
    marker: "h-[1.4rem]",
    task: "font-medium",
    thread: "text-[13px]",
    meta: "h-5",
  },
  {
    frame: "py-1.5 text-sm text-foreground/90",
    marker: "h-5",
    task: "font-medium",
    thread: "text-[13px]",
    meta: "h-5",
  },
  {
    frame:
      "py-1.5 text-sm text-foreground/75 hover:text-foreground has-focus-visible:text-foreground",
    marker: "h-5",
    task: "font-normal",
    thread: "text-[13px]",
    meta: "h-5",
  },
  {
    frame:
      "py-1 text-[13px] text-foreground/60 hover:text-foreground has-focus-visible:text-foreground",
    marker: "h-[1.15rem]",
    task: "font-normal",
    thread: "text-xs",
    meta: "h-[1.15rem] opacity-70",
  },
  {
    frame:
      "py-1 text-[13px] text-foreground/50 hover:text-foreground has-focus-visible:text-foreground",
    marker: "h-[1.15rem]",
    task: "font-normal",
    thread: "text-xs",
    meta: "h-[1.15rem] opacity-70",
  },
];

export function groupLook(group: BoardGroup): GroupLook {
  const distance =
    group.tone === "far"
      ? group.key.startsWith("week")
        ? 4
        : 5
      : distanceByTone[group.tone];
  const look = lookAt(distance);
  return group.tone === "late"
    ? {
        ...look,
        heading: {
          ...look.heading,
          label: `${look.heading.label} text-condition-attention`,
        },
      }
    : look;
}

/** How a group reads at `distance`, whatever it holds. */
export function lookAt(distance: number): GroupLook {
  return { distance, heading: headings[distance]!, line: lines[distance]! };
}

export const LATER_LOOK = lookAt(3);

/** No date's lines read like the soon group's: nothing there is late, nothing is far off. */
export const NO_DATE_LOOK = lookAt(2).line;

/** Clearance for the sticky filter above and the phone action bar below. */
export const CURSOR_SCROLL_MARGIN = "scroll-mt-24 scroll-mb-24";

/** The folded No date tab's fill. */
export const NO_DATE_FILL =
  "bg-[color-mix(in_oklab,var(--color-surface-2)_55%,var(--color-surface-1))]";

/** What an item is called in a line of text: its title, or a Note's first line. */
export function itemTitle(item: BoardItem) {
  if (item.kind === "thread") return item.thread.title;
  const text = markdownToPlainText(item.note.body).trim();
  return text.split("\n")[0]!.trim();
}

/** The first two items by name, then how many more there are. */
export function foldedSummary(items: readonly BoardItem[]) {
  const names = items.slice(0, 2).map(itemTitle).join(", ");
  const rest = items.length - 2;
  return rest > 0 ? `${names} and ${rest} more` : names;
}
