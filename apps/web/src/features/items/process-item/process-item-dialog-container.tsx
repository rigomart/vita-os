import { api } from "@convex/_generated/api";
import type { Doc } from "@convex/_generated/dataModel";
import { useQuery } from "convex-helpers/react/cache/hooks";
import type { ProcessItemAction } from "@/features/items/use-process-item";
import { useProcessItem } from "@/features/items/use-process-item";
import { ProcessItemDialog } from "./process-item-dialog";

interface ProcessItemDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  item: Doc<"items">;
  onProcessed?: (result: {
    action: Extract<
      ProcessItemAction,
      { type: "create_project" | "add_activity_log_entry" | "set_next_move" }
    >["type"];
    project: Pick<Doc<"projects">, "name" | "slug">;
    area: Doc<"areas"> | undefined;
  }) => void;
}

export function ProcessItemDialogContainer({
  open,
  onOpenChange,
  item,
  onProcessed,
}: ProcessItemDialogProps) {
  const processItem = useProcessItem();
  const areas = useQuery(api.areas.list, open ? {} : "skip");
  const projects = useQuery(api.projects.list, open ? {} : "skip");
  const visibleAreas = areas ?? [];
  const visibleProjects = projects ?? [];
  const isLoading = open && (areas === undefined || projects === undefined);

  return (
    <ProcessItemDialog
      open={open}
      onOpenChange={onOpenChange}
      item={item}
      areas={visibleAreas}
      projects={visibleProjects}
      isLoading={isLoading}
      onProcess={async (itemId, action) => {
        const result = await processItem(itemId, action);
        if (action.type === "create_project" && result.type === "created") {
          onProcessed?.({
            action: action.type,
            project: { name: action.name, slug: result.slug },
            area: visibleAreas.find((area) => area._id === action.areaId),
          });
        }
        if (
          action.type === "add_activity_log_entry" ||
          action.type === "set_next_move"
        ) {
          const project = visibleProjects.find(
            (candidate) => candidate._id === action.projectId,
          );
          if (project) {
            onProcessed?.({
              action: action.type,
              project,
              area: visibleAreas.find((area) => area._id === project.areaId),
            });
          }
        }
        onOpenChange(false);
      }}
    />
  );
}
