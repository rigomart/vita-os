// PROTOTYPE — throwaway thread-line variant experiment, do not ship
import type { ReactNode } from "react";

import {
  createContext,
  createElement,
  useCallback,
  useContext,
  useSyncExternalStore,
} from "react";

export const PROTOTYPE_VARIANTS = ["off", "reply", "graph", "trace"] as const;

export type PrototypeVariant = (typeof PROTOTYPE_VARIANTS)[number];

export const PROTOTYPE_VARIANT_LABELS: Record<PrototypeVariant, string> = {
  off: "Current",
  reply: "Reply thread",
  graph: "Commit graph",
  trace: "Time trace",
};

/**
 * Deliberately outside TanStack Router: the param is read straight off
 * `window.location` and written with `history.replaceState`, so no route file,
 * `validateSearch`, or search-schema anywhere in the app has to learn about it.
 * Throwaway wiring for a throwaway experiment.
 */
const PARAM = "variant";

const listeners = new Set<() => void>();

function emit() {
  for (const listener of listeners) listener();
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  window.addEventListener("popstate", listener);
  return () => {
    listeners.delete(listener);
    window.removeEventListener("popstate", listener);
  };
}

function isVariant(value: string | null): value is PrototypeVariant {
  return (
    value != null && (PROTOTYPE_VARIANTS as readonly string[]).includes(value)
  );
}

function readSnapshot(): PrototypeVariant {
  if (typeof window === "undefined") return "off";
  const value = new URLSearchParams(window.location.search).get(PARAM);
  return isVariant(value) ? value : "off";
}

function serverSnapshot(): PrototypeVariant {
  return "off";
}

export function writeVariant(variant: PrototypeVariant): void {
  const url = new URL(window.location.href);
  if (variant === "off") url.searchParams.delete(PARAM);
  else url.searchParams.set(PARAM, variant);
  window.history.replaceState(window.history.state, "", url);
  emit();
}

/** The URL-backed source of truth. Use the context in deep components. */
export function usePrototypeVariantState(): {
  setVariant: (variant: PrototypeVariant) => void;
  variant: PrototypeVariant;
} {
  const variant = useSyncExternalStore(subscribe, readSnapshot, serverSnapshot);
  const setVariant = useCallback((next: PrototypeVariant) => {
    writeVariant(next);
  }, []);
  return { setVariant, variant };
}

export const PrototypeVariantContext = createContext<PrototypeVariant>("off");

/** Read the active variant from anywhere under the provider. */
export function usePrototypeVariant(): PrototypeVariant {
  return useContext(PrototypeVariantContext);
}

/** `createElement` rather than JSX so the hook module stays a plain `.ts`. */
export function PrototypeVariantProvider({
  children,
}: {
  children: ReactNode;
}) {
  const { variant } = usePrototypeVariantState();
  return createElement(
    PrototypeVariantContext.Provider,
    { value: variant },
    children,
  );
}
