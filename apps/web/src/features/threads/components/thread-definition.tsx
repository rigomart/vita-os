import { EditableField } from "@/components/ui/editable-field";

interface ThreadDefinitionProps {
  summary: string;
  onSave: (summary: string) => void;
}

export function ThreadDefinition({ summary, onSave }: ThreadDefinitionProps) {
  return (
    <div className="flex flex-col gap-2">
      <span className="text-xs font-medium text-muted-foreground">Summary</span>
      <EditableField
        value={summary}
        onSave={onSave}
        variant="textarea"
        placeholder="What is this thread about?"
        className="text-sm leading-relaxed"
      />
    </div>
  );
}
