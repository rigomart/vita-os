/**
 * PROTOTYPE — throwaway. See ./inbox-prototype-variants.tsx.
 *
 * The variant would live in `?variant=` per the prototype skill, but the
 * authenticated route's `validateSearch` strips unknown params, and the Inbox's
 * own open/close navigates through it — so a URL param would be wiped every
 * time the panel opens. localStorage keeps it reload-stable instead.
 */
import { useEffect, useState } from "react";

export const PROTOTYPE_VARIANTS = [
  { key: "current", name: "Current (task list)" },
  { key: "D1", name: "Header strip — controls above the body" },
  { key: "D2", name: "Gutter — ring inside the card" },
  { key: "D3", name: "Action footer — Complete pill" },
] as const;

export type PrototypeVariantKey = (typeof PROTOTYPE_VARIANTS)[number]["key"];

const STORAGE_KEY = "PROTOTYPE_inbox_variant";

function readInitial(): PrototypeVariantKey {
  const fromUrl = new URLSearchParams(window.location.search).get("variant");
  const stored = window.localStorage.getItem(STORAGE_KEY);
  const candidate = fromUrl ?? stored;
  return (
    PROTOTYPE_VARIANTS.find((variant) => variant.key === candidate)?.key ??
    "current"
  );
}

export function usePrototypeVariant() {
  const [variant, setVariant] = useState<PrototypeVariantKey>(readInitial);

  useEffect(() => {
    window.localStorage.setItem(STORAGE_KEY, variant);
  }, [variant]);

  const cycle = (step: number) => {
    const index = PROTOTYPE_VARIANTS.findIndex((each) => each.key === variant);
    const next =
      (index + step + PROTOTYPE_VARIANTS.length) % PROTOTYPE_VARIANTS.length;
    setVariant(PROTOTYPE_VARIANTS[next].key);
  };

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== "ArrowLeft" && event.key !== "ArrowRight") return;
      const target = event.target as HTMLElement | null;
      if (target?.closest("input, textarea, [contenteditable=true]")) return;
      cycle(event.key === "ArrowRight" ? 1 : -1);
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  });

  return { variant, cycle };
}
