import { Input } from "@vita-os/ui/components/input";
import { Textarea } from "@vita-os/ui/components/textarea";
import { cn } from "@vita-os/ui/lib/utils";
import { useEffect, useRef, useState } from "react";

interface EditableFieldProps {
  value: string;
  onSave: (value: string) => void;
  variant?: "input" | "textarea";
  placeholder?: string;
  className?: string;
  displayClassName?: string;
  /** Ref to the display button, so callers can measure the rendered text. */
  displayRef?: React.Ref<HTMLButtonElement>;
  editorClassName?: string;
  textareaRows?: number;
  startEditing?: boolean;
  disabled?: boolean;
  inputAriaLabel?: string;
  /** Keep the native editor mounted so pointer clicks and selections land directly in the text. */
  editOnFocus?: boolean;
  /**
   * Drop the field's own underline and hover fill, for a surface that is
   * already legibly editable — a Note card, where the text is the surface and
   * the card frame carries the state instead.
   */
  chromeless?: boolean;
}

const editableFieldStyles = cn(
  "col-start-1 row-start-1 w-full min-w-0 rounded-none border-0 border-b border-border/30 bg-transparent px-0 shadow-none transition-[border-color,background-color,color]",
  "hover:border-border/70 hover:bg-muted/40",
  "focus-visible:border-foreground focus-visible:bg-muted/20 focus-visible:ring-0 focus-visible:outline-none",
  "disabled:pointer-events-none disabled:opacity-50",
);

export function EditableField({
  value,
  onSave,
  variant = "input",
  placeholder = "Click to edit...",
  className,
  displayClassName: displayClassNameProp,
  displayRef,
  editorClassName,
  textareaRows = 3,
  startEditing = false,
  disabled = false,
  inputAriaLabel,
  editOnFocus = false,
  chromeless = false,
}: EditableFieldProps) {
  const [editing, setEditing] = useState(startEditing);
  const [draft, setDraft] = useState(value);
  const inputRef = useRef<HTMLInputElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const isCommittingRef = useRef(false);

  useEffect(() => {
    setDraft(value);
  }, [value]);

  useEffect(() => {
    if (!editing) return;
    if (variant === "textarea") {
      textareaRef.current?.focus();
    } else {
      inputRef.current?.focus();
    }
  }, [editing, variant]);

  const commit = () => {
    if (isCommittingRef.current || disabled) {
      return;
    }

    isCommittingRef.current = true;
    const trimmed = draft.trim();
    setEditing(false);
    // Match the display-mode behavior until the caller supplies the saved value,
    // including when it rejects an empty draft or a save fails.
    if (editOnFocus) setDraft(value);

    if (trimmed !== value) {
      onSave(trimmed);
    }

    queueMicrotask(() => {
      isCommittingRef.current = false;
    });
  };

  const cancel = () => {
    setEditing(false);
    setDraft(value);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Escape") {
      cancel();
    }
    if (e.key === "Enter" && variant === "input") {
      commit();
    }
  };

  const fieldClassName = cn(
    editableFieldStyles,
    chromeless && "border-b-0 hover:border-transparent hover:bg-transparent",
    variant === "input" && "py-1.5",
    variant === "textarea" &&
      "min-h-[5.5rem] resize-none py-2 field-sizing-content",
    className,
  );

  const displayClassName = cn(
    fieldClassName,
    // `text-left` resets the UA stylesheet's centered button text.
    "flex items-start justify-start text-left font-inherit leading-inherit tracking-inherit",
    displayClassNameProp,
  );

  const editorFieldClassName = cn(fieldClassName, editorClassName);

  const displayValue = value || placeholder;
  const isPlaceholder = !value;

  return (
    <div className="grid w-full items-start text-left">
      {!editOnFocus && (
        <button
          ref={displayRef}
          type="button"
          onClick={() => {
            if (!disabled) {
              setEditing(true);
            }
          }}
          disabled={disabled}
          tabIndex={editing ? -1 : 0}
          aria-hidden={editing}
          className={cn(
            displayClassName,
            "cursor-text",
            editing && "pointer-events-none invisible",
            !editing && !chromeless && "hover:border-border hover:bg-muted/40",
            isPlaceholder && "text-muted-foreground",
          )}
        >
          {displayValue}
        </button>
      )}

      {(editing || editOnFocus) &&
        (variant === "textarea" ? (
          <Textarea
            ref={textareaRef}
            variant="inline"
            rows={textareaRows}
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onBlur={commit}
            onKeyDown={handleKeyDown}
            placeholder={placeholder}
            disabled={disabled}
            aria-label={inputAriaLabel}
            aria-busy={disabled}
            className={editorFieldClassName}
          />
        ) : (
          <Input
            ref={inputRef}
            variant="inline"
            type="text"
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onBlur={commit}
            onKeyDown={handleKeyDown}
            placeholder={placeholder}
            disabled={disabled}
            aria-label={inputAriaLabel}
            aria-busy={disabled}
            className={editorFieldClassName}
          />
        ))}
    </div>
  );
}
