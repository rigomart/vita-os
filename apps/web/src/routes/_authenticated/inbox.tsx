import { api } from "@convex/_generated/api";
import type { Doc, Id } from "@convex/_generated/dataModel";
import { createFileRoute } from "@tanstack/react-router";
import { useMutation } from "convex/react";
import { useQuery } from "convex-helpers/react/cache/hooks";
import { Inbox } from "lucide-react";
import { useState } from "react";
import { RouteErrorFallback } from "@/components/error-boundary";
import { ItemRow } from "@/components/items/item-row";
import { ProcessItemDialog } from "@/components/items/process-item-dialog";
import { PageHeader } from "@/components/layout/page-header";
import { Skeleton } from "@/components/ui/skeleton";

export const Route = createFileRoute("/_authenticated/inbox")({
  head: () => ({
    meta: [{ title: "Inbox | Vita OS" }],
  }),
  errorComponent: RouteErrorFallback,
  component: InboxPage,
});

function InboxPage() {
  const items = useQuery(api.items.list);
  const areas = useQuery(api.areas.list);
  const projects = useQuery(api.projects.list);
  const processItem = useMutation(api.items.process);

  const [processingItem, setProcessingItem] = useState<
    Doc<"items"> | undefined
  >(undefined);

  const handleProcess = async (
    itemId: Id<"items">,
    action:
      | { type: "add_date"; date: number }
      | {
          type: "create_project";
          name: string;
          areaId: Id<"areas">;
          definitionOfDone?: string;
        }
      | { type: "add_to_project"; projectId: Id<"projects"> }
      | { type: "set_next_action"; projectId: Id<"projects"> },
  ) => {
    await processItem({ id: itemId, action });
    setProcessingItem(undefined);
  };

  if (items === undefined) {
    return <InboxSkeleton />;
  }

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
        <div className="divide-y divide-border/50 rounded-xl border border-border-subtle bg-surface-2">
          {items.map((item) => (
            <ItemRow key={item._id} item={item} onProcess={setProcessingItem} />
          ))}
        </div>
      )}

      {processingItem && (
        <ProcessItemDialog
          open={!!processingItem}
          onOpenChange={(open) => {
            if (!open) setProcessingItem(undefined);
          }}
          item={processingItem}
          areas={areas ?? []}
          projects={projects ?? []}
          onProcess={handleProcess}
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
