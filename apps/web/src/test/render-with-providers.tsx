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
import { FeedbackProvider, type Feedback } from "@vita-os/ui/lib/feedback";
import { useMemo, type ReactElement, type ReactNode } from "react";
import { vi } from "vitest";

import type { ConvexApplicationClient } from "@/application/convex/convex-application-client-compatibility";

import { ApplicationClientProvider } from "@/application/application-client-context";

export type FeedbackMock = Feedback;

type ProviderOptions = {
  applicationClient?: ConvexApplicationClient;
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

function createWrapper(
  feedback: Feedback,
  applicationClient?: ConvexApplicationClient,
) {
  return function Providers({ children }: { children: ReactNode }) {
    const router = useMemo(() => {
      const rootRoute = createRootRoute();
      return createRouter({
        routeTree: rootRoute,
        history: createMemoryHistory({ initialEntries: ["/"] }),
      });
    }, []);

    const content = (
      <FeedbackProvider feedback={feedback}>
        <RouterContextProvider router={router}>
          {children}
        </RouterContextProvider>
      </FeedbackProvider>
    );
    return applicationClient ? (
      <ApplicationClientProvider client={applicationClient}>
        {content}
      </ApplicationClientProvider>
    ) : (
      content
    );
  };
}

function customRender(
  ui: ReactElement,
  {
    applicationClient,
    feedback = createFeedbackMock(),
    ...options
  }: RenderWithProvidersOptions = {},
) {
  const result = rtlRender(ui, {
    ...options,
    wrapper: createWrapper(feedback, applicationClient),
  });
  return { ...result, feedback };
}

function customRenderHook<TResult, TProps>(
  hook: (initialProps: TProps) => TResult,
  {
    applicationClient,
    feedback = createFeedbackMock(),
    ...options
  }: RenderHookWithProvidersOptions<TProps> = {},
) {
  const result = rtlRenderHook(hook, {
    ...options,
    wrapper: createWrapper(feedback, applicationClient),
  });
  return { ...result, feedback };
}

export * from "@testing-library/react";
export { customRender as render, customRenderHook as renderHook };
