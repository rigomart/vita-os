import { useEffect, useRef, useState } from "react";
import { cn } from "@/lib/utils";

interface EditableFieldProps {
  value: string;
  onSave: (value: string) => void;
  variant?: "input" | "textarea";
  placeholder?: string;
  className?: string;
}

export function EditableField({
  value,
  onSave,
  variant = "input",
  placeholder = "Click to edit...",
  className,
}: EditableFieldProps) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(value);
  const inputRef = useRef<HTMLInputElement | HTMLTextAreaElement>(null);

  useEffect(() => {
    setDraft(value);
  }, [value]);

  useEffect(() => {
    if (editing) {
      inputRef.current?.focus();
    }
  }, [editing]);

  const commit = () => {
    setEditing(false);
    const trimmed = draft.trim();
    if (trimmed !== value) {
      onSave(trimmed);
    }
  };

  const cancel = () => {
    setEditing(false);
    setDraft(value);
  };

  if (!editing) {
    return (
      <button
        type="button"
        onClick={() => setEditing(true)}
        className={cn(
          "w-full cursor-text rounded px-1 py-0.5 text-left",
          "transition-colors hover:bg-muted/50",
          !value && "text-muted-foreground",
          className,
        )}
      >
        {value || placeholder}
      </button>
    );
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Escape") {
      cancel();
    }
    if (e.key === "Enter" && variant === "input") {
      commit();
    }
  };

  const sharedProps = {
    ref: inputRef as never,
    value: draft,
    onChange: (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
      setDraft(e.target.value),
    onBlur: commit,
    onKeyDown: handleKeyDown,
    placeholder,
    className: cn(
      "w-full rounded border-none bg-transparent px-1 py-0.5",
      "outline-none ring-1 ring-ring",
      className,
    ),
  };

  if (variant === "textarea") {
    return <textarea rows={3} {...sharedProps} />;
  }

  return <input type="text" {...sharedProps} />;
}
