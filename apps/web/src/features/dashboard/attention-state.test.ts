import { describe, expect, it } from "vitest";

import { groupThreadsByAttentionState } from "./attention-state";

describe("groupThreadsByAttentionState", () => {
  const today = new Date(2026, 4, 20, 12).getTime();
  const yesterday = new Date(2026, 4, 19, 12).getTime();
  const tomorrow = new Date(2026, 4, 21, 12).getTime();

  it("groups open Threads by attention state with Follow-up precedence", () => {
    const groups = groupThreadsByAttentionState({
      currentDate: today,
      threads: [
        {
          id: "resolved",
          lifecycle: "resolved",
          name: "Resolved Thread",
        },
        {
          id: "follow-up-due",
          lifecycle: "open",
          name: "Due Follow-up Thread",
          nextMove: "Call the clinic",
          followUp: yesterday,
        },
        {
          id: "scheduled",
          lifecycle: "open",
          name: "Scheduled Thread",
          nextMove: "Draft the note",
          followUp: tomorrow,
        },
        {
          id: "ready",
          lifecycle: "open",
          name: "Ready Thread",
          nextMove: "Send the form",
        },
        {
          id: "open",
          lifecycle: "open",
          name: "Open Thread",
        },
      ],
    });

    expect(groups).toEqual({
      followUpDue: [
        {
          id: "follow-up-due",
          lifecycle: "open",
          name: "Due Follow-up Thread",
          nextMove: "Call the clinic",
          followUp: yesterday,
        },
      ],
      scheduled: [
        {
          id: "scheduled",
          lifecycle: "open",
          name: "Scheduled Thread",
          nextMove: "Draft the note",
          followUp: tomorrow,
        },
      ],
      ready: [
        {
          id: "ready",
          lifecycle: "open",
          name: "Ready Thread",
          nextMove: "Send the form",
        },
      ],
      open: [
        {
          id: "open",
          lifecycle: "open",
          name: "Open Thread",
        },
      ],
    });
  });
});
