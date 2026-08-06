import type { Doc } from "@convex/_generated/dataModel";

import { api } from "@convex/_generated/api";
import { Badge } from "@vita-os/ui/components/badge";
import { Button } from "@vita-os/ui/components/button";
import {
  ButtonGroup,
  ButtonGroupSeparator,
} from "@vita-os/ui/components/button-group";
import {
  Drawer,
  DrawerContent,
  DrawerDescription,
  DrawerTitle,
} from "@vita-os/ui/components/drawer";
import { Separator } from "@vita-os/ui/components/separator";
import { X } from "lucide-react";
import { useMemo } from "react";

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
import { useThreadPaneViewport } from "@/hooks/use-thread-pane-viewport";

import type { ThreadLocation } from "./thread-pane-nav";

import { ThreadNotFound } from "./thread-not-found";
import { ThreadPaneNavContext } from "./thread-pane-nav";
import { useDeferredRouteClose } from "./use-deferred-route-close";

interface ThreadDetailViewProps {
  threadSlug: string;
  /**
   * Present when the pane was opened via the /$areaSlug/$threadSlug deep
   * link; the thread is then validated to belong to this area. Absent when
   * opened via the `?thread` search param — the area is derived from the
   * thread itself.
   */
  areaSlug?: string;
  onClose: () => void;
  onThreadLocationChange: (location: ThreadLocation) => void;
}

export function ThreadDetailView({
  threadSlug,
  areaSlug,
  onClose,
  onThreadLocationChange,
}: ThreadDetailViewProps) {
  const showDesktopPane = useThreadPaneViewport();
  const thread = useStableQuery(api.threads.getBySlug, { slug: threadSlug });
  const areaBySlug = useStableQuery(
    api.areas.getBySlug,
    areaSlug !== undefined ? { slug: areaSlug } : "skip",
  );
  const areaById = useStableQuery(
    api.areas.get,
    areaSlug === undefined && thread ? { id: thread.areaId } : "skip",
  );
  const area = areaSlug !== undefined ? areaBySlug : areaById;

  useDocumentTitle(thread?.title ?? "Thread");

  const paneNav = useMemo(
    () => ({ onThreadLocationChange }),
    [onThreadLocationChange],
  );

  const title = thread?.title ?? "Thread detail";
  const isLoading =
    thread === undefined || (thread !== null && area === undefined);
  const hasMatchingThread =
    !isLoading &&
    thread !== null &&
    area !== null &&
    area !== undefined &&
    (areaSlug === undefined || thread.areaId === area._id);
  const content = isLoading ? (
    <ThreadDetailSkeleton />
  ) : !hasMatchingThread ? (
    <ThreadNotFound areaSlug={areaSlug} onClose={onClose} />
  ) : (
    <ThreadPaneNavContext.Provider value={paneNav}>
      <ThreadDetailContent
        areaSlug={area.slug ?? area._id}
        threadSlug={threadSlug}
        thread={thread}
      />
    </ThreadPaneNavContext.Provider>
  );

  if (!showDesktopPane) {
    return (
      <ThreadDetailDrawer
        key={threadSlug}
        title={title}
        threadSlug={threadSlug}
        showActions={hasMatchingThread}
        onClosed={onClose}
      >
        {content}
      </ThreadDetailDrawer>
    );
  }

  return (
    <ThreadDetailPane
      title={title}
      threadSlug={threadSlug}
      showActions={hasMatchingThread}
      onClosed={onClose}
    >
      {content}
    </ThreadDetailPane>
  );
}

interface ThreadShellProps {
  title: string;
  threadSlug: string;
  showActions: boolean;
  onClosed: () => void;
  children: React.ReactNode;
}

function ThreadDetailDrawer({
  title,
  threadSlug,
  showActions,
  onClosed,
  children,
}: ThreadShellProps) {
  const { open, requestClose, handleOpenChange, completeOpenChange } =
    useDeferredRouteClose(onClosed);

  return (
    <Drawer
      open={open}
      direction="bottom"
      onOpenChange={handleOpenChange}
      onAnimationEnd={completeOpenChange}
    >
      <DrawerContent
        className="h-[90dvh] max-h-[90dvh] p-0 before:inset-0 before:rounded-t-4xl data-[vaul-drawer-direction=bottom]:max-h-[90dvh]"
        onAnimationEndCapture={(event) => {
          if (
            event.target === event.currentTarget &&
            event.currentTarget.dataset.state === "closed"
          ) {
            completeOpenChange(false);
          }
        }}
      >
        <DrawerTitle className="sr-only">{title}</DrawerTitle>
        <DrawerDescription className="sr-only">
          Review and update this Thread.
        </DrawerDescription>
        <ThreadControls
          threadSlug={threadSlug}
          showActions={showActions}
          onRequestClose={requestClose}
        />
        <div className="flex min-h-0 flex-1 flex-col overflow-hidden px-5 pt-8 pb-[calc(2rem+env(safe-area-inset-bottom))]">
          {children}
        </div>
      </DrawerContent>
    </Drawer>
  );
}

