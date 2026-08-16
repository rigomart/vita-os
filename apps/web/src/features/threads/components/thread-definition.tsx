import { EditableField } from "@/components/ui/editable-field";
import { cn } from "@/lib/utils";

interface ThreadDefinitionProps {
  summary: string;
  onSave: (summary: string) => void;
}

export function ThreadDefinition({ summary, onSave }: ThreadDefinitionProps) {
  return (
    <div data-slot="thread-summary" className="min-h-9">
      {/* Never clamped: the whole definition is on screen without a click, and
          the field grows with its content while editing. */}
      <EditableField
        value={summary}
        onSave={onSave}
        variant="textarea"
        textareaRows={1}
        inputAriaLabel="Thread summary"
        placeholder="Add a summary…"
        className="min-h-0 py-1.5 text-sm leading-relaxed text-muted-foreground"
        displayClassName={cn(
          "border-b-0 whitespace-pre-wrap",
          summary
            ? "hover:bg-transparent"
            : "h-7 w-fit cursor-pointer items-center rounded-4xl bg-secondary px-2.5 py-0 text-xs font-medium hover:bg-secondary/80",
        )}
        editorClassName="rounded-lg border border-border/60 bg-muted/20 px-2.5 hover:bg-muted/20 focus-visible:bg-muted/20"
      />
    </div>
  );
}
