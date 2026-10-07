/** Shared by application requests and Better Auth, including requests before React mounts. */
export function createVersionAwareFetch(
  webVersion: string | undefined,
  fetchImpl: typeof fetch = (...args) => fetch(...args),
) {
  const bundledVersion = webVersion?.trim();
  let targetVersion: string | undefined;
  let activeWrites = 0;
  let reloadStarted = false;
  const listeners = new Set<() => void>();
  const notify = () => {
    for (const listener of listeners) listener();
  };

  const versionFetch: typeof fetch = async (input, init) => {
    const method = (
      init?.method ?? (input instanceof Request ? input.method : "GET")
    ).toUpperCase();
    const isWrite = method !== "GET" && method !== "HEAD";
    if (isWrite) {
      activeWrites++;
      notify();
    }
    try {
      const response = await fetchImpl(input, init);
      const version = response.headers.get("X-Vita-Version")?.trim();
      if (bundledVersion && version && version !== bundledVersion) {
        targetVersion = version;
        notify();
      }
      return response;
    } finally {
      if (isWrite) {
        activeWrites--;
        notify();
      }
    }
  };

  return {
    fetch: versionFetch,
    getState: () => ({ targetVersion, activeWrites, reloadStarted }),
    subscribe(listener: () => void) {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
    claimReload() {
      if (reloadStarted) return false;
      reloadStarted = true;
      return true;
    },
  };
}

export const versionAwareFetch = createVersionAwareFetch(
  import.meta.env.VITE_APP_VERSION,
);
