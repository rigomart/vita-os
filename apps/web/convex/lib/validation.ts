import { slugify } from "./slugs";

export const RESERVED_AREA_SLUGS = new Set([
  "threads",
  "settings",
  "sign-in",
  "sign-up",
]);

/**
 * The trimmed name, or a thrown "<label> cannot be empty". Every surface that
 * titles something names it through here, so blanks are refused identically
 * everywhere.
 */
export function requireTitle(value: string, label: string): string {
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
  const trimmed = requireTitle(name, "Area name");
  const base = slugify(trimmed);
  if (RESERVED_AREA_SLUGS.has(base)) {
    throw new Error(
      `"${trimmed}" is reserved and cannot be used as an area name`,
    );
  }
  return trimmed;
}
