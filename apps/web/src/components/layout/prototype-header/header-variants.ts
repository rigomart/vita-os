/**
 * PROTOTYPE — throwaway. Delete with the rest of `prototype-header/`.
 *
 * Question: should the app chrome stay an anchored bar, or float?
 * Five variants of the top bar, switchable via `?headerVariant=` on any
 * authenticated route. A is what ships today and is the control; F is the
 * refined direction — E's frame with C's identity capsule.
 */

export const HEADER_VARIANTS = ["A", "B", "C", "E", "F"] as const;

export type HeaderVariant = (typeof HEADER_VARIANTS)[number];

export const HEADER_VARIANT_NAMES: Record<HeaderVariant, string> = {
  A: "Anchored bar (today)",
  B: "Floating island",
  C: "Split clusters",
  E: "Perimeter dock",
  F: "Refined dock (E + C)",
};

/**
 * Each variant reserves a different amount of the viewport, so `<main>` has to
 * be padded to match: B and C float over the top, E and F over top and bottom.
 */
export const HEADER_VARIANT_MAIN_CLASS: Record<HeaderVariant, string> = {
  A: "pt-3 pb-24 md:pb-8",
  B: "pt-3 pb-24 md:pb-8",
  C: "pt-3 pb-24 md:pb-8",
  E: "pt-20 pb-24 md:pb-28",
  F: "pt-20 pb-24 md:pb-28",
};

export function isHeaderVariant(value: unknown): value is HeaderVariant {
  return HEADER_VARIANTS.includes(value as HeaderVariant);
}
