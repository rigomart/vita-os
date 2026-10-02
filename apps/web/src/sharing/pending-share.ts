export const pendingShareKey = "vita-pending-shared-note";

export function readPendingShares(): string[] {
  return JSON.parse(sessionStorage.getItem(pendingShareKey) ?? "[]");
}

/** Receive the OS share before routing or signing in can discard its parameters. */
export function receiveSharedNote() {
  const url = new URL(window.location.href);
  if (url.pathname !== "/share-target") return;

  const parts = ["title", "text", "url"]
    .map((key) => url.searchParams.get(key)?.trim())
    .filter((value): value is string => Boolean(value));
  const body = [...new Set(parts)].join("\n\n");
  if (body) {
    sessionStorage.setItem(
      pendingShareKey,
      JSON.stringify([...readPendingShares(), body]),
    );
  }

  // Keep shared content out of the address and subsequent navigation history.
  window.history.replaceState(window.history.state, "", "/");
}
