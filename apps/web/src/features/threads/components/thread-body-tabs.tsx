import type { Id } from "@convex/_generated/dataModel";

import { api } from "@convex/_generated/api";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@vita-os/ui/components/tabs";
import { useQuery } from "convex-helpers/react/cache/hooks";

import { ActivityLogSection } from "./thread-log-section";
import { ThreadNotesSection } from "./thread-notes-section";

interface ThreadBodyTabsProps {
  threadId: Id<"threads">;
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
  // The cached query hook shares one subscription with ThreadNotesSection, so
  // reading the count here costs nothing beyond what the panel already pays.
  const notes = useQuery(api.threadNotes.list, { threadId });

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
