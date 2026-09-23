import { act, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { nextLocalMidnight, useAttentionClock } from "./use-attention-clock";

const HOUR = 3_600_000;
const DAY = 86_400_000;

const noon = new Date(2026, 6, 17, 12, 30).getTime();
const nextMidnight = new Date(2026, 6, 18).getTime();

describe("useAttentionClock", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(noon);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("holds one timestamp still for the whole local day", () => {
    const { result, unmount } = renderHook(() => useAttentionClock());
    expect(result.current).toBe(noon);

    act(() => vi.advanceTimersByTime(11 * HOUR));
    expect(result.current).toBe(noon);

    unmount();
  });

  it("steps to the new day at local midnight, without remounting", () => {
    const { result, unmount } = renderHook(() => useAttentionClock());

    act(() => vi.advanceTimersByTime(nextMidnight - noon - 1));
    expect(result.current).toBe(noon);

    act(() => vi.advanceTimersByTime(1));
    expect(result.current).toBe(nextMidnight);

    unmount();
  });

  it("reschedules itself for every following midnight", () => {
    const { result, unmount } = renderHook(() => useAttentionClock());

    act(() => vi.advanceTimersByTime(nextMidnight - noon));
    act(() => vi.advanceTimersByTime(DAY));
    expect(result.current).toBe(new Date(2026, 6, 19).getTime());

    act(() => vi.advanceTimersByTime(DAY));
    expect(result.current).toBe(new Date(2026, 6, 20).getTime());

    unmount();
  });

  it("hands every consumer the same instant from a single timer", () => {
    const first = renderHook(() => useAttentionClock());
    const second = renderHook(() => useAttentionClock());

    expect(second.result.current).toBe(first.result.current);
    expect(vi.getTimerCount()).toBe(1);

    act(() => vi.advanceTimersByTime(nextMidnight - noon));
    expect(first.result.current).toBe(nextMidnight);
    expect(second.result.current).toBe(nextMidnight);

    first.unmount();
    second.unmount();
  });

  it("clears the rollover timer once the last consumer unmounts", () => {
    const first = renderHook(() => useAttentionClock());
    const second = renderHook(() => useAttentionClock());

    first.unmount();
    expect(vi.getTimerCount()).toBe(1);

    second.unmount();
    expect(vi.getTimerCount()).toBe(0);
  });

  it("picks the clock back up on the day it is remounted", () => {
    const first = renderHook(() => useAttentionClock());
    first.unmount();

    vi.setSystemTime(noon + 3 * DAY);
    const second = renderHook(() => useAttentionClock());
    expect(second.result.current).toBe(noon + 3 * DAY);

    second.unmount();
  });
});

describe("nextLocalMidnight", () => {
  it("targets the start of the next local calendar day", () => {
    const cases = [
      new Date(2026, 6, 17, 0, 0, 0, 0),
      new Date(2026, 6, 17, 12, 30),
      new Date(2026, 6, 17, 23, 59, 59, 999),
      new Date(2026, 11, 31, 18, 0),
    ];

    for (const at of cases) {
      const next = new Date(nextLocalMidnight(at.getTime()));

      expect(next.getHours()).toBe(0);
      expect(next.getMinutes()).toBe(0);
      expect(next.getSeconds()).toBe(0);
      expect(next.getMilliseconds()).toBe(0);
      expect(next.getTime()).toBeGreaterThan(at.getTime());
      expect(next.getTime() - at.getTime()).toBeLessThanOrEqual(DAY);
      expect(next.toDateString()).toBe(
        new Date(
          at.getFullYear(),
          at.getMonth(),
          at.getDate() + 1,
        ).toDateString(),
      );
    }
  });

  it("crosses local midnight, not UTC midnight", () => {
    const tz = process.env.TZ;
    // UTC+9: 23:30 local on the 17th is still 14:30 UTC on the same UTC day,
    // so a UTC-based clock would roll over nine hours late.
    process.env.TZ = "Asia/Tokyo";

    const late = new Date(2026, 6, 17, 23, 30).getTime();
    const next = nextLocalMidnight(late);

    expect(next - late).toBe(30 * 60_000);
    expect(new Date(next).getHours()).toBe(0);
    expect(new Date(next).getUTCHours()).toBe(15);

    process.env.TZ = tz;
  });

  it("crosses local midnight west of UTC too", () => {
    const tz = process.env.TZ;
    // UTC-10: 00:30 local on the 17th is already 10:30 UTC, so a UTC-based
    // clock would have rolled over half an hour ago.
    process.env.TZ = "Pacific/Honolulu";

    const early = new Date(2026, 6, 17, 0, 30).getTime();
    const next = nextLocalMidnight(early);

    expect(next - early).toBe(DAY - 30 * 60_000);
    expect(new Date(next).getHours()).toBe(0);

    process.env.TZ = tz;
  });
});
