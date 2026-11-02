import type {
  ActivityLogEntry,
  ActivityLogEntryId,
  ThreadNote,
  ThreadNoteId,
} from "@vita-os/contracts";

import userEvent from "@testing-library/user-event";
import { subDays } from "date-fns";
import { describe, expect, it, vi } from "vitest";

import { render, screen } from "../../test/render-with-providers";
import { ActivityLog } from "./thread-log";

const now = new Date("2026-05-19T12:00:00Z").getTime();

const areaMove = {
  _id: "log1" as ActivityLogEntryId,
  type: "area_move",
  content: 'Moved from "Health" to "Finances"',
  previousValue: "Health",
  newValue: "Finances",
  createdAt: now,
} satisfies ActivityLogEntry;

const followUp = {
  _id: "log2" as ActivityLogEntryId,
  type: "follow_up_change",
  content: "Follow-up set",
  newValue: "May 20, 2026",
  createdAt: now - 60_000,
} satisfies ActivityLogEntry;

const resolution = {
  _id: "log3" as ActivityLogEntryId,
  type: "state_change",
  content:
    'Resolved thread: Deposit is back in full. — discarded tasks: "Cancel the broadband", "Redirect post"',
  previousValue: "open",
  newValue: "resolved",
  createdAt: now - 120_000,
} satisfies ActivityLogEntry;

/** The sentence an entry reads as, however its parts are styled. */
function sentence(text: string) {
  return screen.getByText(
    (_, element) =>
      element?.tagName === "P" && element.textContent?.endsWith(text) === true,
  );
}

