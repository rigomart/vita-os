/**
 * PROTOTYPE — throwaway. Variant F: E's frame, C's identity capsule.
 *
 * Three floating clusters, no bar anywhere:
 *   top-left      identity + Areas, in C's rounded capsule
 *   top-right     the two "about me / my stuff" controls — Notes and account
 *   bottom-centre the dock: the palette field, then the three creates as icons
 *
 * The palette keeps its full input — it is the primary way to go anywhere and
 * the ⌘K hint has to stay visible. The three create icons carry tooltips
 * instead. "New note" is the canonical capture verb (CONTEXT.md: Task is
 * retired vocabulary, Note is canonical).
 */

import type { CSSProperties } from "react";

import { Kbd } from "@vita-os/ui/components/kbd";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@vita-os/ui/components/tooltip";
import { FolderPlus, MessageSquare, Plus } from "lucide-react";

import { cn } from "@/lib/utils";

import type { PrototypeTopBarProps } from "./prototype-top-bar-props";

import { TopBarAreaStrip } from "../top-bar-area-strip";
import {
  AccountMenu,
  BrandMark,
  FLOAT_SURFACE,
  JumpButton,
  NotesButton,
} from "./header-pieces";

/**
 * The thread rail is `position: fixed` at z-30 and would sit on top of this
 * chrome, so the clusters shift by exactly the rail's own width and reuse its
 * easing. Closed, the var is 0px and nothing moves.
 */
const RAIL_OPEN = "clamp(28rem,34vw,34rem)";

export function TopBarRefined({
  inboxOpen,
  noteCount,
  onNewArea,
  onNewNote,
  onNewThread,
  onOpenPalette,
  onToggleInbox,
  railOpen,
}: PrototypeTopBarProps) {
  return (
    <TooltipProvider delay={200}>
      <div style={{ "--rail": railOpen ? RAIL_OPEN : "0px" } as CSSProperties}>
        {/* Top-left — C's capsule, kept whole. */}
        <header
          className={cn(
            "fixed top-3 left-3 z-20 flex h-11 min-w-0 items-center gap-2 rounded-full px-2.5",
            "max-w-[calc(100%-var(--rail)-1.5rem)]",
            FLOAT_SURFACE,
          )}
        >
          <BrandMark />
          <span aria-hidden className="h-5 w-px shrink-0 bg-border" />
          <TopBarAreaStrip />
        </header>

        {/* Top-right — mine: what's waiting for me, and me. */}
        <div
          className={cn(
            "fixed top-3 z-20 flex h-11 items-center gap-1.5 rounded-full px-2.5",
            "right-[calc(var(--rail)+0.75rem)] transition-[right] duration-200 ease-[cubic-bezier(0.32,0.72,0,1)] motion-reduce:transition-none",
            FLOAT_SURFACE,
          )}
        >
          <NotesButton
            inboxOpen={inboxOpen}
            noteCount={noteCount}
            onToggleInbox={onToggleInbox}
          />
          <AccountMenu />
        </div>

        {/* Bottom-centre — the dock: find, then make. */}
        <nav
          aria-label="Primary"
          className={cn(
            "fixed bottom-4 z-20 flex h-14 items-center gap-1 rounded-full px-2",
            "left-[calc(50%-var(--rail)/2)] -translate-x-1/2 transition-[left] duration-200 ease-[cubic-bezier(0.32,0.72,0,1)] motion-reduce:transition-none",
            FLOAT_SURFACE,
          )}
        >
          {/* The palette keeps its full field — it is the primary way to go
              anywhere, and an icon would hide the ⌘K affordance. */}
          <JumpButton
            className="w-auto min-w-48 rounded-full"
            onOpenPalette={onOpenPalette}
          />
          <span aria-hidden className="mx-1 h-6 w-px shrink-0 bg-border" />
          <DockButton
            icon={Plus}
            label="New note"
            shortcut="Q"
            onClick={onNewNote}
          />
          <DockButton
            icon={MessageSquare}
            label="New thread"
            onClick={onNewThread}
          />
          <DockButton icon={FolderPlus} label="New area" onClick={onNewArea} />
        </nav>
      </div>
    </TooltipProvider>
  );
}

function DockButton({
  icon: Icon,
  label,
  onClick,
  shortcut,
}: {
  icon: typeof Plus;
  label: string;
  onClick: () => void;
  shortcut?: string;
}) {
  return (
    <Tooltip>
      <TooltipTrigger
        render={
          <button
            type="button"
            aria-label={label}
            onClick={onClick}
            className="flex size-10 shrink-0 items-center justify-center rounded-full text-muted-foreground ring-ring transition-colors outline-none hover:bg-muted hover:text-foreground focus-visible:ring-2"
          />
        }
      >
        <Icon className="size-[18px]" />
      </TooltipTrigger>
      <TooltipContent side="top" sideOffset={8}>
        <span className="font-medium">{label}</span>
        {shortcut !== undefined && <Kbd>{shortcut}</Kbd>}
      </TooltipContent>
    </Tooltip>
  );
}
