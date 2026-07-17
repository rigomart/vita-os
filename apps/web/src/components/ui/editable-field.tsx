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
  startEditing?: boolean;
  disabled?: boolean;
  inputAriaLabel?: string;
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
  startEditing = false,
  disabled = false,
  inputAriaLabel,
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
    variant === "input" && "py-1.5",
    variant === "textarea" &&
      "min-h-[5.5rem] resize-none py-2 field-sizing-content",
    className,
  );

  const displayClassName = cn(
    fieldClassName,
    "flex items-start justify-start font-inherit leading-inherit tracking-inherit",
  );

  const displayValue = value || placeholder;
  const isPlaceholder = !value;

  return (
    <div className="grid w-full items-start text-left">
      <button
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
          !editing && "hover:border-border hover:bg-muted/40",
          isPlaceholder && "text-muted-foreground",
        )}
      >
        {displayValue}
      </button>

      {editing &&
        (variant === "textarea" ? (
          <Textarea
            ref={textareaRef}
            variant="inline"
            rows={3}
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onBlur={commit}
            onKeyDown={handleKeyDown}
            placeholder={placeholder}
            disabled={disabled}
            aria-label={inputAriaLabel}
            aria-busy={disabled}
            className={fieldClassName}
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
            className={fieldClassName}
          />
        ))}
    </div>
  );
}
