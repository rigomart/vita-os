/** The one channel the renderer reaches the local client through. */
export const CALL_CHANNEL = "vita:call";

/** What the preload exposes to the renderer as `window.vita`. */
export interface VitaBridge {
  /** Calls the local `ApplicationClient` method of that name in main. */
  call(method: string, input: unknown): Promise<unknown>;
}
