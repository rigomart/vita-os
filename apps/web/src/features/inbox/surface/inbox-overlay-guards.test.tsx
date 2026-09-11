import { fireEvent, render, renderHook, screen } from "@testing-library/react";
import { useRef } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";

import {
  useCloseOnEscape,
  useCloseOnOutsidePointerDown,
} from "./inbox-overlay-guards";

/** Stands in for a portaled overlay the surface opened on top of itself. */
function mountOverlay(slot = "dialog-content") {
  const overlay = document.createElement("div");
  overlay.dataset.slot = slot;
  document.body.append(overlay);
  return overlay;
}

afterEach(() => {
  // Only the stand-ins parked on the body; a test's own tree is React's.
  document
    .querySelectorAll("body > [data-slot]")
    .forEach((node) => node.remove());
});

describe("useCloseOnEscape", () => {
  it("closes the surface on Escape", () => {
    const onEscape = vi.fn();
    renderHook(() => useCloseOnEscape(onEscape));

    fireEvent.keyDown(document, { key: "Escape" });

    expect(onEscape).toHaveBeenCalledTimes(1);
  });

  it("leaves Escape to an overlay opened above the surface", () => {
    const onEscape = vi.fn();
    renderHook(() => useCloseOnEscape(onEscape));
    mountOverlay("alert-dialog-content");

    fireEvent.keyDown(document, { key: "Escape" });

    expect(onEscape).not.toHaveBeenCalled();
  });
});

describe("useCloseOnOutsidePointerDown", () => {
  function Panel({ onOutside }: { onOutside: () => void }) {
    const panelRef = useRef<HTMLDivElement>(null);
    useCloseOnOutsidePointerDown(panelRef, onOutside);

    return (
      <>
        <div ref={panelRef}>
          <button type="button">inside</button>
        </div>
        <button type="button">elsewhere</button>
        <button type="button" data-inbox-surface-trigger="">
          trigger
        </button>
        <aside data-slot="thread-detail-pane">
          <button type="button">thread pane</button>
        </aside>
      </>
    );
  }

  it("closes on a pointer down outside the panel", () => {
    const onOutside = vi.fn();
    render(<Panel onOutside={onOutside} />);

    fireEvent.pointerDown(screen.getByRole("button", { name: "elsewhere" }));

    expect(onOutside).toHaveBeenCalledTimes(1);
  });

  it.each([
    ["inside the panel", "inside"],
    ["on the trigger that toggles it", "trigger"],
    ["inside the open thread pane", "thread pane"],
  ])("stays open on a pointer down %s", (_case, name) => {
    const onOutside = vi.fn();
    render(<Panel onOutside={onOutside} />);

    fireEvent.pointerDown(screen.getByRole("button", { name }));

    expect(onOutside).not.toHaveBeenCalled();
  });

  it("stays open while an overlay it opened is on screen", () => {
    const onOutside = vi.fn();
    render(<Panel onOutside={onOutside} />);
    // The When picker and the process dialog portal outside the panel, so their
    // clicks would otherwise read as "outside".
    const overlay = mountOverlay("popover-content");

    fireEvent.pointerDown(overlay);

    expect(onOutside).not.toHaveBeenCalled();
  });
});
