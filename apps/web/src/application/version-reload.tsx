import { useQueryClient } from "@tanstack/react-query";
import { useEffect } from "react";

import { versionAwareFetch } from "../lib/version-aware-fetch";

const fetchManifest: typeof fetch = (...args) => fetch(...args);
const reloadPage = () => window.location.reload();

export function VersionReload({
  monitor = versionAwareFetch,
  fetchManifest: readManifest = fetchManifest,
  reload = reloadPage,
}: {
  monitor?: typeof versionAwareFetch;
  fetchManifest?: typeof fetch;
  reload?: () => void;
}) {
  const queryClient = useQueryClient();
  useEffect(() => {
    let stopped = false;
    let polling = false;
    let readyVersion: string | undefined;
    let timer: ReturnType<typeof setTimeout> | undefined;

    const tryReload = () => {
      const state = monitor.getState();
      if (
        !stopped &&
        readyVersion &&
        readyVersion === state.targetVersion &&
        state.activeWrites === 0 &&
        queryClient.isMutating() === 0 &&
        monitor.claimReload()
      )
        reload();
    };
    const poll = async () => {
      if (stopped || monitor.getState().reloadStarted) return;
      polling = true;
      try {
        const response = await readManifest("/version.json", {
          cache: "no-store",
        });
        if (response.ok) {
          const manifest: unknown = await response.json();
          readyVersion =
            typeof manifest === "object" &&
            manifest !== null &&
            "version" in manifest &&
            typeof manifest.version === "string"
              ? manifest.version
              : undefined;
          tryReload();
        }
      } catch {
        // The API deploys first; a missing or unavailable web manifest is retried.
      } finally {
        if (!stopped && !monitor.getState().reloadStarted)
          timer = setTimeout(() => void poll(), 1000);
      }
    };
    const observe = () => {
      tryReload();
      if (!polling && monitor.getState().targetVersion) void poll();
    };
    const unsubscribeVersion = monitor.subscribe(observe);
    const unsubscribeMutations = queryClient
      .getMutationCache()
      .subscribe(tryReload);
    observe();
    return () => {
      stopped = true;
      clearTimeout(timer);
      unsubscribeVersion();
      unsubscribeMutations();
    };
  }, [monitor, queryClient, readManifest, reload]);
  return null;
}
