import { EditableField } from "@/components/ui/editable-field";
import { cn } from "@/lib/utils";

interface ThreadDefinitionProps {
  summary: string;
  onSave: (summary: string) => void;
}

/**
 * The Thread's one-line orientation. Empty, it is a quiet text action and
 * nothing else; filled, it is a single muted line under the title. Anything
 * past that line is read in the editor the line opens — the pane's job is to
 * say what this Thread is, not to hold the whole account of it.
 */
export function ThreadDefinition({ summary, onSave }: ThreadDefinitionProps) {
  return (
    <div data-slot="thread-summary" className="min-h-7">
      <EditableField
        value={summary}
        onSave={onSave}
        variant="textarea"
        textareaRows={1}
        inputAriaLabel="Thread summary"
        placeholder="Add a summary…"
        className="min-h-0 py-1 text-sm leading-relaxed text-muted-foreground"
        displayClassName={cn(
          "border-b-0 hover:bg-transparent",
          summary
            ? // `block` because the field's display is a flex button, and
              // ellipsis truncation needs a block container to apply to.
              "block max-w-[65ch] truncate"
            : "h-7 w-fit cursor-pointer items-center px-0 py-0 text-xs font-medium hover:text-foreground",
        )}
        editorClassName="rounded-lg border border-border/60 bg-muted/20 px-2.5 hover:bg-muted/20 focus-visible:bg-muted/20"
      />
    </div>
  );
}
