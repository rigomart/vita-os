import type { ProjectedArea } from "@convex/lib/validators";

import { useNavigate } from "@tanstack/react-router";
import { useEffect } from "react";

/**
 * Bare `1..9` jumps to the Nth Area in the user's own order (ADR 0011).
 * Modifier chords are left alone — ⌘/Ctrl+digit is the browser's own tab
 * switcher. Matching on `e.code` keeps the digit row working on layouts
 * where digits are typed shifted.
 */
export function useAreaJumpShortcuts(
  areas: readonly ProjectedArea[] | undefined,
) {
  const navigate = useNavigate();

  useEffect(() => {
    if (areas === undefined) return;
    function handleKeyDown(e: KeyboardEvent) {
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      if (!e.code.startsWith("Digit")) return;
      const digit = Number(e.code.slice("Digit".length));
      if (digit < 1) return;
      const target = e.target as HTMLElement;
      if (
        target.tagName === "INPUT" ||
        target.tagName === "TEXTAREA" ||
        target.tagName === "SELECT" ||
        target.isContentEditable
      ) {
        return;
      }
      const area = areas?.[digit - 1];
      if (area === undefined) return;
      e.preventDefault();
      void navigate({ to: "/$areaSlug", params: { areaSlug: area.slug } });
    }
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [areas, navigate]);
}
