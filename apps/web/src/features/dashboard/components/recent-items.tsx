import { api } from "@convex/_generated/api";
import type { Doc } from "@convex/_generated/dataModel";
import { useQuery } from "convex-helpers/react/cache/hooks";
import { useState } from "react";
import { ProcessItemDialogContainer } from "@/features/items/process-item/process-item-dialog-container";
import { RecentItemsList } from "./recent-items-list";

const MAX_VISIBLE = 5;

export function RecentItems() {
  const items = useQuery(api.items.list);
  const areas = useQuery(api.areas.list);
  const projects = useQuery(api.projects.list);

  const [processingItem, setProcessingItem] = useState<
    Doc<"items"> | undefined
  >(undefined);

  const visible = (items ?? []).slice(0, MAX_VISIBLE);
  const hasMore = (items?.length ?? 0) > MAX_VISIBLE;

  return (
    <>
      <RecentItemsList
        items={visible}
        hasMore={hasMore}
        totalCount={items?.length ?? 0}
        onProcess={setProcessingItem}
      />

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
    </>
  );
}
