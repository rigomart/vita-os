import { describe, expect, it } from "vitest";
import { nextOrder, patchById, removeById } from "./optimistic";

type TestRecord = {
  _id: string;
  name: string;
  order: number;
};

function makeRecord(overrides: Partial<TestRecord> = {}): TestRecord {
  return {
    _id: "record1",
    name: "Family Health",
    order: 0,
    ...overrides,
  };
}

describe("optimistic update helpers", () => {
  it("patches an item by id without mutating other items", () => {
    const record = makeRecord();
    const other = makeRecord({ _id: "record2", name: "Career" });

    expect(patchById([record, other], record._id, { name: "Health" })).toEqual([
      { ...record, name: "Health" },
      other,
    ]);
  });

  it("removes an item by id", () => {
    const record = makeRecord();
    const other = makeRecord({ _id: "record2", name: "Career" });

    expect(removeById([record, other], record._id)).toEqual([other]);
  });

  it("computes the next order after the current max", () => {
    expect(nextOrder([{ order: 2 }, { order: 9 }, { order: 4 }])).toBe(10);
  });

  it("starts order at zero for an empty list", () => {
    expect(nextOrder([])).toBe(0);
  });
});
