import { api } from "@convex/_generated/api";
import type { Doc, Id } from "@convex/_generated/dataModel";
import { Link } from "@tanstack/react-router";
import { useMutation } from "convex/react";
import { useQuery } from "convex-helpers/react/cache/hooks";
import { ArrowRight, Inbox } from "lucide-react";
import { useState } from "react";
import { ItemRow } from "@/components/items/item-row";
import { ProcessItemDialog } from "@/components/items/process-item-dialog";

const MAX_VISIBLE = 5;

export function RecentItems() {
  const items = useQuery(api.items.list);
  const areas = useQuery(api.areas.list);
  const projects = useQuery(api.projects.list);
  const processItem = useMutation(api.items.process);

  const [processingItem, setProcessingItem] = useState<
    Doc<"items"> | undefined
  >(undefined);

  if (!items || items.length === 0) return null;

  const visible = items.slice(0, MAX_VISIBLE);
  const hasMore = items.length > MAX_VISIBLE;

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

  return (
    <section>
      <div className="mb-4 flex items-center gap-2.5">
        <div className="flex h-6 w-6 items-center justify-center rounded-md bg-surface-3">
          <Inbox className="h-3.5 w-3.5 text-muted-foreground" />
        </div>
        <h2 className="text-sm font-medium">Recent Items</h2>
        <span className="text-xs text-muted-foreground">{items.length}</span>
      </div>
      <div className="divide-y divide-border/50 rounded-xl border border-border-subtle bg-surface-2">
        {visible.map((item) => (
          <ItemRow key={item._id} item={item} onProcess={setProcessingItem} />
        ))}
      </div>
      {hasMore && (
        <div className="mt-3 flex justify-end">
          <Link
            to="/inbox"
            className="inline-flex items-center gap-1.5 text-xs text-muted-foreground transition-colors hover:text-foreground"
          >
            View all items
            <ArrowRight className="h-3 w-3" />
          </Link>
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
    </section>
  );
}
