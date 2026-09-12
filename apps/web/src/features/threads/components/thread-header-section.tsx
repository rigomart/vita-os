import type { Thread } from "@vita-os/contracts";

import { useThreadPaneNav } from "@/features/threads/thread-detail/thread-pane-nav";
import { useUpdateThread } from "@/features/threads/use-update-thread";

import { ThreadHeader } from "./thread-header";

interface ThreadHeaderProps {
  thread: Thread;
  areaSlug: string;
}

export function ThreadHeaderSection({ thread, areaSlug }: ThreadHeaderProps) {
  const { onThreadLocationChange } = useThreadPaneNav();
  const updateThread = useUpdateThread(thread);

  const handleTitleSave = async (title: string) => {
    if (!title) return;
    const result = await updateThread({ id: thread._id, title });
    if (result?.slug && result.slug !== thread.slug) {
      onThreadLocationChange({ areaSlug, threadSlug: result.slug });
    }
  };

  return <ThreadHeader thread={thread} onTitleSave={handleTitleSave} />;
}
