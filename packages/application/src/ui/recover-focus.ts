import { useEffect, useLayoutEffect, useRef } from "react";

type Recovery = {
  source: Element;
  target: () => HTMLElement | null | undefined;
  stop: () => void;
};

export function useFocusRecovery() {
  const pending = useRef<Recovery | null>(null);
  useEffect(() => () => pending.current?.stop(), []);
  useLayoutEffect(() => {
    const recovery = pending.current;
    if (!recovery || recovery.source.isConnected) return;
    recovery.stop();
    const active = document.activeElement;
    const next = recovery.target();
    if (
      (!active || active === document.body || !active.isConnected) &&
      next?.isConnected
    ) {
      next.focus();
    }
  });

  return async <T>(
    target: Recovery["target"],
    action: () => T,
    source: Element | null = document.activeElement,
  ): Promise<Awaited<T>> => {
    pending.current?.stop();
    if (!source || source === document.body) return await action();
    const stop = () => {
      document.removeEventListener("focusin", moved);
      if (pending.current?.stop === stop) pending.current = null;
    };
    const moved = () => {
      if (document.activeElement !== source) stop();
    };
    pending.current = { source, target, stop };
    document.addEventListener("focusin", moved);
    try {
      return await action();
    } finally {
      requestAnimationFrame(stop);
    }
  };
}
