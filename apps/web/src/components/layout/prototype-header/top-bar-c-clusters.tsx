/**
 * PROTOTYPE — throwaway. Variant C: split clusters.
 *
 * Three independent capsules — identity + Areas, the jump field, the actions —
 * with the page visible between them. Nothing spans the width, so the chrome
 * never reads as a wall. The open question is what happens to the centre
 * capsule's axis as the Area list grows.
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

export function TopBarClusters({
  inboxOpen,
  noteCount,
  onNewNote,
  onOpenPalette,
  onToggleInbox,
}: PrototypeTopBarProps) {
  return (
    <div className="pointer-events-none sticky top-0 z-20 flex items-center gap-2 px-3 pt-3">
      <div
        className={`pointer-events-auto flex h-11 min-w-0 items-center gap-2 rounded-full px-2.5 ${FLOAT_SURFACE}`}
      >
        <BrandMark />
        <span aria-hidden className="h-5 w-px shrink-0 bg-border" />
        <TopBarAreaStrip />
      </div>

      <div
        className={`pointer-events-auto mx-auto hidden h-11 w-full max-w-80 items-center rounded-full px-2 md:flex ${FLOAT_SURFACE}`}
      >
        <JumpButton
          className="border-0 bg-transparent hover:bg-transparent hover:text-foreground"
          onOpenPalette={onOpenPalette}
        />
      </div>

      <div
        className={`pointer-events-auto ml-auto flex h-11 items-center gap-2 rounded-full px-2.5 ${FLOAT_SURFACE}`}
      >
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
    </div>
  );
}
