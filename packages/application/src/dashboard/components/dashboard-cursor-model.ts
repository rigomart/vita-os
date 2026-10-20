export type CursorMove = "first" | "last" | "next" | "previous";

/** Undefined for chords and shifted keys, which belong to others. */
export function cursorMove(event: {
  altKey: boolean;
  ctrlKey: boolean;
  key: string;
  metaKey: boolean;
  shiftKey: boolean;
}): CursorMove | undefined {
  if (event.altKey || event.ctrlKey || event.metaKey || event.shiftKey)
    return undefined;
  switch (event.key) {
    case "ArrowDown":
    case "j":
      return "next";
    case "ArrowUp":
    case "k":
      return "previous";
    case "Home":
      return "first";
    case "End":
      return "last";
    default:
      return undefined;
  }
}

/** The ends hold; undefined when there are no items. */
export function stepIndex(count: number, index: number, move: CursorMove) {
  if (count === 0) return undefined;
  switch (move) {
    case "first":
      return 0;
    case "last":
      return count - 1;
    case "next":
      return Math.min(index + 1, count - 1);
    case "previous":
      return Math.max(index - 1, 0);
  }
}

/**
 * Which item takes focus after an action took the focused one from its
 * place. `before` is the cursor's order when the action began, `after` the
 * order now.
 *
 * The item itself, when it still reads in the same place among the items
 * that were there before; else the first item after it then that is still
 * here, else the last one before it, else the first item now. A rescheduled
 * item is not followed: focus stays where it was read.
 */
export function nextFocusKey(
  before: readonly string[],
  key: string,
  after: readonly string[],
): string | undefined {
  const now = new Set(after);
  const then = new Set(before);
  const survivors = before.filter((k) => now.has(k));
  const stayed = after.filter((k) => then.has(k));
  if (now.has(key) && survivors.indexOf(key) === stayed.indexOf(key))
    return key;

  const at = before.indexOf(key);
  const next = before.slice(at + 1).find((k) => k !== key && now.has(k));
  if (next !== undefined) return next;
  const previous = before
    .slice(0, Math.max(at, 0))
    .reverse()
    .find((k) => k !== key && now.has(k));
  return previous ?? after[0];
}
