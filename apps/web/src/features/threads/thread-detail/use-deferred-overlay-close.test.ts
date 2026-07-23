import { act, renderHook } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { useDeferredOverlayClose } from "./use-deferred-overlay-close";

describe("useDeferredOverlayClose", () => {
  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  it("paints the overlay closed before opening it on the next frame", () => {
    let openFrame: FrameRequestCallback | undefined;
    vi.stubGlobal(
      "requestAnimationFrame",
      vi.fn((callback: FrameRequestCallback) => {
        openFrame = callback;
        return 1;
      }),
    );
    vi.stubGlobal("cancelAnimationFrame", vi.fn());

    const { result } = renderHook(() => useDeferredOverlayClose(vi.fn()));

    expect(result.current.open).toBe(false);

    act(() => openFrame?.(0));

    expect(result.current.open).toBe(true);
  });

  it("waits for the closing animation before leaving Thread detail", () => {
    const onClosed = vi.fn();
    const { result } = renderHook(() => useDeferredOverlayClose(onClosed));

    act(() => result.current.requestClose());

    expect(result.current.open).toBe(false);
    expect(onClosed).not.toHaveBeenCalled();

    act(() => result.current.completeOpenChange(false));

    expect(onClosed).toHaveBeenCalledOnce();
  });

  it("cannot strand the route when a primitive misses its completion callback", () => {
    vi.useFakeTimers();
    const onClosed = vi.fn();
    const { result } = renderHook(() => useDeferredOverlayClose(onClosed));

    act(() => result.current.requestClose());
    expect(onClosed).not.toHaveBeenCalled();

    act(() => vi.advanceTimersByTime(700));

    expect(onClosed).toHaveBeenCalledOnce();
  });
});
