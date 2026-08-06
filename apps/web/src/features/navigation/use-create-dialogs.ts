import type { Id } from "@convex/_generated/dataModel";

import { useCallback, useState } from "react";

export function useCreateDialogs() {
  const [showCreateThread, setShowCreateThread] = useState(false);
  const [createForAreaId, setCreateForAreaId] = useState<
    Id<"areas"> | undefined
  >();
  const [showNewTask, setShowNewTask] = useState(false);
  const [showCreateArea, setShowCreateArea] = useState(false);

  const openNewTask = useCallback(() => setShowNewTask(true), []);

  const openCreateArea = useCallback(() => setShowCreateArea(true), []);

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
    openCreateArea,
    openCreateThread,
  };
}
