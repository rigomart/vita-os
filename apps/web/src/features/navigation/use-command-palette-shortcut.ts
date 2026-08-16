import { useEffect } from "react";

export function useCommandPaletteShortcut(onOpen: () => void) {
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      // Physical key, like the area-jump digits: `e.key` is "K" under caps
      // lock and a different letter entirely on non-Latin layouts.
      // AltGr reports ctrl+alt together, so alt must disqualify the match.
      if (e.code === "KeyK" && (e.metaKey || e.ctrlKey) && !e.altKey) {
        e.preventDefault();
        onOpen();
      }
    }
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [onOpen]);
}
