import { findVariant, type Prototype } from "./prototype";

/** What a prototype page reads from its address. */
export interface PrototypeSearch {
  variant?: string;
}

export function readPrototypeSearch(
  search: Record<string, unknown>,
): PrototypeSearch {
  return typeof search.variant === "string" ? { variant: search.variant } : {};
}

/**
 * One prototype, showing one of its variants; the lab toolbar steps through
 * the others. Stepping keeps the scenario's data, so every direction is seen
 * against the same situation, including whatever was changed in the last one.
 */
export function PrototypeStage({
  prototype,
  search,
}: {
  prototype: Prototype;
  search: PrototypeSearch;
}) {
  const variant = findVariant(prototype, search.variant);
  const Component = variant.component;
  return <Component key={variant.key} />;
}
