import { useLocation, useRouter } from "@tanstack/react-router";
// PROTOTYPE — throwaway area quick-switcher exploration.
// Four variants of "switch areas from inside an area", switchable via
// `?variant=` on any authenticated route (house pattern: prototype-variants).
// In-app navigation drops unknown search params (validateSearch only keeps
// `thread`), so the active variant also persists in sessionStorage — the URL
// param wins when present.
import { useEffect } from "react";
import { useCallback } from "react";

export const AREA_SWITCHER_VARIANTS = [
  { key: "0", name: "Current — palette only" },
  { key: "A", name: "Top-bar area strip" },
  { key: "B", name: "Left icon rail" },
  { key: "C", name: "Area title switcher" },
] as const;

export type AreaSwitcherVariantKey =
  (typeof AREA_SWITCHER_VARIANTS)[number]["key"];

const SEARCH_PARAM = "variant";
const STORAGE_KEY = "vita-os:area-switcher-prototype-variant";

function isVariantKey(value: string | null): value is AreaSwitcherVariantKey {
  return AREA_SWITCHER_VARIANTS.some(({ key }) => key === value);
}

function readStoredVariant(): AreaSwitcherVariantKey | null {
  try {
    const stored = window.sessionStorage.getItem(STORAGE_KEY);
    return isVariantKey(stored) ? stored : null;
  } catch {
    return null;
  }
}

export function useAreaSwitcherVariant() {
  const router = useRouter();
  const location = useLocation();
  const requestedKey = new URLSearchParams(location.searchStr).get(
    SEARCH_PARAM,
  );
  const variant: AreaSwitcherVariantKey = isVariantKey(requestedKey)
    ? requestedKey
    : (readStoredVariant() ?? "0");

  useEffect(() => {
    try {
      window.sessionStorage.setItem(STORAGE_KEY, variant);
    } catch {
      // The prototype stays usable without persistence.
    }
  }, [variant]);

  const setVariant = useCallback(
    (key: string) => {
      const search = new URLSearchParams(location.searchStr);
      search.set(SEARCH_PARAM, key);
      const searchString = search.toString();
      const href = `${location.pathname}${searchString ? `?${searchString}` : ""}${location.hash}`;

      void router.navigate({ href, replace: true, resetScroll: false });
    },
    [location.hash, location.pathname, location.searchStr, router],
  );

  return { variant, setVariant };
}
