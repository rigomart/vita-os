import type { ApplicationClient } from "@vita-os/contracts";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  createContext,
  type PropsWithChildren,
  useContext,
  useState,
} from "react";

const ApplicationClientContext = createContext<ApplicationClient | null>(null);

function createDefaultQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: { refetchInterval: false },
      mutations: { retry: false },
    },
  });
}

export function ApplicationClientProvider({
  client,
  queryClient,
  children,
}: PropsWithChildren<{
  client: ApplicationClient;
  queryClient?: QueryClient;
}>) {
  const [ownedQueryClient] = useState(createDefaultQueryClient);

  return (
    <ApplicationClientContext.Provider value={client}>
      <QueryClientProvider client={queryClient ?? ownedQueryClient}>
        {children}
      </QueryClientProvider>
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
