/**
 * PROTOTYPE — throwaway. Variant B: floating island.
 *
 * The same single object as today, lifted off all three edges. Layout is
 * unchanged from `AppTopBar`, which is the point — this is the cheapest
 * floating direction, because nothing about the Area strip or ⌘K has to move.
 */

import type { PrototypeTopBarProps } from "./prototype-top-bar-props";

import { TopBarAreaStrip } from "../top-bar-area-strip";
import {
  AccountMenu,
  BrandMark,
  FLOAT_SURFACE,
  JumpButton,
  NewNoteButton,
  NotesButton,
} from "./header-pieces";

export function TopBarIsland({
  inboxOpen,
  noteCount,
  onNewNote,
  onOpenPalette,
  onToggleInbox,
}: PrototypeTopBarProps) {
  return (
    // The wrapper is what sticks; the island inside it is what floats, so the
    // page ground stays visible in the gutter on all three sides.
    <div className="pointer-events-none sticky top-0 z-20 px-3 pt-3">
      <header
        className={`pointer-events-auto flex h-12 items-center gap-3 rounded-xl px-2.5 md:grid md:grid-cols-[1fr_minmax(0,22rem)_1fr] ${FLOAT_SURFACE}`}
      >
        <div className="flex min-w-0 items-center gap-3 justify-self-start">
          <BrandMark />
          <TopBarAreaStrip />
        </div>

        <JumpButton className="hidden md:flex" onOpenPalette={onOpenPalette} />

        <div className="ml-auto flex items-center gap-2 md:ml-0 md:justify-self-end">
          <div className="hidden md:block">
            <NewNoteButton onNewNote={onNewNote} showLabel={false} />
          </div>
          <div className="hidden md:block">
            <NotesButton
              inboxOpen={inboxOpen}
              noteCount={noteCount}
              onToggleInbox={onToggleInbox}
            />
          </div>
          <AccountMenu />
        </div>
      </header>
    </div>
  );
}
