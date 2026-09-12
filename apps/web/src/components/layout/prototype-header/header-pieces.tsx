/**
 * PROTOTYPE — throwaway. Delete with the rest of `prototype-header/`.
 *
 * The chrome's *content* is settled — mark, Area strip, jump field, New note,
 * Notes, account. Only the container is in question, so the atoms live here and
 * each variant owns its own layout entirely.
 */

import { Link } from "@tanstack/react-router";
import { Button } from "@vita-os/ui/components/button";
import { Kbd } from "@vita-os/ui/components/kbd";
import { Inbox, Plus, Search } from "lucide-react";

import { inboxSurfaceTriggerProps } from "@/features/inbox/surface/inbox-surface-trigger";
import { useTheme } from "@/features/theme/theme-provider";
import { authClient } from "@/lib/auth-client";
import { isApplePlatform } from "@/lib/platform";
import { cn } from "@/lib/utils";

import { InboxNoteCountBadge } from "../inbox-note-count-badge";
import { UserMenu } from "../user-menu";

export function BrandMark({ compact }: { compact?: boolean }) {
  return (
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
      {!compact && (
        <span className="flex items-baseline gap-1 leading-none">
          <span className="font-heading text-base font-semibold tracking-tight">
            vita
          </span>
          <span className="text-2xs font-semibold tracking-[0.18em] text-muted-foreground uppercase">
            OS
          </span>
        </span>
      )}
    </Link>
  );
}

export function JumpButton({
  className,
  label = "Jump anywhere…",
  onOpenPalette,
}: {
  className?: string;
  label?: string;
  onOpenPalette: () => void;
}) {
  const apple = isApplePlatform();
  return (
    <button
      type="button"
      onClick={onOpenPalette}
      aria-label={`Jump anywhere, ${apple ? "Command K" : "Control K"}`}
      className={cn(
        "flex h-8 w-full items-center gap-2 rounded-lg border bg-muted/40 px-3 text-sm text-muted-foreground transition-colors hover:bg-muted",
        className,
      )}
    >
      <Search className="size-4 shrink-0" />
      <span className="truncate">{label}</span>
      <Kbd className="ml-auto shrink-0">{apple ? "⌘K" : "Ctrl K"}</Kbd>
    </button>
  );
}

export function NewNoteButton({
  onNewNote,
  showLabel = true,
}: {
  onNewNote: () => void;
  showLabel?: boolean;
}) {
  return (
    <Button
      onClick={onNewNote}
      aria-label="New note"
      className={cn(showLabel ? "px-3" : "w-9 px-0")}
    >
      <Plus />
      {showLabel && <span>New note</span>}
    </Button>
  );
}

export function NotesButton({
  inboxOpen,
  noteCount,
  onToggleInbox,
}: {
  inboxOpen: boolean;
  noteCount: number | undefined;
  onToggleInbox: () => void;
}) {
  return (
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
  );
}

/** The floating surface shared by B, C and E: blurred, ringed, lifted. */
export const FLOAT_SURFACE =
  "border bg-background/80 shadow-lg backdrop-blur-md supports-[backdrop-filter]:bg-background/70";

export function AccountMenu() {
  const { data: session } = authClient.useSession();
  const { theme, setTheme } = useTheme();
  return (
    <UserMenu
      user={session?.user}
      theme={theme}
      onThemeChange={setTheme}
      onSignOut={() => authClient.signOut()}
    />
  );
}
