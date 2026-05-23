import type { ReactElement, ReactNode } from "react";

import {
  render as rtlRender,
  renderHook as rtlRenderHook,
  type RenderHookOptions,
  type RenderOptions,
} from "@testing-library/react";
import { FeedbackProvider, type Feedback } from "@vita-os/ui/lib/feedback";
import { vi } from "vitest";

export type FeedbackMock = Feedback;

type ProviderOptions = {
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

function createWrapper(feedback: Feedback) {
  return function Providers({ children }: { children: ReactNode }) {
    return <FeedbackProvider feedback={feedback}>{children}</FeedbackProvider>;
  };
}

function customRender(
  ui: ReactElement,
  {
    feedback = createFeedbackMock(),
    ...options
  }: RenderWithProvidersOptions = {},
) {
  const result = rtlRender(ui, {
    ...options,
    wrapper: createWrapper(feedback),
  });
  return { ...result, feedback };
}

function customRenderHook<TResult, TProps>(
  hook: (initialProps: TProps) => TResult,
  {
    feedback = createFeedbackMock(),
    ...options
  }: RenderHookWithProvidersOptions<TProps> = {},
) {
  const result = rtlRenderHook(hook, {
    ...options,
    wrapper: createWrapper(feedback),
  });
  return { ...result, feedback };
}

export * from "@testing-library/react";
export { customRender as render, customRenderHook as renderHook };
