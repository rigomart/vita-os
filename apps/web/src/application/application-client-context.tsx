import type {
  ActivityLogPage,
  ApplicationClient,
  LiveResource,
  QueryState,
  ThreadDetail,
  ThreadId,
} from "@vita-os/contracts";

import {
  createContext,
  type ReactNode,
  useContext,
  useMemo,
  useSyncExternalStore,
} from "react";

const ApplicationClientContext = createContext<ApplicationClient | null>(null);

export function ApplicationClientProvider({
  client,
  children,
}: {
  client: ApplicationClient;
  children: ReactNode;
}) {
  return (
    <ApplicationClientContext.Provider value={client}>
      {children}
    </ApplicationClientContext.Provider>
  );
}

export function useApplicationClient(): ApplicationClient {
  const client = useContext(ApplicationClientContext);
  if (client === null) {
    throw new Error("ApplicationClientProvider is missing.");
  }
  return client;
}

function useLiveResource<T>(resource: LiveResource<T>): T {
  return useSyncExternalStore(
    resource.subscribe,
    resource.getSnapshot,
    resource.getSnapshot,
  );
}

export function useThreadDetail(slug: string): QueryState<ThreadDetail> {
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
  state: QueryState<ActivityLogPage>;
  loadMore: () => void;
} {
  const client = useApplicationClient();
  const resource = useMemo(
    () => client.watchThreadActivity({ threadId, initialPageSize }),
    [client, initialPageSize, threadId],
  );
  return { state: useLiveResource(resource), loadMore: resource.loadMore };
}
