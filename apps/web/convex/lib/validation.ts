import { slugify } from "./slugs";

export const RESERVED_AREA_SLUGS = new Set([
  "threads",
  "settings",
  "sign-in",
  "sign-up",
]);

/**
 * Trim non-blank text, or throw "<label> cannot be empty". Names, titles,
 * bodies, and moves all pass through here so blanks are refused identically.
 */
export function requireNonBlankText(value: string, label: string): string {
  const trimmed = value.trim();
  if (!trimmed) {
    throw new Error(`${label} cannot be empty`);
  }
  return trimmed;
}

/**
 * The Area name to store. Returning the trimmed name rather than validating
 * in place keeps the reserved-slug check honest — a caller cannot check one
 * string and store a differently-trimmed one.
 */
export function validateAreaName(name: string): string {
  const trimmed = requireNonBlankText(name, "Area name");
  const base = slugify(trimmed);
  if (RESERVED_AREA_SLUGS.has(base)) {
    throw new Error(
      `"${trimmed}" is reserved and cannot be used as an area name`,
    );
  }
  return trimmed;
}