describe("ActivityLog", () => {
  it("reads each automatic change as a sentence and offers no manual entry controls", () => {
    render(<ActivityLog logs={[areaMove, followUp]} />);

    expect(screen.getByLabelText("Activity log")).toBeVisible();
    expect(sentence("Moved to Finances, from Health")).toHaveTextContent(
      "Area: Moved to Finances, from Health",
    );
    expect(sentence("Set the Follow-up for May 20, 2026")).toBeVisible();
    expect(screen.queryByRole("textbox")).toBeNull();
    expect(screen.queryByRole("button", { name: "Add note" })).toBeNull();
  });

  it("shows what a resolution carried: its note and the Tasks it dropped", () => {
    render(<ActivityLog logs={[resolution]} />);

    expect(sentence("Resolved the Thread")).toBeVisible();
    expect(screen.getByText("Deposit is back in full.")).toBeVisible();
    expect(screen.getByText("Dropped 2 open Tasks")).toBeVisible();
    expect(screen.getByText("Cancel the broadband")).toBeVisible();
    expect(screen.getByText("Redirect post")).toBeVisible();
  });

  it("writes a recorded Follow-up in the reader's time zone, time and all", () => {
    const may20 = new Date(2026, 4, 20).getTime();
    const jun1At3 = new Date(2026, 5, 1, 15).getTime();

    render(
      <ActivityLog
        logs={[
          {
            ...followUp,
            content: "Follow-up changed",
            previousValue: String(may20),
            newValue: String(jun1At3),
          },
        ]}
      />,
    );

    expect(
      sentence("Moved the Follow-up to Jun 1, 2026 · 3 PM, from May 20, 2026"),
    ).toBeVisible();
  });

  it("groups automatic changes by day", () => {
    const currentTime = Date.now();
    const yesterday = subDays(new Date(currentTime), 1).getTime();

    render(
      <ActivityLog
        logs={[
          { ...areaMove, createdAt: currentTime },
          { ...followUp, createdAt: yesterday },
        ]}
      />,
    );

    expect(screen.getByRole("heading", { name: "Today" })).toBeInTheDocument();
    expect(
      screen.getByRole("heading", { name: "Yesterday" }),
    ).toBeInTheDocument();
  });

  it("uses a read-only continuity empty state", () => {
    render(<ActivityLog logs={[]} />);

    expect(
      screen.getByText(
        "Automatic Thread changes will appear here as they happen.",
      ),
    ).toBeInTheDocument();
  });

  it("loads earlier automatic changes on request", async () => {
    const user = userEvent.setup();
    const onLoadMore = vi.fn();
    render(
      <ActivityLog logs={[areaMove]} canLoadMore onLoadMore={onLoadMore} />,
    );

    await user.click(screen.getByRole("button", { name: "Show earlier" }));
    expect(onLoadMore).toHaveBeenCalledTimes(1);
  });

  describe("a Note's line", () => {
    const note: ThreadNote = {
      _id: "note1" as ThreadNoteId,
      body: "Called the office twice\nThey need it signed",
      createdAt: now,
      updatedAt: now,
    };
    const noteAdded = {
      _id: "log4" as ActivityLogEntryId,
      type: "note_added",
      content: "Note added",
      threadNoteId: note._id,
      createdAt: now,
    } satisfies ActivityLogEntry;

    it("reads the Note's first line and opens the Note", async () => {
      const user = userEvent.setup();
      const onOpenNote = vi.fn();
      render(
        <ActivityLog
          logs={[noteAdded]}
          threadNotes={[note]}
          onOpenNote={onOpenNote}
        />,
      );

      await user.click(
        screen.getByRole("button", {
          // jsdom drops the space after the screen-reader label.
          name: /^Note: ?Note added: Called the office twice$/,
        }),
      );
      expect(onOpenNote).toHaveBeenCalledWith(note);
    });

    it("stays once the Note is deleted, without words or anything to open", () => {
      render(
        <ActivityLog
          logs={[noteAdded]}
          threadNotes={[]}
          onOpenNote={vi.fn()}
        />,
      );

      expect(sentence("Note added")).toHaveTextContent("Note: Note added");
      expect(screen.queryByRole("button")).toBeNull();
    });

    it("is part of the completion it was written with", () => {
      render(
        <ActivityLog
          logs={[
            {
              _id: "log5" as ActivityLogEntryId,
              type: "move_completed",
              content: 'Completed "Send the form"',
              previousValue: "Send the form",
              threadNoteId: note._id,
              createdAt: now,
            },
          ]}
          threadNotes={[note]}
          onOpenNote={vi.fn()}
        />,
      );

      expect(screen.getAllByRole("listitem")).toHaveLength(1);
      expect(
        screen.getByRole("button", {
          name: /^Task done: ?Completed Send the form$/,
        }),
      ).toBeVisible();
      expect(screen.getByText("Called the office twice")).toBeVisible();
    });
  });
  describe("the plan changing", () => {
    const at = (day: number, hour: number) =>
      new Date(2026, 4, day, hour).getTime();
    const added = (id: string, text: string, createdAt: number) =>
      ({
        _id: id as ActivityLogEntryId,
        type: "task_added",
        content: `Added "${text}"`,
        newValue: text,
        createdAt,
      }) satisfies ActivityLogEntry;

    it("folds the Tasks added on one day into one line, in the order they were added", () => {
      render(
        <ActivityLog
          logs={[
            added("a3", "Book a slot", at(19, 11)),
            {
              _id: "r1" as ActivityLogEntryId,
              type: "task_removed",
              content: 'Removed "Wait for the letter"',
              previousValue: "Wait for the letter",
              createdAt: at(19, 10),
            },
            added("a2", "Ask about the deadline", at(19, 9)),
            added("a1", "Send the form", at(19, 8)),
            added("a0", "Call the office", at(18, 8)),
          ]}
        />,
      );

      expect(
        screen.getAllByRole("listitem").map((item) => item.textContent),
      ).toEqual([
        expect.stringMatching(
          /^Tasks added: ?Added 3 Tasks: Send the form · Ask about the deadline · Book a slot11:00 AM$/,
        ),
        expect.stringMatching(
          /^Task removed: ?Removed Wait for the letter10:00 AM$/,
        ),
        expect.stringMatching(/^Task added: ?Added Call the office8:00 AM$/),
      ]);
    });
  });
});
