/**
 * The header's sky, as numbers: its colours at any hour, the ink that reads
 * on them, and where the sun stands. Ambient only: it says what time of day it
 * is and nothing about what is due, so its warm tones stay rose and cream and
 * never reach the amber that means late on the board.
 */

/** The sun rises at 6:30 and sets at 19:00, in local hours. */
export const SUNRISE = 6.5;
export const SUNSET = 19;

/**
 * Sky colours through the day: the zenith, then the horizon. Dawn and dusk
 * lean rose and mauve rather than peach, to keep clear of the late amber.
 */
const SKY: readonly [hour: number, top: string, horizon: string][] = [
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

export const DARK_INK = "#141a2e";
export const LIGHT_INK = "#f6f7fc";

/** The local hour of a timestamp, minutes as a fraction: 19:30 is 19.5. */
export function hourOf(timestamp: number) {
  const date = new Date(timestamp);
  return date.getHours() + date.getMinutes() / 60;
}

export function isDay(hour: number) {
  return hour >= SUNRISE && hour < SUNSET;
}

/** The sky at `hour` (0 ≤ hour < 24), blended between its two keyframes. */
export function skyAt(hour: number) {
  const index = SKY.findIndex(([at]) => at > hour);
  const [fromHour, fromTop, fromHorizon] = SKY[index - 1]!;
  const [toHour, toTop, toHorizon] = SKY[index]!;
  const t = (hour - fromHour) / (toHour - fromHour);
  const top = mix(fromTop, toTop, t);
  return { top, horizon: mix(fromHorizon, toHorizon, t), ink: inkOn(top) };
}

/**
 * Where the sun stands, as fractions of the band: `x` across from sunrise to
 * sunset, `y` up from its foot on a parabola that peaks at noon-ish, where a
 * point a fraction `p` across stands 4p(1−p) of the way up. `undefined` at
 * night, when the moon hangs instead.
 */
export function sunAt(hour: number) {
  if (!isDay(hour)) return undefined;
  const x = (hour - SUNRISE) / (SUNSET - SUNRISE);
  return { x, y: 4 * x * (1 - x) };
}

/** Dark ink on a light sky, light ink on a dark one, by relative luminance. */
export function inkOn(color: string) {
  const [r, g, b] = channels(color).map((value) => {
    const c = value / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  });
  const luminance = 0.2126 * r! + 0.7152 * g! + 0.0722 * b!;
  return luminance > 0.32 ? DARK_INK : LIGHT_INK;
}

/** `a` blended `t` of the way to `b`, as `rgb(r, g, b)`. */
export function mix(a: string, b: string, t: number) {
  const from = channels(a);
  const to = channels(b);
  return `rgb(${from.map((value, i) => Math.round(value + (to[i]! - value) * t)).join(", ")})`;
}

/** The three channels of `#rrggbb` or `rgb(r, g, b)`. */
function channels(color: string): number[] {
  if (color.startsWith("#")) {
    return [1, 3, 5].map((i) => parseInt(color.slice(i, i + 2), 16));
  }
  return (color.match(/\d+/g) ?? []).map(Number);
}
