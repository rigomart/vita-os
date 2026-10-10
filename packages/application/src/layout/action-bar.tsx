import { MessageSquarePlus, PenLine, Search } from "lucide-react";

import type { ChromeActions } from "./sky-header";

import { paletteKey } from "./sky-header";

/**
 * Below `lg`, the actions the header holds on a wide screen, in a bar at the
 * bottom where a thumb reaches them: search as a field filling the bar, then
 * a new Thread and a new Note. It floats over the page, which keeps room for
 * it at its foot (`AppShell`), and clears the home indicator.
 */
export function ActionBar({
  onNewNote,
  onNewThread,
  onOpenPalette,
}: ChromeActions) {
  return (
    <nav
      aria-label="Actions"
      className="fixed inset-x-3 bottom-[max(0.75rem,env(safe-area-inset-bottom))] z-30 mx-auto flex h-14 max-w-md items-center gap-1.5 rounded-full border bg-surface-2/90 px-1.5 shadow-[0_12px_40px_-12px_rgb(0_0_0/0.4)] backdrop-blur-xl lg:hidden"
    >
      <button
        type="button"
        aria-label={`Search, ${paletteKey().label}`}
        onClick={onOpenPalette}
        className="flex h-11 min-w-0 flex-1 items-center gap-2 rounded-full bg-muted/70 px-4 text-sm text-muted-foreground transition-colors outline-none hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring/40"
      >
        <Search aria-hidden className="size-4 shrink-0" />
        <span className="truncate">Search</span>
      </button>
      <button
        type="button"
        aria-label="New thread"
        title="New thread"
        onClick={onNewThread}
        className="flex size-11 shrink-0 items-center justify-center rounded-full text-muted-foreground transition-colors outline-none hover:bg-muted hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring/40"
      >
        <MessageSquarePlus aria-hidden className="size-[18px]" />
      </button>
      <button
        type="button"
        aria-label="New note"
        onClick={onNewNote}
        className="flex h-11 shrink-0 items-center gap-2 rounded-full bg-foreground px-4 text-sm font-semibold text-surface-1 outline-none focus-visible:ring-2 focus-visible:ring-ring/60"
      >
        <PenLine aria-hidden className="size-4" />
        Note
      </button>
    </nav>
  );
}
