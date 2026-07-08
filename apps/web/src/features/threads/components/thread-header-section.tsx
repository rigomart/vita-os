import { api } from "@convex/_generated/api";
import { useNavigate } from "@tanstack/react-router";

import { useUpdateThread } from "@/features/threads/use-update-thread";
import { useStableQuery } from "@/hooks/use-stable-query";

import { ThreadHeader } from "./thread-header";

interface ThreadHeaderProps {
  areaSlug: string;
  threadSlug: string;
}

export function ThreadHeaderSection({
  areaSlug,
  threadSlug,
}: ThreadHeaderProps) {
  const thread = useStableQuery(api.threads.getBySlug, {
    slug: threadSlug,
  });
  const navigate = useNavigate();
  const updateThread = useUpdateThread(threadSlug);

  const handleTitleSave = async (title: string) => {
    if (!title || !thread) return;
    const result = await updateThread({ id: thread._id, title });
    if (result?.slug) {
      navigate({
        to: "/$areaSlug/$threadSlug",
        params: { areaSlug, threadSlug: result.slug },
        replace: true,
      });
    }
  };

  if (!thread) return null;

  return <ThreadHeader thread={thread} onTitleSave={handleTitleSave} />;
}
