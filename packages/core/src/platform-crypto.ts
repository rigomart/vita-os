/**
 * Web Crypto, as core uses it.
 *
 * Slugs and record IDs need unguessable randomness, which every host core runs
 * on provides as a global: Cloudflare Workers, browsers, and Node. Reaching for
 * it through this accessor keeps core free of any host's type library and makes
 * the requirement explicit rather than ambient.
 */
interface WebCryptoSubset {
  getRandomValues<T extends ArrayBufferView>(array: T): T;
  randomUUID(): string;
}

export function platformCrypto(): WebCryptoSubset {
  const candidate = (globalThis as { crypto?: WebCryptoSubset }).crypto;
  if (candidate === undefined) {
    throw new Error("Web Crypto is unavailable in this environment");
  }
  return candidate;
}
