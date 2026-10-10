import type { CSSProperties, ReactNode } from "react";

import { Link } from "@tanstack/react-router";
import { Kbd } from "@vita-os/ui/components/kbd";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@vita-os/ui/components/tooltip";
import { cn } from "@vita-os/ui/lib/utils";
import { format } from "date-fns";
import { MessageSquarePlus, PenLine, Search } from "lucide-react";
import { useEffect, useState } from "react";

import { useAttentionClock } from "../hooks/use-attention-clock";
import { clock } from "../lib/clock";
import { isApplePlatform } from "../lib/platform";
import { useTheme } from "../theme/theme-provider";
import { useViewer } from "../viewer/viewer-context";
import { hourOf, isDay, skyAt, sunAt } from "./sky";
import { UserMenu } from "./user-menu";

export interface ChromeActions {
  onNewNote: () => void;
  onNewThread: () => void;
  onOpenPalette: () => void;
}

/**
 * The page's header is the sky as it is right now: dawn, day, dusk or night,
 * blended by the hour, the sun crossing it from sunrise to sunset and a moon
 * and stars after dark. It sits in the page and scrolls away with it.
 *
 * The sky is ambient chrome, not board colour: nothing on it is an item or a
 * time, so lateness stays the only colour the board itself carries.
 *
 * From `lg` the actions sit at its right; below, they move to the `ActionBar`
 * at the bottom, where a thumb reaches them, and only the account menu stays.
 */
export function SkyHeader({
  onNewNote,
  onNewThread,
  onOpenPalette,
}: ChromeActions) {
  const { viewer, signOut } = useViewer();
  const { theme, setTheme } = useTheme();
  const today = useAttentionClock();
  const hour = hourOf(useMinuteClock());
  const sky = skyAt(hour);
  const palette = paletteKey();

  return (
    <header
      aria-label="Vita OS"
      className="relative isolate overflow-hidden"
      style={
        {
          "--ink": sky.ink,
          background: `linear-gradient(to bottom, ${sky.top}, ${sky.horizon})`,
          color: sky.ink,
        } as CSSProperties
      }
    >
      {!isDay(hour) && <Stars />}
      <div className="relative mx-auto max-w-[76rem] px-4 sm:px-6">
        <Sun hour={hour} />
        <div className="flex h-16 items-center gap-4">
          <Link
            to="/"
            aria-label="Vita OS home"
            className="shrink-0 rounded-lg outline-none transition-opacity hover:opacity-85 focus-visible:ring-2 focus-visible:ring-[var(--ink)]"
          >
            <img
              src="/vita-logo.svg"
              alt=""
              className="size-7 rounded-lg ring-1 ring-[color-mix(in_oklab,var(--ink)_25%,transparent)]"
            />
          </Link>
          <p className="flex min-w-0 items-baseline gap-2.5">
            <time dateTime={format(today, "yyyy-MM-dd")} className="contents">
              <span className="font-heading text-2xl font-semibold tracking-tight">
                {format(today, "EEEE")}
              </span>
              <span className="truncate text-sm opacity-75">
                {format(today, "MMMM d")}
              </span>
            </time>
          </p>

          <div className="ml-auto flex items-center gap-1.5">
            <TooltipProvider delay={200}>
              <div className="hidden items-center gap-1.5 lg:flex">
                <button
                  type="button"
                  aria-label={`Search, ${palette.label}`}
                  onClick={onOpenPalette}
                  className={cn(skyButton, "w-52 justify-start px-3")}
                >
                  <Search aria-hidden className="size-4" />
                  <span className="text-sm opacity-80">Search</span>
                  <span className="ml-auto text-xs opacity-60">
                    {palette.hint}
                  </span>
                </button>
                <SkyAction label="New note" shortcut="Q" onClick={onNewNote}>
                  <PenLine className="size-4" />
                </SkyAction>
                <SkyAction label="New thread" onClick={onNewThread}>
                  <MessageSquarePlus className="size-4" />
                </SkyAction>
              </div>
            </TooltipProvider>
            <UserMenu
              user={viewer}
              theme={theme}
              onThemeChange={setTheme}
              onSignOut={signOut}
            />
          </div>
        </div>
        <div className="h-4 lg:h-8" />
      </div>
    </header>
  );
}

