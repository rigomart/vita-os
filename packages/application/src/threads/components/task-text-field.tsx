import { cn } from "@vita-os/ui/lib/utils";
import { useEffect, useLayoutEffect, useRef, useState } from "react";

/**
 * A Task's text: at most two lines at rest, all of it while edited.
 *
 * Editing happens in place, in a textarea that grows with the text and shares
 * the display's type and padding, so the row only grows and never jumps. A
 * Task is one line of text: Enter saves, a pasted line break becomes a space,
 * and blank text is never saved. Escape puts the text back.
 */
export function TaskTextField({
  value,
  onSave,
  disabled = false,
  className,
}: {
  value: string;
  onSave: (text: string) => unknown;
  disabled?: boolean;
  className?: string;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(value);
  const field = useRef<HTMLTextAreaElement>(null);

  // Fits the field to its text before it paints, on every keystroke.
  useLayoutEffect(() => {
    const element = field.current;
    if (!element) return;
    element.style.height = "auto";
    element.style.height = `${element.scrollHeight}px`;
  }, [editing, draft]);

  // Opened on purpose, to write in: the caret goes to the end.
  useEffect(() => {
    const element = field.current;
    if (!editing || !element) return;
    element.focus();
    element.setSelectionRange(element.value.length, element.value.length);
  }, [editing]);

  const commit = () => {
    setEditing(false);
    const text = draft.replace(/\s+/g, " ").trim();
    if (text && text !== value) onSave(text);
  };
  const cancel = () => {
    setEditing(false);
    setDraft(value);
  };

  const shared = cn(
    "-mx-1 block w-[calc(100%+0.5rem)] rounded-md px-1 py-0.5 text-left text-sm leading-snug",
    className,
  );

  if (editing) {
    return (
      <textarea
        ref={field}
        rows={1}
        value={draft}
        aria-label="Task"
        // Its Escape cancels the edit alone, never the Thread drawer around it.
        data-keeps-escape=""
        onChange={(event) => setDraft(event.target.value.replace(/\n/g, " "))}
        onBlur={commit}
        onKeyDown={(event) => {
          if (event.key === "Enter" && !event.nativeEvent.isComposing) {
            event.preventDefault();
            commit();
          }
          if (event.key === "Escape") {
            event.preventDefault();
            cancel();
          }
        }}
        className={cn(
          shared,
          "resize-none overflow-hidden bg-muted/50 outline-none ring-1 ring-border",
        )}
      />
    );
  }

  return (
    <button
      type="button"
      disabled={disabled}
      onClick={() => {
        setDraft(value);
        setEditing(true);
      }}
      className={cn(
        shared,
        "cursor-text outline-none transition-colors hover:bg-muted/40 focus-visible:ring-2 focus-visible:ring-ring/40 disabled:pointer-events-none disabled:opacity-50 motion-reduce:transition-none",
      )}
    >
      <span className="line-clamp-2">{value}</span>
    </button>
  );
}