function ThreadDetailPane({
  title,
  threadSlug,
  showActions,
  onClosed,
  children,
}: ThreadShellProps) {
  const { open, requestClose, completeOpenChange } =
    useDeferredRouteClose(onClosed);

  return (
    <>
      <div
        data-slot="thread-detail-pane-space"
        data-state={open ? "open" : "closed"}
        className="relative w-0 min-w-0 shrink-0 transition-[width] duration-200 ease-[cubic-bezier(0.32,0.72,0,1)] data-[state=open]:w-[clamp(28rem,34vw,34rem)] motion-reduce:transition-none"
        onTransitionEnd={(event) => {
          if (
            event.target === event.currentTarget &&
            event.propertyName === "width" &&
            !open
          ) {
            completeOpenChange(false);
          }
        }}
      />
      <aside
        aria-label={title}
        data-slot="thread-detail-pane"
        data-state={open ? "open" : "closed"}
        className="fixed inset-y-0 right-0 z-30 flex h-dvh w-[clamp(28rem,34vw,34rem)] translate-x-full flex-col border-l bg-popover text-sm text-popover-foreground shadow-xl transition-transform duration-200 ease-[cubic-bezier(0.32,0.72,0,1)] data-[state=open]:translate-x-0 motion-reduce:transition-none"
      >
        <ThreadControls
          threadSlug={threadSlug}
          showActions={showActions}
          onRequestClose={requestClose}
        />
        <div className="flex min-h-0 flex-1 flex-col overflow-hidden px-6 py-8">
          {children}
        </div>
      </aside>
    </>
  );
}

function ThreadControls({
  threadSlug,
  showActions,
  onRequestClose,
}: {
  threadSlug: string;
  showActions: boolean;
  onRequestClose: () => void;
}) {
  return (
    <ButtonGroup
      aria-label="Thread controls"
      className="absolute right-4 top-4 z-20 rounded-4xl bg-secondary"
    >
      {showActions && (
        <>
          <ThreadLifecycleActionsSection
            threadSlug={threadSlug}
            onRequestClose={onRequestClose}
          />
          <ButtonGroupSeparator />
        </>
      )}
      <Button
        variant="ghost"
        size="icon-sm"
        onClick={onRequestClose}
        aria-label="Close thread"
      >
        <X data-icon="inline-start" />
      </Button>
    </ButtonGroup>
  );
}

interface ThreadDetailContentProps {
  areaSlug: string;
  threadSlug: string;
  thread: Doc<"threads">;
}

function ThreadDetailContent({
  areaSlug,
  threadSlug,
  thread,
}: ThreadDetailContentProps) {
  const isResolved = thread.state === "resolved";

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-5">
      <header
        role="banner"
        aria-label="Thread header"
        className="flex shrink-0 flex-col gap-3 pb-1"
      >
        <div className="flex items-center gap-2 pr-24">
          <ThreadAreaSectionSection
            areaSlug={areaSlug}
            threadSlug={threadSlug}
          />
          {isResolved && <Badge variant="secondary">Resolved</Badge>}
        </div>
        <div className="flex flex-col gap-0.5">
          <ThreadHeaderSection areaSlug={areaSlug} threadSlug={threadSlug} />
          <ThreadDefinitionSection threadSlug={threadSlug} />
        </div>
      </header>

      {!isResolved && (
        <section
          role="region"
          aria-label="Thread attention"
          className="flex shrink-0 flex-col gap-5"
        >
          <div className="grid grid-cols-[repeat(auto-fit,minmax(14rem,1fr))] gap-5">
            <NextMoveSection threadSlug={threadSlug} />
            <FollowUpSection threadSlug={threadSlug} />
          </div>
          <Separator />
        </section>
      )}

      <div className="flex min-h-0 flex-1 flex-col">
        <ActivityLogSection threadSlug={threadSlug} />
      </div>
    </div>
  );
}
