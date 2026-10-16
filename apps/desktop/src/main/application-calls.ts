import type { ApplicationClient } from "@vita-os/contracts";

/**
 * Answers a renderer's call with the local client's method of that name, and
 * refuses any other name.
 *
 * The input's shape is not checked: the renderer is our own sandboxed bundle
 * and never loads remote content.
 */
export function callApplication(
  client: ApplicationClient,
  method: unknown,
  input: unknown,
): Promise<unknown> {
  if (typeof method !== "string" || !Object.hasOwn(client, method)) {
    return Promise.reject(
      new Error(`Vita OS has no method named ${String(method)}.`),
    );
  }
  const call = client[method as keyof ApplicationClient] as (
    input: unknown,
  ) => Promise<unknown>;
  return call(input);
}
