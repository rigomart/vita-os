import { useCallback, useEffect, useRef, useState } from "react";

const EXIT_COMPLETION_FALLBACK_MS = 650;

export function useDeferredOverlayClose(onClosed: () => void) {
  const [open, setOpen] = useState(false);
  const closingRef = useRef(false);
  const completedRef = useRef(false);
  const completionTimerRef = useRef<ReturnType<typeof setTimeout>>(undefined);
  const onClosedRef = useRef(onClosed);
  onClosedRef.current = onClosed;

  const finishClose = useCallback(() => {
    if (!closingRef.current || completedRef.current) return;
    completedRef.current = true;
    clearTimeout(completionTimerRef.current);
    onClosedRef.current();
  }, []);

  useEffect(() => {
    const frame = requestAnimationFrame(() => {
      if (!closingRef.current) setOpen(true);
    });

    return () => {
      cancelAnimationFrame(frame);
      clearTimeout(completionTimerRef.current);
    };
  }, []);

  const requestClose = useCallback(() => {
    if (closingRef.current) return;
    closingRef.current = true;
    setOpen(false);
    completionTimerRef.current = setTimeout(
      finishClose,
      EXIT_COMPLETION_FALLBACK_MS,
    );
  }, [finishClose]);

  const handleOpenChange = useCallback(
    (nextOpen: boolean) => {
      if (!nextOpen) requestClose();
    },
    [requestClose],
  );

  const completeOpenChange = useCallback(
    (nextOpen: boolean) => {
      if (nextOpen) return;
      finishClose();
    },
    [finishClose],
  );

  return { open, requestClose, handleOpenChange, completeOpenChange };
}
