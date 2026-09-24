import { ValidationError } from "./errors";
import { platformCrypto } from "./platform-crypto";
import { requireNonBlankText } from "./text";

export const RESERVED_AREA_SLUGS = new Set([
  "threads",
  "settings",
  "sign-in",
  "sign-up",
]);

export function slugify(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
}

/**
 * Notion-style slug: `slugified-name-8hex`. The suffix comes from the
 * platform's cryptographic randomness, so two Areas named the same still get
 * distinct URLs without a uniqueness round-trip.
 */
export function generateSlug(name: string): string {
  const base = slugify(name);
  const bytes = new Uint8Array(4);
  platformCrypto().getRandomValues(bytes);
  const suffix = Array.from(bytes)
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
  return base ? `${base}-${suffix}` : suffix;
}

/**
 * The Area name to store. Returning the trimmed name rather than validating in
 * place keeps the reserved-slug check honest — a caller cannot check one string
 * and store a differently-trimmed one.
 */
export function validateAreaName(name: string): string {
  const trimmed = requireNonBlankText(name, "Area name");
  const base = slugify(trimmed);
  if (RESERVED_AREA_SLUGS.has(base)) {
    throw new ValidationError(
      `"${trimmed}" is reserved and cannot be used as an area name`,
    );
  }
  return trimmed;
}
