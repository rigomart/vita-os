import { useCallback, useRef, useState } from "react";

export function useDeferredOverlayClose(onClosed: () => void) {
  const [open, setOpen] = useState(true);
  const closingRef = useRef(false);
  const completedRef = useRef(false);
  const onClosedRef = useRef(onClosed);
  onClosedRef.current = onClosed;

  const requestClose = useCallback(() => {
    if (closingRef.current) return;
    closingRef.current = true;
    setOpen(false);
  }, []);

  const handleOpenChange = useCallback(
    (nextOpen: boolean) => {
      if (!nextOpen) requestClose();
    },
    [requestClose],
  );

  const completeOpenChange = useCallback((nextOpen: boolean) => {
    if (nextOpen || !closingRef.current || completedRef.current) return;
    completedRef.current = true;
    onClosedRef.current();
  }, []);

  return { open, requestClose, handleOpenChange, completeOpenChange };
}
