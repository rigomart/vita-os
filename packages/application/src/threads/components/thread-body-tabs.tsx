import type { ThreadId } from "@vita-os/contracts";

import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@vita-os/ui/components/tabs";
import { cn } from "@vita-os/ui/lib/utils";

import { useThreadNotes } from "../../thread-notes/hooks";
import { ActivityLogSection } from "./thread-log-section";
import { ThreadNotesSection } from "./thread-notes-section";

interface ThreadBodyTabsProps {
  threadId: ThreadId;
  threadTitle: string;
  /**
   * Whether the body scrolls itself (the pane) or flows in a scroll that
   * holds the whole Thread (the drawer).
   */
  scrolls: boolean;
}

/**
 * The Thread's body below attention: Notes at rest, the Activity Log a click
 * away. One scroll container wraps both panels rather than each owning its
 * own, so the Thread keeps exactly one scrolling region either way.
 */
export function ThreadBodyTabs({
  threadId,
  threadTitle,
  scrolls,
}: ThreadBodyTabsProps) {
  // The same read ThreadNotesSection observes, so the count costs nothing
  // beyond what the panel already pays.
  const notes = useThreadNotes(threadId).data;

  return (
    <Tabs
      defaultValue="notes"
      className={cn("flex flex-col gap-3", scrolls && "min-h-0 flex-1")}
    >
      <TabsList className="shrink-0 self-start">
        <TabsTrigger value="notes">
          Notes
          {notes && notes.length > 0 && (
            <span className="tabular-nums opacity-60">{notes.length}</span>
          )}
        </TabsTrigger>
        <TabsTrigger value="activity">Activity</TabsTrigger>
      </TabsList>

      <div
        data-slot="thread-continuity-scroll"
        className={cn(
          "pb-2",
          scrolls && "min-h-0 flex-1 overflow-y-auto overscroll-contain",
        )}
      >
        {/* Kept mounted so a half-written Note survives a look at Activity. */}
        <TabsContent value="notes" keepMounted>
          <ThreadNotesSection threadId={threadId} threadTitle={threadTitle} />
        </TabsContent>
        <TabsContent value="activity">
          <ActivityLogSection threadId={threadId} />
        </TabsContent>
      </div>
    </Tabs>
  );
}
