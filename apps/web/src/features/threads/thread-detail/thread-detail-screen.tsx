import { api } from "@convex/_generated/api";
import { FollowUpSection } from "@/features/threads/components/follow-up-section";
import { NextMoveSection } from "@/features/threads/components/next-move-section";
import { ThreadAreaSectionSection } from "@/features/threads/components/thread-area-section-section";
import { ThreadDefinitionSection } from "@/features/threads/components/thread-definition-section";
import { ThreadDetailSkeleton } from "@/features/threads/components/thread-detail-skeleton";
import { ThreadHeaderSection } from "@/features/threads/components/thread-header-section";
import { ThreadLifecycleActionsSection } from "@/features/threads/components/thread-lifecycle-actions-section";
import { ActivityLogSection } from "@/features/threads/components/thread-log-section";
import { useDocumentTitle } from "@/hooks/use-document-title";
import { useStableQuery } from "@/hooks/use-stable-query";
import { ThreadNotFound } from "./thread-not-found";

interface ThreadDetailScreenProps {
  areaSlug: string;
  threadSlug: string;
}

export function ThreadDetailScreen({
  areaSlug,
  threadSlug,
}: ThreadDetailScreenProps) {
  const area = useStableQuery(api.areas.getBySlug, { slug: areaSlug });
  const thread = useStableQuery(api.threads.getBySlug, {
    slug: threadSlug,
  });

  useDocumentTitle(thread?.title ?? "Thread");

  if (area === undefined || thread === undefined) {
    return <ThreadDetailSkeleton />;
  }

  if (area === null || thread === null || thread.areaId !== area._id) {
    return <ThreadNotFound areaSlug={areaSlug} />;
  }

  return (
    <div className="mx-auto max-w-3xl space-y-8">
      <ThreadHeaderSection areaSlug={areaSlug} threadSlug={threadSlug} />

      <ThreadAreaSectionSection areaSlug={areaSlug} threadSlug={threadSlug} />

      <NextMoveSection threadSlug={threadSlug} />

      <FollowUpSection threadSlug={threadSlug} />

      <ThreadDefinitionSection threadSlug={threadSlug} />

      <ThreadLifecycleActionsSection
        areaSlug={areaSlug}
        threadSlug={threadSlug}
      />

      <ActivityLogSection threadSlug={threadSlug} />
    </div>
  );
}
