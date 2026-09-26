import type { Thread } from "@vita-os/contracts";

import { useThreadPaneNav } from "../thread-detail/thread-pane-nav";
import { useUpdateThread } from "../use-update-thread";
import { ThreadHeader } from "./thread-header";

interface ThreadHeaderProps {
  thread: Thread;
}

export function ThreadHeaderSection({ thread }: ThreadHeaderProps) {
  const { onThreadLocationChange } = useThreadPaneNav();
  const updateThread = useUpdateThread(thread);

  const handleTitleSave = async (title: string) => {
    if (!title) return;
    const result = await updateThread({ title });
    if (result?.slug && result.slug !== thread.slug) {
      onThreadLocationChange({ threadSlug: result.slug });
    }
  };

  return <ThreadHeader thread={thread} onTitleSave={handleTitleSave} />;
}
