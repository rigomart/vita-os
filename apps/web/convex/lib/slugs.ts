export function slugify(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
}

/** Notion-style slug: `slugified-name-8hex`. */
export function generateSlug(name: string): string {
  const base = slugify(name);
  const bytes = new Uint8Array(4);
  crypto.getRandomValues(bytes);
  const suffix = Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
  return base ? `${base}-${suffix}` : suffix;
}
