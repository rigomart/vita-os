import { describe, expect, it } from "vitest";

import {
  type AreaThreadGroup,
  compareAreaThreadGroupsByPriority,
  compareThreadsByStatusUrgency,
  getThreadStatus,
  partitionThreadsByAttention,
  type ThreadStatusInput,
} from "./derived-status";

describe("derived thread status", () => {
  const today = new Date(2026, 4, 20, 12).getTime();
  const yesterday = new Date(2026, 4, 19, 12).getTime();
  const tomorrow = new Date(2026, 4, 21, 12).getTime();

  it("derives status with Follow-up precedence over Next Move", () => {
    expect(
      getThreadStatus(
        { followUp: yesterday, nextMove: "Call the clinic" },
        today,
      ),
    ).toBe("follow_up_due");
    expect(
      getThreadStatus(
        { followUp: tomorrow, nextMove: "Draft the note" },
        today,
      ),
    ).toBe("scheduled");
    expect(getThreadStatus({ nextMove: "Send the form" }, today)).toBe("ready");
    expect(getThreadStatus({}, today)).toBe("open");
  });

  it("compares threads by dashboard urgency and scheduled date", () => {
    const sorted = [
      { id: "open" },
      { id: "scheduled-later", followUp: tomorrow + 86_400_000 },
      { id: "ready", nextMove: "Send the form" },
      { id: "scheduled-sooner", followUp: tomorrow },
      { id: "due", followUp: yesterday },
    ].sort((a, b) => compareThreadsByStatusUrgency(a, b, today));

    expect(sorted.map((thread) => thread.id)).toEqual([
      "due",
      "scheduled-sooner",
      "scheduled-later",
      "ready",
      "open",
    ]);
  });

  it("partitions attention threads from quiet threads", () => {
    const partition = partitionThreadsByAttention(
      [
        { id: "due", followUp: yesterday },
        { id: "scheduled", followUp: tomorrow },
        { id: "ready", nextMove: "Call" },
        { id: "open" },
      ],
      today,
    );

    expect(partition.attention.map((thread) => thread.id)).toEqual([
      "due",
      "ready",
    ]);
    expect(partition.quiet.map((thread) => thread.id)).toEqual([
      "scheduled",
      "open",
    ]);
  });

  it("sorts Areas by due threads, Condition severity, then name", () => {
    const groups: AreaThreadGroup<
      { name: string; condition: "healthy" | "needs_attention" | "critical" },
      ThreadStatusInput
    >[] = [
      {
        area: { name: "Career", condition: "healthy" as const },
        threads: [{}],
      },
      {
        area: { name: "Home", condition: "critical" as const },
        threads: [{}],
      },
      {
        area: { name: "Admin", condition: "healthy" as const },
        threads: [{ followUp: yesterday }],
      },
      {
        area: { name: "Family", condition: "needs_attention" as const },
        threads: [{}],
      },
    ];
    const sorted = groups.sort((a, b) =>
      compareAreaThreadGroupsByPriority(a, b, today),
    );

    expect(sorted.map((group) => group.area.name)).toEqual([
      "Admin",
      "Home",
      "Family",
      "Career",
    ]);
  });
});
