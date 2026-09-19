import type { ThreadDetail, ThreadId } from "@vita-os/contracts";

import {
  createContext,
  type ReactNode,
  useContext,
  useMemo,
  useSyncExternalStore,
} from "react";

import type {
  ConvexActivityLogPage,
  ConvexApplicationClient,
  ConvexLiveResource,
  ConvexQueryState,
} from "./convex/convex-application-client-compatibility";

const ApplicationClientContext = createContext<ConvexApplicationClient | null>(
  null,
);

export function ApplicationClientProvider({
  client,
  children,
}: {
  client: ConvexApplicationClient;
  children: ReactNode;
}) {
  return (
    <ApplicationClientContext.Provider value={client}>
      {children}
    </ApplicationClientContext.Provider>
  );
}

export function useApplicationClient(): ConvexApplicationClient {
  const client = useContext(ApplicationClientContext);
  if (client === null) {
    throw new Error("ApplicationClientProvider is missing.");
  }
  return client;
}

function useLiveResource<T>(resource: ConvexLiveResource<T>): T {
  return useSyncExternalStore(
    resource.subscribe,
    resource.getSnapshot,
    resource.getSnapshot,
  );
}

export function useThreadDetail(slug: string): ConvexQueryState<ThreadDetail> {
  const client = useApplicationClient();
  const resource = useMemo(
    () => client.watchThreadDetail({ slug }),
    [client, slug],
  );
  return useLiveResource(resource);
}

export function useThreadActivity(
  threadId: ThreadId,
  initialPageSize: number,
): {
  state: ConvexQueryState<ConvexActivityLogPage>;
  loadMore: () => void;
} {
  const client = useApplicationClient();
  const resource = useMemo(
    () => client.watchThreadActivity({ threadId, initialPageSize }),
    [client, initialPageSize, threadId],
  );
  return { state: useLiveResource(resource), loadMore: resource.loadMore };
}
