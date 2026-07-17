import { api } from "@convex/_generated/api";
import { useNavigate } from "@tanstack/react-router";
import { Button } from "@vita-os/ui/components/button";
import {
  Drawer,
  DrawerContent,
  DrawerTitle,
} from "@vita-os/ui/components/drawer";
import { Sheet, SheetContent, SheetTitle } from "@vita-os/ui/components/sheet";
import { useIsMobile } from "@vita-os/ui/hooks/use-mobile";
import { X } from "lucide-react";

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

interface ThreadDetailSheetProps {
  areaSlug: string;
  threadSlug: string;
}

export function ThreadDetailSheet({
  areaSlug,
  threadSlug,
}: ThreadDetailSheetProps) {
  const isMobile = useIsMobile();
  const navigate = useNavigate();
  const area = useStableQuery(api.areas.getBySlug, { slug: areaSlug });
  const thread = useStableQuery(api.threads.getBySlug, {
    slug: threadSlug,
  });

  useDocumentTitle(thread?.title ?? "Thread");

  const closeSheet = () => {
    navigate({
      to: "/$areaSlug",
      params: { areaSlug },
      replace: true,
    });
  };

  const handleOpenChange = (open: boolean) => {
    if (!open) closeSheet();
  };

  const title = thread?.title ?? "Thread detail";
  const content =
    area === undefined || thread === undefined ? (
      <ThreadDetailSkeleton />
    ) : area === null || thread === null || thread.areaId !== area._id ? (
      <ThreadNotFound areaSlug={areaSlug} />
    ) : (
      <ThreadDetailContent areaSlug={areaSlug} threadSlug={threadSlug} />
    );

  if (isMobile) {
    return (
      <Drawer open direction="right" onOpenChange={handleOpenChange}>
        <DrawerContent className="inset-y-0 right-0 h-full w-full p-0 before:inset-0 before:rounded-none sm:max-w-none">
          <DrawerTitle className="sr-only">{title}</DrawerTitle>
          <Button
            variant="ghost"
            size="icon-sm"
            className="absolute right-4 top-4 bg-secondary"
            onClick={closeSheet}
            aria-label="Close thread"
          >
            <X />
          </Button>
          <div className="h-full overflow-y-auto px-5 py-8">{content}</div>
        </DrawerContent>
      </Drawer>
    );
  }

  return (
    <Sheet open onOpenChange={handleOpenChange}>
      <SheetContent side="right" className="w-full sm:max-w-none md:w-[460px]">
        <SheetTitle className="sr-only">{title}</SheetTitle>
        <div className="h-full overflow-y-auto px-6 py-8">{content}</div>
      </SheetContent>
    </Sheet>
  );
}

function ThreadDetailContent({ areaSlug, threadSlug }: ThreadDetailSheetProps) {
  return (
    <div className="flex flex-col">
      <div className="pb-6">
        <ThreadHeaderSection areaSlug={areaSlug} threadSlug={threadSlug} />
      </div>

      {/* Primary: what could move this thread forward */}
      <div className="space-y-6 border-t border-border/50 pt-6">
        <NextMoveSection threadSlug={threadSlug} />
        <FollowUpSection threadSlug={threadSlug} />
      </div>

      {/* Secondary: orientation and placement */}
      <div className="mt-6 space-y-4 border-t border-border/50 pt-6">
        <ThreadAreaSectionSection areaSlug={areaSlug} threadSlug={threadSlug} />
        <ThreadDefinitionSection threadSlug={threadSlug} />
      </div>

      <div className="mt-6 border-t border-border/50 pt-6">
        <ActivityLogSection threadSlug={threadSlug} />
      </div>

      <div className="mt-6">
        <ThreadLifecycleActionsSection
          areaSlug={areaSlug}
          threadSlug={threadSlug}
        />
      </div>
    </div>
  );
}
