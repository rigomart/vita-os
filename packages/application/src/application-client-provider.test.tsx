import type { PropsWithChildren } from "react";

import { QueryClient, useQueryClient } from "@tanstack/react-query";
import { renderHook } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import {
  ApplicationClientProvider,
  useApplicationClient,
} from "./application-client-provider";
import { createFakeApplicationClient } from "./test/fake-application-client";

describe("ApplicationClientProvider", () => {
  it("supplies the exact injected client and QueryClient", () => {
    const client = createFakeApplicationClient();
    const queryClient = new QueryClient();
    const wrapper = ({ children }: PropsWithChildren) => (
      <ApplicationClientProvider client={client} queryClient={queryClient}>
        {children}
      </ApplicationClientProvider>
    );

    const { result } = renderHook(
      () => ({ client: useApplicationClient(), queryClient: useQueryClient() }),
      { wrapper },
    );

    expect(result.current).toEqual({ client, queryClient });
  });

  it("fails clearly outside the provider", () => {
    expect(() => renderHook(() => useApplicationClient())).toThrow(
      "ApplicationClientProvider is missing.",
    );
  });
});
