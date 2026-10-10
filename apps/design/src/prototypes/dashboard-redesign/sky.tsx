import type { CSSProperties, ReactNode } from "react";

import { useRouterState } from "@tanstack/react-router";
import { cn } from "@vita-os/ui/lib/utils";
import { MessageSquarePlus, PenLine, Search } from "lucide-react";

import { Account, formatDate, Logo, paletteKey, useNow } from "./board";
import { useShell } from "./shell";

/**
 * The page's header is the sky as it is right now: dawn, day, dusk or night,
 * blended by the hour, with the sun crossing it from sunrise to sunset and a
 * moon and stars after dark. It is ambient: it says what time of day it is
 * and nothing about what is due. Its warm tones stay rose and cream, never the
 * amber that means late.
 *
 * From `lg` the actions sit at its right; below, they move to the bottom bar
 * where a thumb can reach them. `?hour=19.5` previews another hour.
 */
export function SkyHeader({ today }: { today: number }) {
  const hour = useSkyHour();
  const sky = skyAt(hour);
  const { newNote, newThread, openPalette } = useShell();
  const key = paletteKey();

  return (
    <header
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
          <Logo className="ring-1 ring-[color-mix(in_oklab,var(--ink)_25%,transparent)]" />
          <h1 className="flex min-w-0 items-baseline gap-2.5">
            <span className="font-heading text-2xl font-semibold tracking-tight">
              {formatDate(today, { weekday: "long" })}
            </span>
            <span className="truncate text-sm opacity-75">
              {formatDate(today, { month: "long", day: "numeric" })}
            </span>
          </h1>

          <div className="ml-auto flex items-center gap-1.5">
            <div className="hidden items-center gap-1.5 lg:flex">
              <SkyButton
                label={`Search, ${key.label}`}
                onClick={openPalette}
                className="w-52 justify-start px-3"
              >
                <Search className="size-4" />
                <span className="text-sm opacity-80">Search</span>
                <span className="ml-auto text-xs opacity-60">{key.hint}</span>
              </SkyButton>
              <SkyButton label="New note (Q)" onClick={newNote}>
                <PenLine className="size-4" />
              </SkyButton>
              <SkyButton label="New thread" onClick={newThread}>
                <MessageSquarePlus className="size-4" />
              </SkyButton>
            </div>
            <Account />
          </div>
        </div>
        <div className="h-4 lg:h-8" />
      </div>
    </header>
  );
}

/* ------------------------------------------------------------------ time */

const SUNRISE = 6.5;
const SUNSET = 19;

function isDay(hour: number) {
  return hour >= SUNRISE && hour < SUNSET;
}

function useSkyHour() {
  const now = useNow();
  const override = useRouterState({
    select: (state) =>
      Number((state.location.search as Record<string, unknown>).hour),
  });
  return Number.isFinite(override) && override >= 0 && override < 24
    ? override
    : hourOf(now);
}

function hourOf(timestamp: number) {
  const date = new Date(timestamp);
  return date.getHours() + date.getMinutes() / 60;
}

/* ------------------------------------------------------------------- sky */

/**
 * Sky colours through the day: the zenith, then the horizon. Dawn and dusk
 * lean rose and mauve rather than peach, to keep clear of the late amber.
 */
const SKY: [hour: number, top: string, horizon: string][] = [
  [0, "#0c1430", "#1f2a52"],
  [5, "#0c1430", "#1f2a52"],
  [6.5, "#3f4f8c", "#e3a8bb"],
  [9, "#93bbe8", "#ebe3f0"],
  [13, "#6ea6e6", "#dcebf8"],
  [17, "#7f9fd4", "#e6d2e2"],
  [19, "#363a74", "#c27f9f"],
  [21, "#0c1430", "#1f2a52"],
  [24, "#0c1430", "#1f2a52"],
];

function skyAt(hour: number) {
  const index = SKY.findIndex(([h]) => h > hour);
  const [h1, top1, horizon1] = SKY[index - 1]!;
  const [h2, top2, horizon2] = SKY[index]!;
  const t = (hour - h1) / (h2 - h1);
  const top = mix(top1, top2, t);
  return { top, horizon: mix(horizon1, horizon2, t), ink: inkOn(top) };
}

/**
 * The sun crosses the band on a low arc behind everything in it, from the
 * horizon at sunrise, over the middle at noon, to the horizon at sunset. By
 * night a moon hangs on the right instead.
 */
function Sun({ hour }: { hour: number }) {
  if (!isDay(hour)) {
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
  const progress = (hour - SUNRISE) / (SUNSET - SUNRISE);
  // A parabola through both horizons that peaks at the band's top: a point a
  // fraction `p` across stands 4p(1−p) of the way up.
  const lift = 4 * progress * (1 - progress);
  return (
    <span
      aria-hidden
      className="absolute inset-x-4 top-3 bottom-0 -z-10 sm:inset-x-6"
    >
      <span
        className="absolute size-7 -translate-x-1/2 translate-y-1/2 rounded-full"
        style={{
          left: `${progress * 100}%`,
          bottom: `${lift * 100}%`,
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

function SkyButton({
  label,
  onClick,
  className,
  children,
}: {
  label: string;
  onClick: () => void;
  className?: string;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      onClick={onClick}
      className={cn(
        "flex h-9 min-w-9 items-center justify-center gap-2 rounded-full bg-[color-mix(in_oklab,var(--ink)_12%,transparent)] ring-1 ring-[color-mix(in_oklab,var(--ink)_18%,transparent)] backdrop-blur-sm transition-colors outline-none hover:bg-[color-mix(in_oklab,var(--ink)_20%,transparent)] focus-visible:ring-2 focus-visible:ring-[var(--ink)]",
        className,
      )}
    >
      {children}
    </button>
  );
}

function mix(a: string, b: string, t: number) {
  const pa = channels(a);
  const pb = channels(b);
  return `rgb(${pa.map((value, i) => Math.round(value + (pb[i]! - value) * t)).join(" ")})`;
}

function channels(color: string): number[] {
  if (color.startsWith("#")) {
    return [1, 3, 5].map((i) => parseInt(color.slice(i, i + 2), 16));
  }
  return color.match(/\d+/g)!.map(Number);
}

/** Dark ink on a light sky, light ink on a dark one. */
function inkOn(color: string) {
  const [r, g, b] = channels(color).map((value) => {
    const c = value / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  });
  const luminance = 0.2126 * r! + 0.7152 * g! + 0.0722 * b!;
  return luminance > 0.32 ? "#141a2e" : "#f6f7fc";
}
