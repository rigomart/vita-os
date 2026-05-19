import { CheckCircle2 } from "lucide-react";
import type { ReactNode } from "react";
import { EditableField } from "@/components/ui/editable-field";

interface ProjectDefinitionProps {
  definitionOfDone: string;
  onSave: (definitionOfDone: string) => void;
}

export function ProjectDefinition({
  definitionOfDone,
  onSave,
}: ProjectDefinitionProps) {
  return (
    <div className="space-y-4">
      <MetadataRow
        icon={<CheckCircle2 className="h-3.5 w-3.5" />}
        label="Summary"
      >
        <EditableField
          value={definitionOfDone}
          onSave={onSave}
          variant="textarea"
          placeholder="What is this thread about?"
          className="text-sm"
        />
      </MetadataRow>
    </div>
  );
}

function MetadataRow({
  icon,
  label,
  children,
}: {
  icon: ReactNode;
  label: string;
  children: ReactNode;
}) {
  return (
    <div className="flex items-start gap-3">
      <div className="flex w-36 shrink-0 items-center gap-2 pt-1 text-xs text-muted-foreground">
        {icon}
        {label}
      </div>
      <div className="min-w-0 flex-1">{children}</div>
    </div>
  );
}
