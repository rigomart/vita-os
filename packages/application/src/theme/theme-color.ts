import { useEffect } from "react";

import type { ResolvedTheme } from "./theme-provider";

/**
 * The page's ground (`--surface-1` in `globals.css`) as hex, which every
 * browser takes as a `theme-color`. `apps/web/index.html` paints the same
 * before the app loads.
 */
const GROUND: Record<ResolvedTheme, string> = {
  light: "#f6f6f8",
  dark: "#0e0f11",
};

let theme: ResolvedTheme = "light";
let top: string | undefined;

/**
 * The document's `theme-color`, which an installed app paints its status bar
 * with: the colour at the top of the page while chrome there asks for one, or
 * else the theme's ground.
 */
function syncThemeColor() {
  document
    .querySelector('meta[name="theme-color"]')
    ?.setAttribute("content", top ?? GROUND[theme]);
}

export function applyThemeColor(resolvedTheme: ResolvedTheme) {
  theme = resolvedTheme;
  syncThemeColor();
}

/** While mounted, the status bar takes `color`, so it reads as part of the page. */
export function useTopColor(color: string) {
  useEffect(() => {
    top = color;
    syncThemeColor();
    return () => {
      top = undefined;
      syncThemeColor();
    };
  }, [color]);
}
