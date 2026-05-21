import type { Id } from "@convex/_generated/dataModel";

import { api } from "@convex/_generated/api";
import { useNavigate } from "@tanstack/react-router";
import { useQuery } from "convex-helpers/react/cache/hooks";

import { ThreadAreaSection } from "@/features/threads/components/thread-area-section";
import { useUpdateThread } from "@/features/threads/use-update-thread";
import { useStableQuery } from "@/hooks/use-stable-query";

interface ThreadAreaSectionSectionProps {
  areaSlug: string;
  threadSlug: string;
}

export function ThreadAreaSectionSection({
  areaSlug,
  threadSlug,
}: ThreadAreaSectionSectionProps) {
  const areas = useQuery(api.areas.list);
  const thread = useStableQuery(api.threads.getBySlug, {
    slug: threadSlug,
  });
  const navigate = useNavigate();
  const updateThread = useUpdateThread(threadSlug);

  if (!areas || !thread) return null;

  const handleMove = async (areaId: Id<"areas">) => {
    if (areaId === thread.areaId) return;

    await updateThread({ id: thread._id, areaId });
    const targetArea = areas.find((area) => area._id === areaId);
    if (!targetArea) return;

    const nextAreaSlug = targetArea.slug ?? targetArea._id;
    if (nextAreaSlug !== areaSlug) {
      navigate({
        to: "/$areaSlug/$threadSlug",
        params: { areaSlug: nextAreaSlug, threadSlug },
        replace: true,
      });
    }
  };

  return (
    <ThreadAreaSection areas={areas} thread={thread} onMove={handleMove} />
  );
}
