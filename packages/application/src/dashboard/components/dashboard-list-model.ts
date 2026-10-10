import { markdownToPlainText } from "@vita-os/ui/components/markdown";

import type { BoardGroup, BoardItem } from "./attention-board-model";

/**
 * How a group of the Dashboard's list reads, by how far it stands from today:
 * 0 is Late and Today, 1 Tomorrow, 2 two or three days out, 3 the rest of the
 * week, 4 the weeks after it, 5 the months. Nearer reads larger, darker and
 * more raised; from the weeks on, items shrink to one line each, since they
 * are only there to be known about.
 */
export interface GroupLook {
  distance: number;
  /** The file tab's fill, shared by its tab and its body. */
  fill: string;
  /** The heading's size, weight and ink. */
  heading: string;
  /** One line per item instead of a card. */
  oneLine: boolean;
}

/** From here on, items are one-line rows. */
const ONE_LINE_FROM = 4;

const distanceByTone: Record<Exclude<BoardGroup["tone"], "far">, number> = {
  late: 0,
  today: 0,
  near: 1,
  soon: 2,
  week: 3,
};

/** Nearer reads larger and darker, in small steps. */
const headings = [
  "text-xl font-semibold text-foreground",
  "text-lg font-semibold text-foreground",
  "text-base font-semibold text-foreground/85",
  "text-[15px] font-medium text-foreground/75",
  "text-sm font-medium text-muted-foreground",
  "text-sm font-medium text-muted-foreground/80",
];

/** Late's warm fill: the attention colour faintly over the page. */
export const LATE_FILL =
  "bg-[color-mix(in_oklab,var(--color-condition-attention)_9%,var(--color-surface-1))]";
const NEAR_FILL =
  "bg-[color-mix(in_oklab,var(--color-surface-2)_70%,var(--color-surface-1))]";
const FAR_FILL =
  "bg-[color-mix(in_oklab,var(--color-surface-2)_45%,var(--color-surface-1))]";
/** The folded No date tab, between the near days and the far ones. */
export const NO_DATE_FILL =
  "bg-[color-mix(in_oklab,var(--color-surface-2)_55%,var(--color-surface-1))]";

export function groupLook(group: BoardGroup): GroupLook {
  const distance =
    group.tone === "far"
      ? group.key.startsWith("week")
        ? 4
        : 5
      : distanceByTone[group.tone];
  const late = group.tone === "late";
  return {
    distance,
    heading: late
      ? "text-xl font-semibold text-condition-attention"
      : headings[distance]!,
    fill: late
      ? LATE_FILL
      : distance === 0
        ? "bg-surface-2"
        : distance <= 2
          ? NEAR_FILL
          : FAR_FILL,
    oneLine: distance >= ONE_LINE_FROM,
  };
}

/** What an item is called in a line of text: its title, or a Note's first line. */
export function itemTitle(item: BoardItem) {
  if (item.kind === "thread") return item.thread.title;
  const text = markdownToPlainText(item.note.body).trim();
  return text.split("\n")[0]!.trim();
}

/**
 * No date folded to one line: the first two items by name, then how many
 * more there are.
 */
export function foldedNoDateSummary(items: readonly BoardItem[]) {
  const names = items.slice(0, 2).map(itemTitle).join(", ");
  const rest = items.length - 2;
  return rest > 0 ? `${names} and ${rest} more` : names;
}
