import { useEffect, useRef, useState } from "react";

import { EditableField } from "@/components/ui/editable-field";
import { cn } from "@/lib/utils";

interface ThreadDefinitionProps {
  summary: string;
  onSave: (summary: string) => void;
}

export function ThreadDefinition({ summary, onSave }: ThreadDefinitionProps) {
  const [expanded, setExpanded] = useState(false);
  const [overflowing, setOverflowing] = useState(false);
  const displayRef = useRef<HTMLButtonElement>(null);

  // A collapsed summary is clamped, so the toggle only earns its place when the
  // text really spills past the clamp. Measuring is skipped while expanded,
  // where nothing is clipped and the answer would always be "it fits".
  useEffect(() => {
    if (expanded) return;

    const display = displayRef.current;
    if (!display) return;

    setOverflowing(display.scrollHeight > display.clientHeight);
  }, [summary, expanded]);

  return (
    <div data-slot="thread-summary" className="min-h-9">
      <EditableField
        value={summary}
        onSave={onSave}
        variant="textarea"
        textareaRows={1}
        inputAriaLabel="Thread summary"
        placeholder="Add a summary…"
        displayRef={displayRef}
        className="min-h-0 py-1.5 text-sm leading-relaxed text-muted-foreground"
        displayClassName={cn(
          "border-b-0 whitespace-pre-wrap",
          summary
            ? "max-w-[65ch] hover:bg-transparent"
            : "h-7 w-fit cursor-pointer items-center rounded-4xl bg-secondary px-2.5 py-0 text-xs font-medium hover:bg-secondary/80",
          // `!` because the clamp needs `display: -webkit-box` and Tailwind
          // emits `.flex`, which the display button already carries, after it.
          summary && !expanded && "line-clamp-6!",
        )}
        editorClassName="rounded-lg border border-border/60 bg-muted/20 px-2.5 hover:bg-muted/20 focus-visible:bg-muted/20"
      />

      {summary && overflowing ? (
        <button
          type="button"
          onClick={() => setExpanded((current) => !current)}
          className="text-xs font-medium text-muted-foreground transition-colors hover:text-foreground"
        >
          {expanded ? "Show less" : "Show more"}
        </button>
      ) : null}
    </div>
  );
}
