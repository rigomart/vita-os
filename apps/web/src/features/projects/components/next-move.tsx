import { Button } from "@vita-os/ui/components/button";
import { Check, MoveRight, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { cn } from "@/lib/utils";

interface NextMoveProps {
  nextMove: string | undefined;
  onSet: (text: string) => void;
  onClear: () => void;
  onComplete: () => void;
}

export function NextMove({
  nextMove,
  onSet,
  onClear,
  onComplete,
}: NextMoveProps) {
  const [addText, setAddText] = useState("");

  const handleAdd = () => {
    const text = addText.trim();
    if (!text) return;
    onSet(text);
    setAddText("");
  };

  return (
    <div className="rounded-xl border border-border-subtle bg-surface-2 p-4">
      <div className="mb-3 flex items-center gap-2 text-xs font-medium text-muted-foreground">
        <MoveRight className="h-3.5 w-3.5" />
        Next Move
      </div>

      {nextMove ? (
        <NextMoveItem
          text={nextMove}
          onSet={onSet}
          onClear={onClear}
          onComplete={onComplete}
        />
      ) : (
        <div className="flex gap-2">
          <input
            type="text"
            value={addText}
            onChange={(e) => setAddText(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                handleAdd();
              }
            }}
            placeholder="Add a next move..."
            className="w-full rounded bg-transparent px-2 py-1.5 text-sm outline-none placeholder:text-muted-foreground/50 focus:ring-1 focus:ring-ring"
          />
        </div>
      )}
    </div>
  );
}

function NextMoveItem({
  text,
  onSet,
  onClear,
  onComplete,
}: {
  text: string;
  onSet: (text: string) => void;
  onClear: () => void;
  onComplete: () => void;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(text);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setDraft(text);
  }, [text]);

  useEffect(() => {
    if (editing) {
      inputRef.current?.focus();
    }
  }, [editing]);

  const commit = () => {
    setEditing(false);
    const trimmed = draft.trim();
    if (trimmed && trimmed !== text) {
      onSet(trimmed);
    } else {
      setDraft(text);
    }
  };

  return (
    <div className="flex items-center gap-2 rounded-lg bg-surface-3/60 px-2 py-1.5">
      <Button
        variant="ghost"
        size="icon-xs"
        onClick={onComplete}
        className="rounded-full border border-green-500/40 text-green-600 hover:bg-green-500/10 hover:text-green-600"
        aria-label="Complete next move"
      >
        <Check />
      </Button>

      {editing ? (
        <input
          ref={inputRef}
          type="text"
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onBlur={commit}
          onKeyDown={(e) => {
            if (e.key === "Enter") commit();
            if (e.key === "Escape") {
              setEditing(false);
              setDraft(text);
            }
          }}
          className="min-w-0 flex-1 rounded border-none bg-transparent px-1 py-0.5 text-sm outline-none ring-1 ring-ring"
        />
      ) : (
        <button
          type="button"
          onClick={() => setEditing(true)}
          className={cn(
            "min-w-0 flex-1 cursor-text truncate rounded px-1 py-0.5 text-left text-sm font-medium transition-colors hover:bg-muted/50",
          )}
        >
          {text}
        </button>
      )}

      <Button
        variant="ghost"
        size="icon-xs"
        onClick={onClear}
        className="text-muted-foreground/40 opacity-0 hover:text-destructive group-hover:opacity-100"
        aria-label="Clear next move"
      >
        <X />
      </Button>
    </div>
  );
}
