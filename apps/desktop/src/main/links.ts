import { safeLink } from "@vita-os/ui/lib/safe-link";

/**
 * Whether a link that leaves the app opens in another app (the browser, the
 * mail app): exactly the links the product's Markdown lets a person click.
 */
export function opensExternally(url: string): boolean {
  return safeLink(url) !== undefined;
}

/** `URL.origin` is "null" for a custom scheme like `app:`, so build it. */
export function originOf(url: string): string | null {
  const parsed = URL.parse(url);
  return parsed ? `${parsed.protocol}//${parsed.host}` : null;
}
