import { describe, expect, it } from "vitest";
import type { Doc, Id } from "../_generated/dataModel";
import {
  buildCompleteNextActionChange,
  buildPrependNextActionChange,
  buildProjectPatchLogEntries,
} from "./projectChanges";

function makeProject(
  overrides: Partial<Doc<"projects">> = {},
): Doc<"projects"> {
  return {
    _id: "project1" as Id<"projects">,
    _creationTime: 0,
    userId: "user1",
    name: "Project",
    slug: "project-00000000",
    areaId: "area1" as Id<"areas">,
    order: 0,
    state: "active",
    createdAt: 0,
    ...overrides,
  };
}

describe("buildProjectPatchLogEntries", () => {
  it("records status changes", () => {
    const logs = buildProjectPatchLogEntries(
      makeProject({ status: "Blocked" }),
      { status: "Moving again" },
    );

    expect(logs).toEqual([
      {
        type: "status_change",
        content: 'Status changed from "Blocked" to "Moving again"',
        previousValue: "Blocked",
        newValue: "Moving again",
      },
    ]);
  });

  it("records status clearing", () => {
    const logs = buildProjectPatchLogEntries(
      makeProject({ status: "Blocked" }),
      { status: undefined },
    );

    expect(logs).toEqual([
      {
        type: "status_change",
        content: 'Status changed from "Blocked" to "(cleared)"',
        previousValue: "Blocked",
        newValue: undefined,
      },
    ]);
  });

  it("records next action changes", () => {
    const logs = buildProjectPatchLogEntries(
      makeProject({ actionQueue: [{ id: "a1", text: "Call clinic" }] }),
      { actionQueue: [{ id: "a2", text: "Book appointment" }] },
    );

    expect(logs).toEqual([
      {
        type: "next_action_change",
        content: 'Next action changed from "Call clinic" to "Book appointment"',
        previousValue: "Call clinic",
        newValue: "Book appointment",
      },
    ]);
  });

  it("does not log action queue reorders when the next action stays the same", () => {
    const logs = buildProjectPatchLogEntries(
      makeProject({
        actionQueue: [
          { id: "a1", text: "Call clinic" },
          { id: "a2", text: "Book appointment" },
        ],
      }),
      {
        actionQueue: [
          { id: "a1", text: "Call clinic" },
          { id: "a3", text: "Find documents" },
        ],
      },
    );

    expect(logs).toEqual([]);
  });

  it("records state changes", () => {
    const logs = buildProjectPatchLogEntries(makeProject(), {
      state: "completed",
    });

    expect(logs).toEqual([
      {
        type: "state_change",
        content: 'State changed from "active" to "completed"',
        previousValue: "active",
        newValue: "completed",
      },
    ]);
  });
});

describe("buildCompleteNextActionChange", () => {
  it("records the new next action after completing the head of the queue", () => {
    const change = buildCompleteNextActionChange([
      { id: "a1", text: "Call clinic" },
      { id: "a2", text: "Book appointment" },
    ]);

    expect(change).toEqual({
      remaining: [{ id: "a2", text: "Book appointment" }],
      log: {
        type: "next_action_change",
        content:
          'Completed "Call clinic" — next action is now "Book appointment"',
        previousValue: "Call clinic",
        newValue: "Book appointment",
      },
    });
  });

  it("records when no actions remain", () => {
    const change = buildCompleteNextActionChange([
      { id: "a1", text: "Call clinic" },
    ]);

    expect(change).toEqual({
      remaining: [],
      log: {
        type: "next_action_change",
        content: 'Completed "Call clinic" — no more actions queued',
        previousValue: "Call clinic",
        newValue: undefined,
      },
    });
  });

  it("does nothing for an empty queue", () => {
    expect(buildCompleteNextActionChange([])).toBeNull();
  });
});

describe("buildPrependNextActionChange", () => {
  it("records the new head of the action queue", () => {
    const change = buildPrependNextActionChange(
      [{ id: "a1", text: "Call clinic" }],
      "Book appointment",
      "a2",
    );

    expect(change).toEqual({
      actionQueue: [
        { id: "a2", text: "Book appointment" },
        { id: "a1", text: "Call clinic" },
      ],
      log: {
        type: "next_action_change",
        content: 'Next action changed from "Call clinic" to "Book appointment"',
        previousValue: "Call clinic",
        newValue: "Book appointment",
      },
    });
  });
});
