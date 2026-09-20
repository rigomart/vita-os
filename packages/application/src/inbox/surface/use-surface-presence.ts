import { useCallback, useEffect, useRef, useState } from "react";

/** Long enough for the 150ms exit; short enough not to hang a stuck surface. */
const EXIT_FALLBACK_MS = 250;

/**
 * Keeps a surface mounted through its exit animation. The route param is the
 * only truth about whether the Inbox is open — closing strips it at once — so
 * the surface outlives it just long enough to animate away, and a summon that
 * lands mid-exit simply turns it back around.
 */
export function useSurfacePresence(isOpen: boolean) {
  const [mounted, setMounted] = useState(isOpen);
  // Painted closed for a frame first, so the enter transition has somewhere to
  // come from.
  const [open, setOpen] = useState(false);
  const exitTimerRef = useRef<ReturnType<typeof setTimeout>>(undefined);

  useEffect(() => {
    clearTimeout(exitTimerRef.current);

    if (isOpen) {
      setMounted(true);
      const frame = requestAnimationFrame(() => setOpen(true));
      return () => cancelAnimationFrame(frame);
    }

    setOpen(false);
    exitTimerRef.current = setTimeout(
      () => setMounted(false),
      EXIT_FALLBACK_MS,
    );
    return () => clearTimeout(exitTimerRef.current);
  }, [isOpen]);

  const handleExited = useCallback(() => {
    clearTimeout(exitTimerRef.current);
    setMounted(false);
  }, []);

  return { mounted: mounted || isOpen, open: open && isOpen, handleExited };
}
