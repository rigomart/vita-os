import { slugify } from "./slugs";

export const RESERVED_AREA_SLUGS = new Set([
  "projects",
  "settings",
  "sign-in",
  "sign-up",
]);

/**
 * Validates that an area name does not conflict with reserved slugs.
 * Throws if the slugified name matches a reserved slug.
 */
export function validateAreaName(name: string): void {
  const base = slugify(name);
  if (RESERVED_AREA_SLUGS.has(base)) {
    throw new Error(`"${name}" is reserved and cannot be used as an area name`);
  }
}
