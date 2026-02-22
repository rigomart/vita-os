import { X } from "lucide-react";
import { useRef, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import {
  Popover,
  PopoverAnchor,
  PopoverContent,
} from "@/components/ui/popover";

const PROBLEM_TYPE_TAGS = ["clear", "complicated", "complex"];

export function TagInput({
  tags,
  suggestions,
  onAdd,
  onRemove,
}: {
  tags: string[];
  suggestions: string[];
  onAdd: (tag: string) => void;
  onRemove: (tag: string) => void;
}) {
  const [input, setInput] = useState("");
  const [open, setOpen] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const normalized = input.trim().toLowerCase();

  // Merge suggestions with problem-type tags, excluding already-added tags
  const allSuggestions = [
    ...new Set([...suggestions, ...PROBLEM_TYPE_TAGS]),
  ].filter((s) => !tags.includes(s));

  const filtered = normalized
    ? allSuggestions.filter((s) => s.includes(normalized))
    : allSuggestions;

  const handleAdd = (tag: string) => {
    const t = tag.trim().toLowerCase();
    if (!t || tags.includes(t)) return;
    onAdd(t);
    setInput("");
    setOpen(false);
    inputRef.current?.focus();
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
      e.preventDefault();
      if (normalized) handleAdd(normalized);
    }
    if (e.key === "Escape") {
      setOpen(false);
    }
  };

  return (
    <div className="space-y-1.5">
      {tags.length > 0 && (
        <div className="flex flex-wrap gap-1">
          {tags.map((tag) => (
            <Badge
              key={tag}
              variant="secondary"
              className="gap-0.5 pr-1 text-xs"
            >
              {tag}
              <button
                type="button"
                onClick={() => onRemove(tag)}
                className="ml-0.5 rounded-full p-0.5 transition-colors hover:bg-muted-foreground/20"
              >
                <X className="h-2.5 w-2.5" />
              </button>
            </Badge>
          ))}
        </div>
      )}
      <Popover open={open && filtered.length > 0} onOpenChange={setOpen}>
        <PopoverAnchor asChild>
          <Input
            ref={inputRef}
            value={input}
            onChange={(e) => {
              setInput(e.target.value);
              if (e.target.value.trim()) {
                setOpen(true);
              }
            }}
            onFocus={() => {
              if (input.trim() || allSuggestions.length > 0) {
                setOpen(true);
              }
            }}
            onBlur={(e) => {
              // Close unless focus moved into the popover
              const related = e.relatedTarget as Node | null;
              if (
                related &&
                e.currentTarget
                  .closest("[data-slot='popover']")
                  ?.contains(related)
              ) {
                return;
              }
              setTimeout(() => setOpen(false), 150);
            }}
            onKeyDown={handleKeyDown}
            placeholder="Add a tag..."
            className="h-7 text-xs"
          />
        </PopoverAnchor>
        <PopoverContent
          className="w-48 p-1"
          align="start"
          onOpenAutoFocus={(e) => e.preventDefault()}
          onCloseAutoFocus={(e) => e.preventDefault()}
          onInteractOutside={(e) => {
            if (inputRef.current?.contains(e.target as Node)) {
              e.preventDefault();
            }
          }}
        >
          {filtered.map((suggestion) => (
            <button
              key={suggestion}
              type="button"
              onClick={() => handleAdd(suggestion)}
              className="flex w-full items-center justify-between rounded-sm px-2 py-1.5 text-sm transition-colors hover:bg-surface-3"
            >
              <span>{suggestion}</span>
              {PROBLEM_TYPE_TAGS.includes(suggestion) && (
                <span className="text-[10px] text-muted-foreground">
                  cynefin
                </span>
              )}
            </button>
          ))}
        </PopoverContent>
      </Popover>
    </div>
  );
}
