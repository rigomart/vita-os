import type { ProjectedArea, ProjectedThread } from "@convex/lib/validators";

import { api } from "@convex/_generated/api";
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
import { useQuery } from "convex-helpers/react/cache/hooks";
import { X } from "lucide-react";
import { useMemo } from "react";

import { AreaConditionDot } from "@/features/areas/components/area-condition-dot";
import { ThreadAreaSectionSection } from "@/features/threads/components/thread-area-section-section";
import { ThreadAttentionBarSection } from "@/features/threads/components/thread-attention-bar-section";
import { ThreadDefinitionSection } from "@/features/threads/components/thread-definition-section";
import { ThreadDetailSkeleton } from "@/features/threads/components/thread-detail-skeleton";
import { ThreadHeaderSection } from "@/features/threads/components/thread-header-section";
import { ThreadLifecycleActionsSection } from "@/features/threads/components/thread-lifecycle-actions-section";
import { ActivityLogSection } from "@/features/threads/components/thread-log-section";
import { ThreadResolvedNote } from "@/features/threads/components/thread-resolved-note";
import { ThreadStateChip } from "@/features/threads/components/thread-state-chip";
import { useDocumentTitle } from "@/hooks/use-document-title";
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
  // One subscription serves both URL forms: `?thread=` reads the Area straight
  // off the composite, the canonical deep link validates against it.
  const detail = useQuery(api.threads.detailBySlug, { slug: threadSlug });

  useDocumentTitle(detail?.thread.title ?? "Thread");

  const paneNav = useMemo(
    () => ({ onThreadLocationChange }),
    [onThreadLocationChange],
  );

  const title = detail?.thread.title ?? "Thread detail";
  const isLoading = detail === undefined;
  const area = detail?.area ?? null;
  const hasMatchingThread =
    detail != null &&
    area !== null &&
    (areaSlug === undefined || area.slug === areaSlug);
  const content = isLoading ? (
    <ThreadDetailSkeleton />
  ) : !hasMatchingThread ? (
    <ThreadNotFound areaSlug={areaSlug} onClose={onClose} />
  ) : (
    <ThreadPaneNavContext.Provider value={paneNav}>
      <ThreadDetailContent thread={detail.thread} area={area} />
    </ThreadPaneNavContext.Provider>
  );

  if (!showDesktopPane) {
    return (
      <ThreadDetailDrawer
        key={threadSlug}
        title={title}
        thread={hasMatchingThread ? detail.thread : null}
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
      thread={hasMatchingThread ? detail.thread : null}
      showActions={hasMatchingThread}
      onClosed={onClose}
    >
      {content}
    </ThreadDetailPane>
  );
}

interface ThreadShellProps {
  title: string;
  thread: ProjectedThread | null;
  showActions: boolean;
  onClosed: () => void;
  children: React.ReactNode;
}

function ThreadDetailDrawer({
  title,
  thread,
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
          thread={thread}
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
  thread,
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
          thread={thread}
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
  thread,
  showActions,
  onRequestClose,
}: {
  thread: ProjectedThread | null;
  showActions: boolean;
  onRequestClose: () => void;
}) {
  return (
    <ButtonGroup
      aria-label="Thread controls"
      className="absolute right-4 top-4 z-20 rounded-4xl bg-secondary"
    >
      {showActions && thread && (
        <>
          <ThreadLifecycleActionsSection
            thread={thread}
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
  thread: ProjectedThread;
  area: ProjectedArea;
}

/**
 * A journal you write into. Identity and attention are stated in full at the
 * top — nothing about the Thread costs a click to read — and the Activity Log
 * takes the whole body beneath them, scrolling under a pinned composer.
 */
function ThreadDetailContent({ thread, area }: ThreadDetailContentProps) {
  const isResolved = thread.state === "resolved";
  const areaSlug = area.slug;

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-4">
      <header
        role="banner"
        aria-label="Thread header"
        className="flex shrink-0 flex-col gap-3"
      >
        {/* `pr-24` clears the pane's absolutely-placed control cluster. */}
        <div className="flex items-center gap-2 pr-24">
          <AreaConditionDot condition={area.condition} />
          <ThreadAreaSectionSection thread={thread} area={area} />
          <ThreadStateChip state={thread.state} />
        </div>
        <div className="flex flex-col gap-0.5">
          <ThreadHeaderSection thread={thread} areaSlug={areaSlug} />
          <ThreadDefinitionSection thread={thread} />
        </div>
      </header>

      {isResolved ? (
        <ThreadResolvedNote />
      ) : (
        <ThreadAttentionBarSection thread={thread} />
      )}

      <ActivityLogSection
        threadId={thread._id}
        lastActivityAt={thread.lastActivityAt}
      />
    </div>
  );
}
