import type { ApplicationClient } from "@vita-os/contracts";
import type { PropsWithChildren } from "react";

import { QueryClient } from "@tanstack/react-query";

import { ApplicationClientProvider } from "../application-client-provider";

/**
 * The shared application, wired to a fake client and a cache a test can inspect.
 *
 * Retries are off so a refused operation surfaces immediately, and cached reads
 * are fresh so a test's own seeded data is not refetched out from under it.
 */
export function createHarness(
  client: ApplicationClient,
  seed?: (cache: QueryClient) => void,
) {
  const cache = new QueryClient({
    defaultOptions: {
      queries: { retry: false, staleTime: Infinity },
      mutations: { retry: false },
    },
  });
  seed?.(cache);

  return {
    cache,
    wrapper: ({ children }: PropsWithChildren) => (
      <ApplicationClientProvider client={client} queryClient={cache}>
        {children}
      </ApplicationClientProvider>
    ),
  };
}
