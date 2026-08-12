import type { ProjectedThread } from "@convex/lib/validators";

import { EditableField } from "@/components/ui/editable-field";

interface ThreadHeaderProps {
  thread: ProjectedThread;
  onTitleSave: (title: string) => void;
}

export function ThreadHeader({ thread, onTitleSave }: ThreadHeaderProps) {
  return (
    <EditableField
      value={thread.title}
      onSave={onTitleSave}
      className="font-heading text-xl font-semibold tracking-tight"
    />
  );
}
