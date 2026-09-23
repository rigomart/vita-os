import type { Thread } from "@vita-os/contracts";

import { EditableField } from "../../ui/editable-field";

interface ThreadHeaderProps {
  thread: Thread;
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
