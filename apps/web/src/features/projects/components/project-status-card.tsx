import { Target } from "lucide-react";
import { EditableField } from "@/components/ui/editable-field";

interface ProjectStatusCardProps {
  status?: string;
  onSave: (status: string) => void;
}

export function ProjectStatusCard({ status, onSave }: ProjectStatusCardProps) {
  return (
    <div className="rounded-xl border border-border-subtle bg-surface-2 p-4">
      <div className="mb-2 flex items-center gap-2 text-xs font-medium text-muted-foreground">
        <Target className="h-3.5 w-3.5" />
        Status
      </div>
      <EditableField
        value={status ?? ""}
        onSave={onSave}
        placeholder="Where things stand..."
        className="text-sm"
      />
    </div>
  );
}
