import { describe, expect, it } from "vitest";

import { dateToken, dateToneClassName, dayDelta } from "./dashboard-model";

const today = new Date(2026, 6, 17, 12).getTime();
const at = (offset: number) => new Date(2026, 6, 17 + offset, 9).getTime();

describe("dayDelta", () => {
  it("measures local calendar days in either direction", () => {
    expect(dayDelta(at(-3), today)).toBe(-3);
    expect(dayDelta(at(0), today)).toBe(0);
    expect(dayDelta(at(4), today)).toBe(4);
  });
});

describe("dateToken", () => {
  it("counts days down when a date has passed", () => {
    expect(dateToken(at(-6), today)).toBe("−6d");
    expect(dateToken(at(-1), today)).toBe("−1d");
  });

  it("names today, then weekdays inside the week", () => {
    expect(dateToken(at(0), today)).toBe("Today");
    expect(dateToken(at(1), today)).toBe("Sat");
    expect(dateToken(at(6), today)).toBe("Thu");
  });

  it("counts days out to four weeks, then falls back to a date", () => {
    expect(dateToken(at(7), today)).toBe("7d");
    expect(dateToken(at(27), today)).toBe("27d");
    expect(dateToken(at(28), today)).toBe("Aug 14");
  });
});

describe("dateToneClassName", () => {
  it("keeps overdue in the attention colour and distant dates quiet", () => {
    expect(dateToneClassName(at(-1), today)).toBe("text-condition-attention");
    expect(dateToneClassName(at(0), today)).toBe("text-foreground");
    expect(dateToneClassName(at(3), today)).toBe("text-foreground/60");
    expect(dateToneClassName(at(30), today)).toBe("text-muted-foreground/45");
  });
});
