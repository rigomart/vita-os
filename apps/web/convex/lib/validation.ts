import { slugify } from "./slugs";

export const RESERVED_AREA_SLUGS = new Set([
  "threads",
  "settings",
  "sign-in",
  "sign-up",
]);

/**
 * The trimmed form of a name the user typed, or a thrown error when trimming
 * leaves nothing.
 *
 * Every surface that titles something — an Area, a Thread, a Task — names it
 * through here, so `"  "` is refused identically everywhere and what reaches
 * the database is what the user would recognize, without the stray
 * whitespace that leading and trailing spaces would otherwise preserve.
 *
 * `label` names the field in the error, e.g. `"Area name cannot be empty"`.
 */
export function requireTitle(value: string, label: string): string {
  const trimmed = value.trim();
  if (!trimmed) {
    throw new Error(`${label} cannot be empty`);
  }
  return trimmed;
}

/**
 * The Area name to store: trimmed, non-blank, and not one of the words the
 * router already owns as a top-level path.
 *
 * Returning the trimmed name rather than validating in place is what keeps
 * the reserved-slug check honest — a caller cannot check one string and then
 * store a differently-trimmed one.
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
