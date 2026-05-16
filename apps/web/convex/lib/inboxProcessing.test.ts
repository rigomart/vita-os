import { describe, expect, it } from "vitest";
import type { Doc, Id } from "../_generated/dataModel";
import {
  buildProjectNoteFromItem,
  getInboxProcessingResultType,
  getItemProcessingDisposition,
  type InboxProcessingAction,
} from "./inboxProcessing";

const areaId = "area1" as Id<"areas">;
const projectId = "project1" as Id<"projects">;

function makeItem(overrides: Partial<Doc<"items">> = {}): Doc<"items"> {
  return {
    _id: "item1" as Id<"items">,
    _creationTime: 0,
    userId: "user1",
    text: "Call clinic",
    isCompleted: false,
    createdAt: 0,
    ...overrides,
  };
}

describe("getItemProcessingDisposition", () => {
  it.each<InboxProcessingAction>([
    {
      type: "create_project",
      name: "Book health check",
      areaId,
    },
    { type: "add_to_project", projectId },
    { type: "set_next_action", projectId },
    { type: "discard" },
  ])("deletes the Item after %s processing", (action) => {
    expect(getItemProcessingDisposition(action)).toBe("delete_item");
  });
});

describe("getInboxProcessingResultType", () => {
  it.each<[InboxProcessingAction, string]>([
    [{ type: "create_project", name: "Book health check", areaId }, "created"],
    [{ type: "add_to_project", projectId }, "added"],
    [{ type: "set_next_action", projectId }, "set_next_action"],
    [{ type: "discard" }, "discarded"],
  ])("maps processing action %# to its mutation result", (action, result) => {
    expect(getInboxProcessingResultType(action)).toBe(result);
  });
});

describe("buildProjectNoteFromItem", () => {
  it("copies Item text into a Project log note", () => {
    expect(buildProjectNoteFromItem(makeItem())).toEqual({
      type: "note",
      content: "Call clinic",
    });
  });
});
