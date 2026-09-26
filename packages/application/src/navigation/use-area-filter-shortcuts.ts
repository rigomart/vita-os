import type { AreaSummary } from "@vita-os/contracts";

import { useNavigate } from "@tanstack/react-router";
import { useEffect } from "react";

import type { ProductSearch } from "./search-params";

/**
 * Bare `1..9` filters the Dashboard to the Nth Area in the user's own order,
 * and `0` returns it to All. Modifier chords are left alone — ⌘/Ctrl+digit is
 * the browser's own tab switcher. Matching on `e.code` keeps the digit row
 * working on layouts where digits are typed shifted.
 */
export function useAreaFilterShortcuts(
  areas: readonly AreaSummary[] | undefined,
) {
  const navigate = useNavigate();

  useEffect(() => {
    if (areas === undefined) return;
    function handleKeyDown(e: KeyboardEvent) {
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      if (!e.code.startsWith("Digit")) return;
      const target = e.target as HTMLElement;
      if (
        target.tagName === "INPUT" ||
        target.tagName === "TEXTAREA" ||
        target.tagName === "SELECT" ||
        target.isContentEditable
      ) {
        return;
      }
      const digit = Number(e.code.slice("Digit".length));
      const area = digit === 0 ? undefined : areas?.[digit - 1];
      if (digit !== 0 && area === undefined) return;
      e.preventDefault();
      void navigate({
        to: "/",
        search: (previous: ProductSearch): ProductSearch => ({
          ...previous,
          area: area?.slug,
        }),
      });
    }
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [areas, navigate]);
}
