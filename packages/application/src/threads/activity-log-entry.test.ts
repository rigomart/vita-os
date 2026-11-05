import type {
  ActivityLogEntry,
  ActivityLogEntryId,
  ActivityLogEntryType,
  ThreadNote,
  ThreadNoteId,
} from "@vita-os/contracts";

import { NOTE_STARTED_THREAD } from "@vita-os/core";
import { describe, expect, it } from "vitest";

import {
  type ActivityLogGroup,
  foldActivityLogDay,
  readActivityLog,
  readActivityLogEntry,
  readActivityLogLine,
} from "./activity-log-entry";

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

    it("reads a Note line as the Note itself, which it opens", () => {
      const reading = readActivityLogEntry(added, note);
      expect(reading).toMatchObject({
        label: "Note",
        action: "Note added",
        threadNote: note,
      });
      expect(reading).not.toHaveProperty("subject");
    });

    it("reads a deleted Note's line as since deleted, with nothing to open", () => {
      const reading = readActivityLogEntry(added);
      expect(reading).toMatchObject({
        label: "Note",
        action: "Note added, since deleted",
      });
      expect(reading).not.toHaveProperty("subject");
      expect(reading).not.toHaveProperty("threadNote");
    });

    it("carries the Note written with a completion, and says when it was deleted", () => {
      const completed = {
        ...entry("move_completed", 'Completed "Send the form"', {
          previousValue: "Send the form",
        }),
        threadNoteId: note._id,
      };
      const withNote = readActivityLogEntry(completed, note);
      expect(withNote).toMatchObject({
        action: "Completed",
        subject: "Send the form",
        threadNote: note,
      });
      expect(withNote).not.toHaveProperty("aside");
      expect(readActivityLogEntry(completed)).toMatchObject({
        action: "Completed",
        subject: "Send the form",
        aside: ", with a note since deleted",
      });
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

describe("readActivityLog", () => {
  const day = (date: number, hour = 20) =>
    new Date(2026, 9, date, hour).getTime();
  const completed = (
    id: string,
    at: number,
    text = "Evening check",
    threadNoteId?: string,
  ): ActivityLogEntry => ({
    _id: id as ActivityLogEntryId,
    type: "move_completed",
    content: `Completed "${text}"`,
    previousValue: text,
    ...(threadNoteId === undefined
      ? {}
      : { threadNoteId: threadNoteId as ThreadNoteId }),
    createdAt: at,
  });
  const logged = (
    id: string,
    type: ActivityLogEntryType,
    at: number,
  ): ActivityLogEntry => ({
    _id: id as ActivityLogEntryId,
    type,
    content: "",
    createdAt: at,
  });
  const lineKeysByGroup = (groups: ActivityLogGroup[]) =>
    groups.map((group) =>
      group.lines.map((line) =>
        line.kind === "started"
          ? "started"
          : line.logs.map((log) => log._id).join("+"),
      ),
    );
  const read = (groups: ActivityLogGroup[]) =>
    groups.flatMap((group) =>
      group.lines.map((line) => {
        const { action, subject, times } = readActivityLogLine(line);
        return [action, subject, times && `${times} times`]
          .filter(Boolean)
          .join(" ");
      }),
    );

  it("folds a stretch of one Task's completions into one line under its first and last days", () => {
    const fortnight = Array.from({ length: 14 }, (_, index) =>
      completed(`c${14 - index}`, day(31 - index)),
    );
    const groups = readActivityLog(fortnight);

    expect(read(groups)).toEqual(["Completed Evening check 14 times"]);
    expect(groups).toMatchObject([{ from: day(18), to: day(31) }]);
  });

  it("starts a new stretch after any other line, and lets a completion with a Note stand alone", () => {
    const groups = readActivityLog([
      completed("c5", day(31)),
      completed("c4", day(30)),
      completed("noted", day(29), "Evening check", "note-1"),
      completed("c3", day(28)),
      completed("c2", day(27)),
      logged("added", "task_added", day(26, 21)),
      completed("c1", day(26)),
      completed("other", day(25), "Morning walk"),
    ]);

    expect(lineKeysByGroup(groups)).toEqual([
      ["c5+c4"],
      ["noted"],
      ["c3+c2"],
      ["added", "c1"],
      ["other"],
    ]);
    expect(groups[0]).toMatchObject({ from: day(30), to: day(31) });
  });

  it("keeps a stretch within one day under that day's heading, among its other lines", () => {
    expect(
      lineKeysByGroup(
        readActivityLog([
          logged("area", "area_move", day(31, 22)),
          completed("c2", day(31, 21)),
          completed("c1", day(31, 20)),
        ]),
      ),
    ).toEqual([["area", "c2+c1"]]);
  });

  it("folds pages together, so a stretch cut by a page boundary grows into one line", () => {
    const all = Array.from({ length: 30 }, (_, index) =>
      completed(`c${30 - index}`, day(31, 20) - index * 86_400_000),
    );
    const firstPage = readActivityLog(all.slice(0, 20));
    const bothPages = readActivityLog(all);

    expect(read(firstPage)).toEqual(["Completed Evening check 20 times"]);
    expect(read(bothPages)).toEqual(["Completed Evening check 30 times"]);
    expect(
      bothPages[0]!.key,
      "the line updates in place as the page arrives",
    ).toBe(firstPage[0]!.key);
  });

  it("ends the log with Started at the Thread's creation, below entries written at that instant", () => {
    const createdAt = day(1, 9);
    const groups = readActivityLog(
      [
        logged("added", "task_added", createdAt),
        logged("area", "area_move", day(2)),
      ],
      createdAt,
    );

    expect(lineKeysByGroup(groups)).toEqual([["area"], ["added", "started"]]);
    expect(read(groups).at(-1)).toBe("Started");
  });

  it("folds the entry of the Note the Thread was started from into Started", () => {
    const createdAt = day(1, 9);
    const note = (content: string): ActivityLogEntry => ({
      ...logged("note", "note_added", createdAt),
      content,
    });
    const origin = note(NOTE_STARTED_THREAD);
    const groups = readActivityLog([origin], createdAt);

    expect(lineKeysByGroup(groups)).toEqual([["started"]]);
    expect(groups[0]!.lines[0]).toEqual({
      kind: "started",
      at: createdAt,
      origin,
    });
    expect(read(groups)).toEqual(["Started from a note, since deleted"]);
    expect(
      lineKeysByGroup(readActivityLog([note("Note added")], createdAt)),
      "a Note captured in the Thread's first millisecond did not start it",
    ).toEqual([["note", "started"]]);
  });

  it("reads Started as a turning point, from the Note it began with while it exists", () => {
    const createdAt = day(1, 9);
    const threadNote: ThreadNote = {
      _id: "origin-note" as ThreadNoteId,
      body: "Letter from the office",
      createdAt,
      updatedAt: createdAt,
    };
    const origin: ActivityLogEntry = {
      ...logged("note", "note_added", createdAt),
      content: NOTE_STARTED_THREAD,
      threadNoteId: threadNote._id,
    };
    const [started] = readActivityLog([origin], createdAt)[0]!.lines;

    expect(readActivityLogLine(started!, threadNote)).toMatchObject({
      action: "Started the Thread from this note",
      threadNote,
      turningPoint: true,
    });
    expect(
      readActivityLogLine({ kind: "started", at: createdAt }),
    ).toMatchObject({ action: "Started", turningPoint: true });
  });

  it("gives a stretch over midnight a heading of its own", () => {
    const groups = readActivityLog([
      completed("c2", day(31, 0) + 5 * 60_000),
      completed("c1", day(30, 23)),
    ]);
    expect(groups).toMatchObject([{ from: day(30, 23) }]);
    expect(read(groups)).toEqual(["Completed Evening check 2 times"]);
  });

  it("splits a stretch where the Task's text changed", () => {
    expect(
      lineKeysByGroup(
        readActivityLog([
          completed("c3", day(31), "Evening drops"),
          completed("c2", day(30), "Evening check"),
          completed("c1", day(29), "Evening check"),
        ]),
      ),
    ).toEqual([["c3"], ["c2+c1"]]);
  });

  it("leaves a backfilled Note written before the Thread began below Started", () => {
    expect(
      lineKeysByGroup(
        readActivityLog([logged("note", "note_added", day(1, 8))], day(2, 9)),
      ),
    ).toEqual([["started"], ["note"]]);
  });

  it("reads no beginning while older pages remain", () => {
    expect(lineKeysByGroup(readActivityLog([completed("c1", day(2))]))).toEqual(
      [["c1"]],
    );
    expect(readActivityLog([])).toEqual([]);
  });
});
