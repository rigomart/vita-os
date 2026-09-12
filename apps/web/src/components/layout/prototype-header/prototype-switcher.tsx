/**
 * PROTOTYPE — throwaway. The variant switcher.
 *
 * Deliberately ugly and high-contrast so it never gets mistaken for part of the
 * design being judged. Bottom-LEFT rather than bottom-centre, because variant
 * E's dock owns bottom-centre.
 */

import { useNavigate, useSearch } from "@tanstack/react-router";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { useEffect } from "react";

import type { HeaderVariant } from "./header-variants";

import {
  HEADER_VARIANT_NAMES,
  HEADER_VARIANTS,
  isHeaderVariant,
} from "./header-variants";

/** Reads the active variant off the URL; defaults to today's bar. */
export function useHeaderVariant(): HeaderVariant {
  const { headerVariant } = useSearch({ from: "/_authenticated" });
  return isHeaderVariant(headerVariant) ? headerVariant : "A";
}

export function PrototypeSwitcher({ current }: { current: HeaderVariant }) {
  const navigate = useNavigate();

  const step = (delta: number) => {
    const index = HEADER_VARIANTS.indexOf(current);
    const next =
      HEADER_VARIANTS[
        (index + delta + HEADER_VARIANTS.length) % HEADER_VARIANTS.length
      ];
    navigate({
      to: ".",
      search: (prev) => ({ ...prev, headerVariant: next }),
      replace: true,
    });
  };

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== "ArrowLeft" && event.key !== "ArrowRight") return;
      // Never steal the arrows from a field the user is typing in.
      const target = event.target as HTMLElement | null;
      if (
        target?.closest("input, textarea, select, [contenteditable='true']") !==
        null
      ) {
        return;
      }
      if (event.metaKey || event.ctrlKey || event.altKey) return;
      event.preventDefault();
      step(event.key === "ArrowLeft" ? -1 : 1);
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  });

  if (import.meta.env.PROD) return null;

  return (
    <div className="fixed bottom-4 left-4 z-50 flex items-center gap-1 rounded-full bg-fuchsia-600 px-1.5 py-1 font-mono text-xs text-white shadow-xl ring-2 ring-fuchsia-300/60">
      <button
        type="button"
        aria-label="Previous header variant"
        onClick={() => step(-1)}
        className="grid size-6 place-items-center rounded-full hover:bg-white/20"
      >
        <ChevronLeft className="size-4" />
      </button>
      <span className="px-1.5 whitespace-nowrap tabular-nums">
        {current} — {HEADER_VARIANT_NAMES[current]}
      </span>
      <button
        type="button"
        aria-label="Next header variant"
        onClick={() => step(1)}
        className="grid size-6 place-items-center rounded-full hover:bg-white/20"
      >
        <ChevronRight className="size-4" />
      </button>
    </div>
  );
}
