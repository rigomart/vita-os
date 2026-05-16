import { api } from "@convex/_generated/api";
import type { Doc } from "@convex/_generated/dataModel";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@vita-os/ui/components/collapsible";
import { Skeleton } from "@vita-os/ui/components/skeleton";
import { useQuery } from "convex-helpers/react/cache/hooks";
import { ChevronRight, Inbox } from "lucide-react";
import { useState } from "react";
import { PageHeader } from "@/components/layout/page-header";
import { ItemRowContainer } from "@/features/items/item-row/item-row-container";
import { ProcessItemDialogContainer } from "@/features/items/process-item/process-item-dialog-container";

export function InboxScreen() {
  const items = useQuery(api.items.list);
  const areas = useQuery(api.areas.list);
  const projects = useQuery(api.projects.list);
  const [processingItem, setProcessingItem] = useState<
    Doc<"items"> | undefined
  >(undefined);

  if (items === undefined) {
    return <InboxSkeleton />;
  }

  const activeItems = items.filter((item) => !item.isCompleted);
  const completedItems = items.filter((item) => item.isCompleted);

  return (
    <div className="mx-auto max-w-3xl">
      <PageHeader title="Inbox" />
      {items.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 text-center">
          <Inbox className="mb-3 h-8 w-8 text-muted-foreground" />
          <p className="text-sm text-muted-foreground">
            Inbox zero — nothing to process
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {activeItems.length > 0 && (
            <div className="divide-y divide-border/50 rounded-xl border border-border-subtle bg-surface-2">
              {activeItems.map((item) => (
                <ItemRowContainer
                  key={item._id}
                  item={item}
                  onProcess={setProcessingItem}
                />
              ))}
            </div>
          )}

          {completedItems.length > 0 && (
            <Collapsible>
              <div className="rounded-xl border border-border-subtle bg-surface-2">
                <CollapsibleTrigger className="group flex w-full items-center gap-2 px-3 py-2 text-left text-sm font-medium text-muted-foreground hover:text-foreground">
                  <ChevronRight className="h-4 w-4 transition-transform group-data-[state=open]:rotate-90" />
                  <span>Completed</span>
                  <span className="ml-auto text-xs tabular-nums">
                    {completedItems.length}
                  </span>
                </CollapsibleTrigger>
                <CollapsibleContent>
                  <div className="divide-y divide-border/50 border-t border-border/50">
                    {completedItems.map((item) => (
                      <ItemRowContainer key={item._id} item={item} />
                    ))}
                  </div>
                </CollapsibleContent>
              </div>
            </Collapsible>
          )}
        </div>
      )}

      {processingItem && (
        <ProcessItemDialogContainer
          open={!!processingItem}
          onOpenChange={(open) => {
            if (!open) setProcessingItem(undefined);
          }}
          item={processingItem}
          areas={areas ?? []}
          projects={projects ?? []}
        />
      )}
    </div>
  );
}

function InboxSkeleton() {
  return (
    <div className="mx-auto max-w-3xl">
      <div className="mb-6">
        <Skeleton className="h-8 w-20" />
      </div>
      <div className="space-y-1">
        {Array.from({ length: 4 }).map((_, i) => (
          <div
            // biome-ignore lint/suspicious/noArrayIndexKey: skeleton items have no stable id
            key={i}
            className="border-b py-3 last:border-b-0"
          >
            <Skeleton className="h-4 w-3/4" />
            <Skeleton className="mt-1.5 h-3 w-20" />
          </div>
        ))}
      </div>
    </div>
  );
}
