import type { Id } from "@convex/_generated/dataModel";
import { useCallback, useState } from "react";

export function useSidebarDialogs() {
  const [showCreateProject, setShowCreateProject] = useState(false);
  const [createForAreaId, setCreateForAreaId] = useState<
    Id<"areas"> | undefined
  >();
  const [showNewItem, setShowNewItem] = useState(false);
  const [showCreateArea, setShowCreateArea] = useState(false);

  const openNewItem = useCallback(() => setShowNewItem(true), []);

  const openCreateProject = useCallback((areaId?: Id<"areas">) => {
    setCreateForAreaId(areaId);
    setShowCreateProject(true);
  }, []);

  return {
    showCreateProject,
    setShowCreateProject,
    createForAreaId,
    showNewItem,
    setShowNewItem,
    openNewItem,
    showCreateArea,
    setShowCreateArea,
    openCreateProject,
  };
}
