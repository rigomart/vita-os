import "@testing-library/jest-dom/vitest";
import { vi } from "vitest";

/**
 * What jsdom does not provide and the product's components expect.
 *
 * Media queries drive the responsive surfaces, and pointer capture is what the
 * UI library's drag and press interactions call into. Neither exists in jsdom, so
 * both are stubbed rather than worked around in every component.
 */
window.matchMedia =
  window.matchMedia ??
  vi.fn().mockImplementation((query: string) => ({
    matches: false,
    media: query,
    onchange: null,
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    addListener: vi.fn(),
    removeListener: vi.fn(),
    dispatchEvent: vi.fn(),
  }));

Element.prototype.setPointerCapture ??= vi.fn();
Element.prototype.releasePointerCapture ??= vi.fn();
Element.prototype.hasPointerCapture ??= vi.fn(() => false);
