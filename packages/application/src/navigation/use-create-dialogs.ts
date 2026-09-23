import type { AreaId } from "@vita-os/contracts";

import { useCallback, useState } from "react";

export function useCreateDialogs() {
  const [showCreateThread, setShowCreateThread] = useState(false);
  const [createForAreaId, setCreateForAreaId] = useState<AreaId | undefined>();
  const [showNewNote, setShowNewNote] = useState(false);
  const [showCreateArea, setShowCreateArea] = useState(false);

  const openNewNote = useCallback(() => setShowNewNote(true), []);

  const openCreateArea = useCallback(() => setShowCreateArea(true), []);

  const openCreateThread = useCallback((areaId?: AreaId) => {
    setCreateForAreaId(areaId);
    setShowCreateThread(true);
  }, []);

  return {
    showCreateThread,
    setShowCreateThread,
    createForAreaId,
    showNewNote,
    setShowNewNote,
    openNewNote,
    showCreateArea,
    setShowCreateArea,
    openCreateArea,
    openCreateThread,
  };
}
