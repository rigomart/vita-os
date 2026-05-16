import { api } from "@convex/_generated/api";
import type { Id } from "@convex/_generated/dataModel";
import { useMutation } from "convex/react";

export type ProcessItemAction =
  | {
      type: "create_project";
      name: string;
      areaId: Id<"areas">;
      definitionOfDone?: string;
    }
  | { type: "add_to_project"; projectId: Id<"projects"> }
  | { type: "set_next_action"; projectId: Id<"projects"> };

export function useProcessItem() {
  const processItem = useMutation(api.items.process);

  return (id: Id<"items">, action: ProcessItemAction) =>
    processItem({ id, action });
}
