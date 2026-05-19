import { api } from "@convex/_generated/api";
import type { Doc } from "@convex/_generated/dataModel";
import { Link } from "@tanstack/react-router";
import { Button } from "@vita-os/ui/components/button";
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

interface ProcessingNotification {
  action: "create_project" | "add_to_project" | "set_next_action";
  project: Pick<Doc<"projects">, "name" | "slug">;
  area: Doc<"areas"> | undefined;
}

export function InboxScreen() {
  const items = useQuery(api.items.list);
  const [processingItem, setProcessingItem] = useState<
    Doc<"items"> | undefined
  >(undefined);
  const [notification, setNotification] = useState<
    ProcessingNotification | undefined
  >(undefined);

  if (items === undefined) {
    return <InboxSkeleton />;
  }

  const openTasks = items.filter((task) => !task.isCompleted);
  const doneTasks = items.filter((task) => task.isCompleted);

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
          {openTasks.length > 0 && (
            <div className="divide-y divide-border/50 rounded-xl border border-border-subtle bg-surface-2">
              {openTasks.map((task) => (
                <ItemRowContainer
                  key={task._id}
                  item={task}
                  onProcess={setProcessingItem}
                />
              ))}
            </div>
          )}

          {doneTasks.length > 0 && (
            <Collapsible>
              <div className="rounded-xl border border-border-subtle bg-surface-2">
                <CollapsibleTrigger className="group flex w-full items-center gap-2 px-3 py-2 text-left text-sm font-medium text-muted-foreground hover:text-foreground">
                  <ChevronRight className="h-4 w-4 transition-transform group-data-[state=open]:rotate-90" />
                  <span>Done</span>
                  <span className="ml-auto text-xs tabular-nums">
                    {doneTasks.length}
                  </span>
                </CollapsibleTrigger>
                <CollapsibleContent>
                  <div className="divide-y divide-border/50 border-t border-border/50">
                    {doneTasks.map((task) => (
                      <ItemRowContainer key={task._id} item={task} />
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
          onProcessed={setNotification}
        />
      )}

      {notification && (
        <ProcessingToast
          notification={notification}
          onDismiss={() => setNotification(undefined)}
        />
      )}
    </div>
  );
}

function ProcessingToast({
  notification,
  onDismiss,
}: {
  notification: ProcessingNotification;
  onDismiss: () => void;
}) {
  const message =
    notification.action === "create_project"
      ? "Created thread"
      : notification.action === "set_next_action"
        ? "Set as next action"
        : "Added as note";

  return (
    <output className="fixed right-4 bottom-4 z-50 flex max-w-sm items-center gap-3 rounded-lg border border-border-subtle bg-popover px-4 py-3 text-sm text-popover-foreground shadow-lg">
      <span className="min-w-0">
        {message} in{" "}
        {notification.area && notification.project.slug ? (
          <Link
            to="/$areaSlug/$projectSlug"
            params={{
              areaSlug: notification.area.slug ?? notification.area._id,
              projectSlug: notification.project.slug,
            }}
            className="font-medium text-primary underline-offset-4 hover:underline"
          >
            {notification.project.name}
          </Link>
        ) : (
          <span className="font-medium">{notification.project.name}</span>
        )}
      </span>
      <Button type="button" variant="ghost" size="xs" onClick={onDismiss}>
        Dismiss
      </Button>
    </output>
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
