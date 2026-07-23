import type { Doc } from "@convex/_generated/dataModel";

import { api } from "@convex/_generated/api";
import { useNavigate } from "@tanstack/react-router";
import { Badge } from "@vita-os/ui/components/badge";
import { Button } from "@vita-os/ui/components/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@vita-os/ui/components/card";
import {
  Drawer,
  DrawerContent,
  DrawerDescription,
  DrawerTitle,
} from "@vita-os/ui/components/drawer";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetTitle,
} from "@vita-os/ui/components/sheet";
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
import { useDeferredOverlayClose } from "./use-deferred-overlay-close";

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

  const { open, requestClose, handleOpenChange, completeOpenChange } =
    useDeferredOverlayClose(() => {
      navigate({
        to: "/$areaSlug",
        params: { areaSlug },
        replace: true,
      });
    });

  const title = thread?.title ?? "Thread detail";
  const content =
    area === undefined || thread === undefined ? (
      <ThreadDetailSkeleton />
    ) : area === null || thread === null || thread.areaId !== area._id ? (
      <ThreadNotFound areaSlug={areaSlug} />
    ) : (
      <ThreadDetailContent
        areaSlug={areaSlug}
        threadSlug={threadSlug}
        thread={thread}
        onRequestClose={requestClose}
      />
    );

  if (isMobile) {
    return (
      <Drawer
        open={open}
        direction="bottom"
        onOpenChange={handleOpenChange}
        onAnimationEnd={completeOpenChange}
      >
        <DrawerContent className="h-[90dvh] max-h-[90dvh] p-0 before:inset-0 before:rounded-t-4xl data-[vaul-drawer-direction=bottom]:max-h-[90dvh]">
          <DrawerTitle className="sr-only">{title}</DrawerTitle>
          <DrawerDescription className="sr-only">
            Review and update this Thread.
          </DrawerDescription>
          <ThreadCloseButton onClick={requestClose} />
          <div className="min-h-0 flex-1 overflow-y-auto px-5 pt-8 pb-[calc(2rem+env(safe-area-inset-bottom))]">
            {content}
          </div>
        </DrawerContent>
      </Drawer>
    );
  }

  return (
    <Sheet
      open={open}
      onOpenChange={handleOpenChange}
      onOpenChangeComplete={completeOpenChange}
    >
      <SheetContent
        side="right"
        showCloseButton={false}
        overlayClassName="bg-black/20 supports-backdrop-filter:backdrop-blur-none"
        className="ease-[cubic-bezier(0.32,0.72,0,1)] data-[side=right]:w-[clamp(35rem,45vw,45rem)] data-[side=right]:sm:max-w-none data-[side=right]:data-ending-style:translate-x-full data-[side=right]:data-starting-style:translate-x-full"
      >
        <SheetTitle className="sr-only">{title}</SheetTitle>
        <SheetDescription className="sr-only">
          Review and update this Thread.
        </SheetDescription>
        <ThreadCloseButton onClick={requestClose} />
        <div className="min-h-0 flex-1 overflow-y-auto px-6 py-8">
          {content}
        </div>
      </SheetContent>
    </Sheet>
  );
}

function ThreadCloseButton({ onClick }: { onClick: () => void }) {
  return (
    <Button
      variant="ghost"
      size="icon-sm"
      className="absolute right-4 top-4 z-20 bg-secondary"
      onClick={onClick}
      aria-label="Close thread"
    >
      <X data-icon="inline-start" />
    </Button>
  );
}

interface ThreadDetailContentProps extends ThreadDetailSheetProps {
  thread: Doc<"threads">;
  onRequestClose: () => void;
}

function ThreadDetailContent({
  areaSlug,
  threadSlug,
  thread,
  onRequestClose,
}: ThreadDetailContentProps) {
  const isResolved = thread.state === "resolved";

  return (
    <div className="flex flex-col gap-6">
      <header
        role="banner"
        aria-label="Thread header"
        className="sticky top-0 z-10 flex flex-col gap-3 bg-popover pb-4"
      >
        <div className="flex items-center gap-2 pr-10">
          <ThreadAreaSectionSection
            areaSlug={areaSlug}
            threadSlug={threadSlug}
          />
          {isResolved && <Badge variant="secondary">Resolved</Badge>}
          <div className="ml-auto">
            <ThreadLifecycleActionsSection
              threadSlug={threadSlug}
              onRequestClose={onRequestClose}
            />
          </div>
        </div>
        <ThreadHeaderSection areaSlug={areaSlug} threadSlug={threadSlug} />
      </header>

      <ThreadDefinitionSection threadSlug={threadSlug} />

      {!isResolved && (
        <Card
          role="region"
          aria-label="Thread attention"
          size="sm"
          className="gap-0"
        >
          <CardHeader className="sr-only">
            <CardTitle>Thread attention</CardTitle>
            <CardDescription>
              The next useful move and when to revisit this Thread.
            </CardDescription>
          </CardHeader>
          <CardContent className="grid gap-6 sm:grid-cols-2">
            <NextMoveSection threadSlug={threadSlug} />
            <FollowUpSection threadSlug={threadSlug} />
          </CardContent>
        </Card>
      )}

      <div>
        <ActivityLogSection threadSlug={threadSlug} />
      </div>
    </div>
  );
}
