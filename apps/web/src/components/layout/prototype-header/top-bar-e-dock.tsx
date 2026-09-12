/**
 * PROTOTYPE — throwaway. Variant E: perimeter dock.
 *
 * Identity and Areas hold the top-left corner; everything you *act* with moves
 * to a dock at the bottom, where the pointer already is. The top of the board
 * is left alone entirely.
 *
 * The thing to judge here: this dock and `MobileTabBar` want to be the same
 * object. AppShell hides the tab bar under this variant so the two don't stack.
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

export function TopBarDock({
  inboxOpen,
  noteCount,
  onNewNote,
  onOpenPalette,
  onToggleInbox,
}: PrototypeTopBarProps) {
  return (
    <>
      {/* Identity rail — fixed to the corner, never scrolls. */}
      <header
        className={`fixed top-3 left-3 z-20 flex h-11 max-w-[calc(100%-1.5rem)] min-w-0 items-center gap-2 rounded-full px-2.5 ${FLOAT_SURFACE}`}
      >
        <BrandMark compact />
        <span aria-hidden className="h-5 w-px shrink-0 bg-border" />
        <TopBarAreaStrip />
      </header>

      {/* The dock — search and every create/inspect action, thumb-height. */}
      <nav
        aria-label="Primary"
        className={`fixed bottom-4 left-1/2 z-20 flex h-14 max-w-[calc(100%-1.5rem)] -translate-x-1/2 items-center gap-2 rounded-full px-3 ${FLOAT_SURFACE}`}
      >
        <JumpButton
          className="w-auto min-w-36 rounded-full"
          label="Jump…"
          onOpenPalette={onOpenPalette}
        />
        <span aria-hidden className="h-6 w-px shrink-0 bg-border" />
        <NewNoteButton onNewNote={onNewNote} />
        <NotesButton
          inboxOpen={inboxOpen}
          noteCount={noteCount}
          onToggleInbox={onToggleInbox}
        />
        <AccountMenu />
      </nav>
    </>
  );
}
