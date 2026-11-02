import type {
  ActivityLogEntry,
  ActivityLogEntryId,
  ActivityLogEntryType,
  ThreadNote,
  ThreadNoteId,
} from "@vita-os/contracts";

import { describe, expect, it } from "vitest";

import { foldActivityLogDay, readActivityLogEntry } from "./activity-log-entry";

function entry(
  type: ActivityLogEntryType,
  content: string,
  values: { previousValue?: string; newValue?: string } = {},
): ActivityLogEntry {
  return {
    _id: "log" as ActivityLogEntryId,
    type,
    content,
    ...values,
    createdAt: 0,
  };
}

function read(...args: Parameters<typeof entry>) {
  const { label, action, subject, from, note, dropped } = readActivityLogEntry(
    entry(...args),
  );
  return { label, action, subject, from, note, dropped };
}

describe("readActivityLogEntry", () => {
  it("reads a completed Task with its full text", () => {
    expect(
      read("move_completed", 'Completed "Call the clinic"', {
        previousValue: "Call the clinic",
      }),
    ).toMatchObject({
      label: "Task done",
      action: "Completed",
      subject: "Call the clinic",
    });
  });

  it("reads a Task added and a Task removed by its full text", () => {
    expect(
      read("task_added", 'Added "Send the form"', {
        newValue: "Send the form",
      }),
    ).toMatchObject({
      label: "Task added",
      action: "Added",
      subject: "Send the form",
    });
    expect(
      read("task_removed", 'Removed "Book a slot"', {
        previousValue: "Book a slot",
      }),
    ).toMatchObject({
      label: "Task removed",
      action: "Removed",
      subject: "Book a slot",
    });
  });

  it("reads every Area change as what the Thread was moved to", () => {
    expect(
      read("area_move", "", { previousValue: "Home", newValue: "Work" }),
    ).toMatchObject({ action: "Moved to", subject: "Work", from: "Home" });
    expect(read("area_move", "", { newValue: "Work" })).toMatchObject({
      action: "Added to",
      subject: "Work",
    });
    expect(read("area_move", "", { previousValue: "Home" })).toMatchObject({
      action: "Removed from",
      subject: "Home",
    });
  });

  it("reads a resolution's note and the Tasks it dropped out of its content", () => {
    const values = { previousValue: "open", newValue: "resolved" };

    expect(
      read(
        "state_change",
        'Resolved thread: Done at the garage. — discarded tasks: "Book a slot", "Pay"',
        values,
      ),
    ).toMatchObject({
      label: "Resolved",
      action: "Resolved the Thread",
      note: "Done at the garage.",
      dropped: ["Book a slot", "Pay"],
    });
    expect(
      read("state_change", 'Resolved thread — discarded tasks: "Pay"', values),
    ).toMatchObject({ note: undefined, dropped: ["Pay"] });
    expect(read("state_change", "Resolved thread", values)).toMatchObject({
      note: undefined,
      dropped: [],
    });
  });

  it("reads a reopening", () => {
    expect(
      read("state_change", "Reopened thread", {
        previousValue: "resolved",
        newValue: "open",
      }),
    ).toMatchObject({ label: "Reopened", action: "Reopened the Thread" });
  });

  it("keeps the label and wording of entries written under a former name", () => {
    expect(
      read("next_move_change", 'Completed "Ring Sam"', {
        previousValue: "Ring Sam",
      }),
    ).toMatchObject({
      label: "Next move",
      action: "Completed",
      subject: "Ring Sam",
    });
    expect(
      read("follow_up_change", "Follow-up cleared", {
        previousValue: "May 20, 2026",
      }),
    ).toMatchObject({
      label: "Follow-up date",
      action: "Cleared the Follow-up",
      subject: "May 20, 2026",
    });
  });

  describe("an entry naming a Thread Note", () => {
    const note: ThreadNote = {
      _id: "note" as ThreadNoteId,
      body: "## Called the office\nThey need the form **signed**",
      createdAt: 0,
      updatedAt: 0,
    };
    const added = {
      ...entry("note_added", "Note added"),
      threadNoteId: note._id,
    };

    it("reads a Note line with the Note's first line as it reads now, opening it", () => {
      expect(readActivityLogEntry(added, note)).toMatchObject({
        label: "Note",
        action: "Note added:",
        subject: "Called the office",
        threadNote: note,
      });
    });

    it("reads a deleted Note's line without words and with nothing to open", () => {
      const reading = readActivityLogEntry(added);
      expect(reading).toMatchObject({ label: "Note", action: "Note added" });
      expect(reading).not.toHaveProperty("subject");
      expect(reading).not.toHaveProperty("threadNote");
    });

    it("carries the Note written with a completion on the completion's line", () => {
      const completed = {
        ...entry("move_completed", 'Completed "Send the form"', {
          previousValue: "Send the form",
        }),
        threadNoteId: note._id,
      };
      expect(readActivityLogEntry(completed, note)).toMatchObject({
        action: "Completed",
        subject: "Send the form",
        note: "Called the office",
        threadNote: note,
      });
      expect(readActivityLogEntry(completed)).not.toHaveProperty("note");
    });
  });
});

describe("foldActivityLogDay", () => {
  const at = (id: string, type: ActivityLogEntryType) => ({
    ...entry(type, ""),
    _id: id as ActivityLogEntryId,
  });

  it("puts the day's Tasks added on one line where the newest sits, and every other entry on its own", () => {
    const [added3, removed, added2, completed, added1] = [
      at("a3", "task_added"),
      at("r", "task_removed"),
      at("a2", "task_added"),
      at("c", "move_completed"),
      at("a1", "task_added"),
    ];
    expect(
      foldActivityLogDay([added3, removed, added2, completed, added1]),
    ).toEqual([[added3, added2, added1], [removed], [completed]]);
  });
});
