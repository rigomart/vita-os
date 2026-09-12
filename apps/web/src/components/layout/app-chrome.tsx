import type { CSSProperties } from "react";

import { Link } from "@tanstack/react-router";
import { Kbd } from "@vita-os/ui/components/kbd";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@vita-os/ui/components/tooltip";
import { format } from "date-fns";
import { FolderPlus, Inbox, MessageSquare, Plus, Search } from "lucide-react";

import { inboxSurfaceTriggerProps } from "@/features/inbox/surface/inbox-surface-trigger";
import { useTheme } from "@/features/theme/theme-provider";
import { useAttentionClock } from "@/hooks/use-attention-clock";
import { authClient } from "@/lib/auth-client";
import { isApplePlatform } from "@/lib/platform";
import { cn } from "@/lib/utils";

import { AreaStatusStrip } from "./area-status-strip";
import { InboxNoteCountBadge } from "./inbox-note-count-badge";
import { UserMenu } from "./user-menu";

interface AppChromeProps {
  noteCount: number | undefined;
  inboxOpen: boolean;
  onToggleInbox: () => void;
  onNewNote: () => void;
  onNewThread: () => void;
  onNewArea: () => void;
  onOpenPalette: () => void;
  /** True while the thread rail is open, so the chrome can clear it. */
  railOpen: boolean;
}

/**
 * The app chrome: three floating clusters over the page rather than a bar
 * across the top of it.
 *
 *   top-left       where you are — the mark and the Areas' status
 *   top-right      where you are in time, and what wants you — the date,
 *                  Notes, and your account
 *   bottom-centre  what you can do — jump anywhere, and the three creates
 *
 * Nothing spans the width, so the board reads to the top edge of the viewport.
 * The clusters are `fixed`, which would put them under the thread rail (z-30),
 * so both the right-hand cluster and the dock shift by the rail's own width
 * and borrow its easing; closed, `--rail` is 0px and nothing moves.
 */
const RAIL_WIDTH = "clamp(28rem,34vw,34rem)";

export function AppChrome({
  inboxOpen,
  noteCount,
  onNewArea,
  onNewNote,
  onNewThread,
  onOpenPalette,
  onToggleInbox,
  railOpen,
}: AppChromeProps) {
  const { data: session } = authClient.useSession();
  const { theme, setTheme } = useTheme();
  const today = new Date(useAttentionClock());
  // The palette answers to Cmd+K and Ctrl+K alike; the hint has to name the
  // key this keyboard actually has, spelled out for screen readers.
  const apple = isApplePlatform();
  const paletteHint = apple ? "⌘K" : "Ctrl K";
  const paletteShortcutLabel = apple ? "Command K" : "Control K";

  return (
    <TooltipProvider delay={200}>
      <div style={{ "--rail": railOpen ? RAIL_WIDTH : "0px" } as CSSProperties}>
        <header
          className={cn(
            "fixed top-3 left-3 z-20 flex h-11 min-w-0 items-center gap-2 rounded-full px-2.5",
            "max-w-[calc(100%-var(--rail)-1.5rem)]",
            FLOATING,
          )}
        >
          <Link
            to="/"
            aria-label="Vita OS home"
            className="flex min-w-0 shrink-0 items-center gap-2 rounded-lg ring-ring outline-none transition-opacity hover:opacity-80 focus-visible:ring-2"
          >
            <img
              src="/vita-logo.svg"
              alt=""
              className="size-7 shrink-0 rounded-lg shadow-sm ring-1 ring-border"
            />
            <span className="flex items-baseline gap-1 leading-none">
              <span className="font-heading text-base font-semibold tracking-tight">
                vita
              </span>
              <span className="text-2xs font-semibold tracking-[0.18em] text-muted-foreground uppercase">
                OS
              </span>
            </span>
          </Link>

          <span aria-hidden className="h-5 w-px shrink-0 bg-border" />
          <AreaStatusStrip />
        </header>

        <div
          className={cn(
            "fixed top-3 z-20 flex h-11 items-center gap-1.5 rounded-full px-2.5",
            "right-[calc(var(--rail)+0.75rem)] transition-[right] duration-200 ease-[cubic-bezier(0.32,0.72,0,1)] motion-reduce:transition-none",
            FLOATING,
          )}
        >
          {/* Today leads the cluster: the Dashboard used to state the date in
              its own header, and it is the same date on every page. */}
          <time
            dateTime={today.toISOString()}
            title={format(today, "EEEE, MMMM d, yyyy")}
            className="hidden shrink-0 pl-0.5 text-xs text-muted-foreground sm:block"
          >
            <span className="font-semibold text-foreground">
              {format(today, "EEE")}
            </span>{" "}
            · {format(today, "MMM d")}
          </time>
          <span
            aria-hidden
            className="hidden h-5 w-px shrink-0 bg-border sm:block"
          />

          <button
            type="button"
            aria-label="Notes"
            aria-expanded={inboxOpen}
            {...inboxSurfaceTriggerProps}
            onClick={onToggleInbox}
            className={cn(
              "relative flex size-8 items-center justify-center rounded-md transition-colors",
              inboxOpen
                ? "bg-muted text-foreground"
                : "text-muted-foreground hover:bg-muted/60 hover:text-foreground",
            )}
          >
            <Inbox className="size-4" />
            <span className="absolute -top-1 -right-1">
              <InboxNoteCountBadge noteCount={noteCount} />
            </span>
          </button>
          <UserMenu
            user={session?.user}
            theme={theme}
            onThemeChange={setTheme}
            onSignOut={() => authClient.signOut()}
          />
        </div>

        <nav
          aria-label="Primary"
          className={cn(
            "fixed bottom-4 z-20 flex h-14 max-w-[calc(100%-1.5rem)] items-center gap-1 rounded-full px-2",
            "left-[calc(50%-var(--rail)/2)] -translate-x-1/2 transition-[left] duration-200 ease-[cubic-bezier(0.32,0.72,0,1)] motion-reduce:transition-none",
            FLOATING,
          )}
        >
          {/* The palette keeps its full field: it is the primary way to go
              anywhere, and an icon would hide the shortcut that says so. */}
          <button
            type="button"
            onClick={onOpenPalette}
            aria-label={`Jump anywhere, ${paletteShortcutLabel}`}
            className="flex h-9 w-auto min-w-32 items-center gap-2 rounded-full border bg-muted/40 px-3 text-sm text-muted-foreground transition-colors hover:bg-muted sm:min-w-48"
          >
            <Search className="size-4 shrink-0" />
            <span className="hidden truncate sm:inline">Jump anywhere…</span>
            <Kbd className="ml-auto shrink-0">{paletteHint}</Kbd>
          </button>

          <span aria-hidden className="mx-1 h-6 w-px shrink-0 bg-border" />

          <DockAction
            icon={Plus}
            label="New note"
            shortcut="Q"
            onClick={onNewNote}
          />
          <DockAction
            icon={MessageSquare}
            label="New thread"
            onClick={onNewThread}
          />
          <DockAction icon={FolderPlus} label="New area" onClick={onNewArea} />
        </nav>
      </div>
    </TooltipProvider>
  );
}

/** The floating surface every cluster shares. */
const FLOATING =
  "border bg-background/80 shadow-lg backdrop-blur-md supports-[backdrop-filter]:bg-background/70";

function DockAction({
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
