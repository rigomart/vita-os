import type { ThreadId } from "@vita-os/contracts";

import { useThreadNotes } from "@vita-os/application";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@vita-os/ui/components/tabs";

import { ActivityLogSection } from "./thread-log-section";
import { ThreadNotesSection } from "./thread-notes-section";

interface ThreadBodyTabsProps {
  threadId: ThreadId;
  lastActivityAt?: number;
}

/**
 * The pane's body below attention: Notes at rest, the Activity Log a click
 * away. One scroll container wraps both panels rather than each owning its
 * own, so the pane keeps exactly one scrolling region either way.
 */
export function ThreadBodyTabs({
  threadId,
  lastActivityAt,
}: ThreadBodyTabsProps) {
  // The same read ThreadNotesSection observes, so the count costs nothing
  // beyond what the panel already pays.
  const notes = useThreadNotes(threadId).data;

  return (
    <Tabs defaultValue="notes" className="flex min-h-0 flex-1 flex-col gap-3">
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
        className="min-h-0 flex-1 overflow-y-auto overscroll-contain pb-2"
      >
        {/* Kept mounted so a half-written Note survives a look at Activity. */}
        <TabsContent value="notes" keepMounted>
          <ThreadNotesSection threadId={threadId} />
        </TabsContent>
        <TabsContent value="activity">
          <ActivityLogSection
            threadId={threadId}
            lastActivityAt={lastActivityAt}
          />
        </TabsContent>
      </div>
    </Tabs>
  );
}
