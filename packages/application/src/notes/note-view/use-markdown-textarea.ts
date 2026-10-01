import { type KeyboardEventHandler, useLayoutEffect, useRef } from "react";

type Selection = { element: HTMLTextAreaElement; start: number; end: number };

export function useMarkdownTextarea({
  value,
  onChange,
}: {
  value: string;
  onChange: (value: string) => void;
}): { onKeyDown: KeyboardEventHandler<HTMLTextAreaElement> } {
  const pendingSelection = useRef<Selection | null>(null);

  // Controlled textareas reset the caret when their value changes. Restore it
  // after React has applied the new value, before the next paint.
  useLayoutEffect(() => {
    const selection = pendingSelection.current;
    if (!selection) return;
    pendingSelection.current = null;
    selection.element.setSelectionRange(selection.start, selection.end);
  }, [value]);

  const onKeyDown: KeyboardEventHandler<HTMLTextAreaElement> = (event) => {
    if (event.nativeEvent.isComposing || event.altKey) return;
    const element = event.currentTarget;
    const { selectionStart: start, selectionEnd: end } = element;

    const update = (
      next: string,
      selectionStart: number,
      selectionEnd = selectionStart,
    ) => {
      event.preventDefault();
      if (next === value) return;
      pendingSelection.current = {
        element,
        start: selectionStart,
        end: selectionEnd,
      };
      onChange(next);
    };

    if (event.metaKey || event.ctrlKey) {
      const key = event.key.toLowerCase();
      if (key !== "b" && key !== "i") return;
      const marker = key === "b" ? "**" : "_";
      update(
        value.slice(0, start) +
          marker +
          value.slice(start, end) +
          marker +
          value.slice(end),
        start + marker.length,
        end + marker.length,
      );
      return;
    }

    const lineStart = start === 0 ? 0 : value.lastIndexOf("\n", start - 1) + 1;
    const nextNewline = value.indexOf("\n", start);
    const lineEnd = nextNewline === -1 ? value.length : nextNewline;
    const line = value.slice(lineStart, lineEnd);
    const list = /^([ \t]*)([-*]|\d+\.)[ \t]+(.*)$/.exec(line);
    if (!list) return;

    if (event.key === "Tab") {
      const removed = event.shiftKey
        ? Math.min(2, /^ */.exec(line)?.[0].length ?? 0)
        : 0;
      const inserted = event.shiftKey ? "" : "  ";
      const delta = inserted.length - removed;
      update(
        value.slice(0, lineStart) + inserted + value.slice(lineStart + removed),
        Math.max(lineStart, start + delta),
        Math.max(lineStart, end + delta),
      );
      return;
    }

    if (event.key !== "Enter" || event.shiftKey) return;
    if (start < lineStart + line.length - list[3].length) return;
    if (!list[3].trim()) {
      update(value.slice(0, lineStart) + value.slice(lineEnd), lineStart);
      return;
    }

    const marker = /^\d/.test(list[2])
      ? `${Number.parseInt(list[2], 10) + 1}.`
      : list[2];
    const inserted = `\n${list[1]}${marker} `;
    update(
      value.slice(0, start) + inserted + value.slice(end),
      start + inserted.length,
    );
  };

  return { onKeyDown };
}