/** ⌘K or Ctrl K, as this keyboard has it, and spelled out for a reader. */
export function paletteKey() {
  const apple = isApplePlatform();
  return {
    hint: apple ? "⌘K" : "Ctrl K",
    label: apple ? "Command K" : "Control K",
  };
}

/** The clock to the minute, which is as finely as the sky moves. */
function useMinuteClock() {
  const [now, setNow] = useState(clock.now);
  useEffect(() => {
    const tick = () => setNow(clock.now());
    const timer = setInterval(tick, 60_000);
    const stop = clock.subscribe(tick);
    return () => {
      clearInterval(timer);
      stop();
    };
  }, []);
  return now;
}

const skyButton =
  "flex h-9 min-w-9 items-center justify-center gap-2 rounded-full bg-[color-mix(in_oklab,var(--ink)_12%,transparent)] ring-1 ring-[color-mix(in_oklab,var(--ink)_18%,transparent)] backdrop-blur-sm transition-colors outline-none hover:bg-[color-mix(in_oklab,var(--ink)_20%,transparent)] focus-visible:ring-2 focus-visible:ring-[var(--ink)]";

function SkyAction({
  label,
  shortcut,
  onClick,
  children,
}: {
  label: string;
  shortcut?: string;
  onClick: () => void;
  children: ReactNode;
}) {
  return (
    <Tooltip>
      <TooltipTrigger
        render={
          <button
            type="button"
            aria-label={label}
            onClick={onClick}
            className={skyButton}
          />
        }
      >
        {children}
      </TooltipTrigger>
      <TooltipContent sideOffset={8}>
        <span className="font-medium">{label}</span>
        {shortcut !== undefined && <Kbd>{shortcut}</Kbd>}
      </TooltipContent>
    </Tooltip>
  );
}

/**
 * The sun on its arc behind the header's content, or by night a moon hanging
 * right of centre.
 */
function Sun({ hour }: { hour: number }) {
  const sun = sunAt(hour);
  if (sun === undefined) {
    return (
      <span
        aria-hidden
        className="absolute top-1/2 left-[58%] -z-10 size-6 -translate-y-1/2 rounded-full"
        style={{
          background: "#eef0fb",
          boxShadow:
            "inset -6px 2px 0 0 #c9cde6, 0 0 28px 6px rgba(210, 215, 255, 0.22)",
        }}
      />
    );
  }
  return (
    <span
      aria-hidden
      className="absolute inset-x-4 top-3 bottom-0 -z-10 sm:inset-x-6"
    >
      <span
        className="absolute size-7 -translate-x-1/2 translate-y-1/2 rounded-full"
        style={{
          left: `${sun.x * 100}%`,
          bottom: `${sun.y * 100}%`,
          background:
            "radial-gradient(circle, #fffdf8 0%, #fff4dc 45%, #ffe8bd 68%, transparent 71%)",
          boxShadow: "0 0 48px 18px rgba(255, 244, 222, 0.45)",
        }}
      />
    </span>
  );
}

/** A scatter of stars, the same every night. */
function Stars() {
  return (
    <span aria-hidden className="absolute inset-0 -z-10">
      {Array.from({ length: 48 }, (_, i) => {
        const size = i % 7 === 0 ? 2 : i % 3 === 0 ? 1.5 : 1;
        return (
          <span
            key={i}
            className="absolute rounded-full bg-white"
            style={{
              left: `${(i * 37.7) % 100}%`,
              top: `${(i * 61.3) % 100}%`,
              width: size,
              height: size,
              opacity: 0.25 + ((i * 13) % 10) / 20,
            }}
          />
        );
      })}
    </span>
  );
}
