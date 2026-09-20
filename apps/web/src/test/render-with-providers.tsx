import type { ApplicationClient } from "@vita-os/contracts";

import { QueryClient } from "@tanstack/react-query";
import {
  createMemoryHistory,
  createRootRoute,
  createRouter,
  RouterContextProvider,
} from "@tanstack/react-router";
import {
  render as rtlRender,
  renderHook as rtlRenderHook,
  type RenderHookOptions,
  type RenderOptions,
} from "@testing-library/react";
import { ApplicationClientProvider } from "@vita-os/application";
import { createFakeApplicationClient } from "@vita-os/application/test";
import { FeedbackProvider, type Feedback } from "@vita-os/ui/lib/feedback";
import { useMemo, type ReactElement, type ReactNode } from "react";
import { vi } from "vitest";

export type FeedbackMock = Feedback;

type ProviderOptions = {
  /**
   * The application client the screens read and write through. Left out, every
   * operation refuses, which is what a screen that should not have asked for
   * anything deserves.
   */
  applicationClient?: ApplicationClient;
  /** A cache a test can seed and then inspect. */
  queryClient?: QueryClient;
  feedback?: Feedback;
};

type RenderWithProvidersOptions = Omit<RenderOptions, "wrapper"> &
  ProviderOptions;

type RenderHookWithProvidersOptions<TProps> = Omit<
  RenderHookOptions<TProps>,
  "wrapper"
> &
  ProviderOptions;

export function createFeedbackMock(): FeedbackMock {
  return {
    success: vi.fn(),
    error: vi.fn(),
  };
}

/** A cache that never retries and never refetches behind a test's back. */
export function createTestQueryClient(): QueryClient {
  return new QueryClient({
    defaultOptions: {
      queries: { retry: false, staleTime: Infinity },
      mutations: { retry: false },
    },
  });
}

function createWrapper(
  feedback: Feedback,
  applicationClient?: ApplicationClient,
  queryClient?: QueryClient,
) {
  return function Providers({ children }: { children: ReactNode }) {
    const router = useMemo(() => {
      const rootRoute = createRootRoute();
      return createRouter({
        routeTree: rootRoute,
        history: createMemoryHistory({ initialEntries: ["/"] }),
      });
    }, []);

    const client = useMemo(
      () => applicationClient ?? createFakeApplicationClient(),
      [],
    );
    const cache = useMemo(() => queryClient ?? createTestQueryClient(), []);

    return (
      <ApplicationClientProvider client={client} queryClient={cache}>
        <FeedbackProvider feedback={feedback}>
          <RouterContextProvider router={router}>
            {children}
          </RouterContextProvider>
        </FeedbackProvider>
      </ApplicationClientProvider>
    );
  };
}

function customRender(
  ui: ReactElement,
  {
    applicationClient,
    queryClient,
    feedback = createFeedbackMock(),
    ...options
  }: RenderWithProvidersOptions = {},
) {
  const result = rtlRender(ui, {
    ...options,
    wrapper: createWrapper(feedback, applicationClient, queryClient),
  });
  return { ...result, feedback };
}

function customRenderHook<TResult, TProps>(
  hook: (initialProps: TProps) => TResult,
  {
    applicationClient,
    queryClient,
    feedback = createFeedbackMock(),
    ...options
  }: RenderHookWithProvidersOptions<TProps> = {},
) {
  const result = rtlRenderHook(hook, {
    ...options,
    wrapper: createWrapper(feedback, applicationClient, queryClient),
  });
  return { ...result, feedback };
}

export * from "@testing-library/react";
export { customRender as render, customRenderHook as renderHook };
