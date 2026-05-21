import type { Id } from "@convex/_generated/dataModel";

import { useCallback, useState } from "react";

export function useSidebarDialogs() {
  const [showCreateThread, setShowCreateThread] = useState(false);
  const [createForAreaId, setCreateForAreaId] = useState<
    Id<"areas"> | undefined
  >();
  const [showNewTask, setShowNewTask] = useState(false);
  const [showCreateArea, setShowCreateArea] = useState(false);

  const openNewTask = useCallback(() => setShowNewTask(true), []);

  const openCreateThread = useCallback((areaId?: Id<"areas">) => {
    setCreateForAreaId(areaId);
    setShowCreateThread(true);
  }, []);

  return {
    showCreateThread,
    setShowCreateThread,
    createForAreaId,
    showNewTask,
    setShowNewTask,
    openNewTask,
    showCreateArea,
    setShowCreateArea,
    openCreateThread,
  };
}
