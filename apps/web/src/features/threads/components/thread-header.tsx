import type { ThreadView } from "@/features/threads/thread-view";

import { EditableField } from "@/components/ui/editable-field";

interface ThreadHeaderProps {
  thread: ThreadView;
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
