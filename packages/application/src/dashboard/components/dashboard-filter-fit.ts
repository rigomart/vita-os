/**
 * Which of the filter's chips show, given their widths and the room the row
 * has for them. The row never wraps and never scrolls: the chips that fit
 * show, in order, and the rest fold into More. The selected chip always shows,
 * taking the last place if it would have folded. At least one chip shows.
 *
 * Returns the indices of the chips that show, in order.
 */
export function fitFilterChips({
  widths,
  room,
  moreWidth,
  selected,
}: {
  /** Each chip's width, in row order. */
  widths: readonly number[];
  /** The width the chips may take, with whatever sits beside them taken off. */
  room: number;
  /** The width of the More button, needed as soon as one chip folds. */
  moreWidth: number;
  /** The selected chip's index, or -1 when the selection is not among them. */
  selected: number;
}): number[] {
  const all = widths.map((_, index) => index);
  if (sum(widths) <= room) return all;

  const budget = room - moreWidth;
  const fits = Math.max(prefixThatFits(widths, budget), 1);
  if (selected < fits) return all.slice(0, fits);

  // The selection would fold: it takes the last place, and the chips before
  // it give up as many places as its width needs.
  const before = prefixThatFits(
    widths.slice(0, selected),
    budget - widths[selected]!,
  );
  return [...all.slice(0, before), selected];
}

/** How many leading widths fit in `budget` together. */
function prefixThatFits(widths: readonly number[], budget: number) {
  let used = 0;
  let count = 0;
  for (const width of widths) {
    if (used + width > budget) break;
    used += width;
    count += 1;
  }
  return count;
}

function sum(values: readonly number[]) {
  return values.reduce((total, value) => total + value, 0);
}
