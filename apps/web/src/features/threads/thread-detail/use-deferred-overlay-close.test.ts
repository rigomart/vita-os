import { act, renderHook } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { useDeferredOverlayClose } from "./use-deferred-overlay-close";

describe("useDeferredOverlayClose", () => {
  it("waits for the closing animation before leaving Thread detail", () => {
    const onClosed = vi.fn();
    const { result } = renderHook(() => useDeferredOverlayClose(onClosed));

    act(() => result.current.requestClose());

    expect(result.current.open).toBe(false);
    expect(onClosed).not.toHaveBeenCalled();

    act(() => result.current.completeOpenChange(false));

    expect(onClosed).toHaveBeenCalledOnce();
  });
});
