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

  /** Holds a reload until `work` settles, as an active write does. */
  async function hold<T>(work: () => Promise<T>): Promise<T> {
    activeWrites++;
    notify();
    try {
      return await work();
    } finally {
      activeWrites--;
      notify();
    }
  }

  const versionFetch: typeof fetch = async (input, init) => {
    const method = (
      init?.method ?? (input instanceof Request ? input.method : "GET")
    ).toUpperCase();
    const request = async () => {
      const response = await fetchImpl(input, init);
      const version = response.headers.get("X-Vita-Version")?.trim();
      if (bundledVersion && version && version !== bundledVersion) {
        targetVersion = version;
        notify();
      }
      return response;
    };
    return method === "GET" || method === "HEAD" ? request() : hold(request);
  };

  return {
    fetch: versionFetch,
    hold,
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
