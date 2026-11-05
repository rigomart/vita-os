import type {
  ActivityLogEntry,
  ActivityLogEntryId,
  ThreadNote,
  ThreadNoteId,
} from "@vita-os/contracts";

import userEvent from "@testing-library/user-event";
import { NOTE_STARTED_THREAD } from "@vita-os/core";
import { subDays } from "date-fns";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { clock } from "../../lib/clock";
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
      body: "Called the office twice\n\nThey need it **signed**",
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
    const completedWithNote = {
      _id: "log5" as ActivityLogEntryId,
      type: "move_completed",
      content: 'Completed "Send the form"',
      previousValue: "Send the form",
      threadNoteId: note._id,
      createdAt: now,
    } satisfies ActivityLogEntry;

    it("reads the Note itself, up to four lines, and opens it", async () => {
      const user = userEvent.setup();
      const onOpenNote = vi.fn();
      render(
        <ActivityLog
          logs={[noteAdded]}
          threadNotes={[note]}
          onOpenNote={onOpenNote}
        />,
      );

      const words = screen.getByText(
        "Called the office twice\nThey need it signed",
        { normalizer: (text) => text },
      );
      expect(words).toHaveClass("line-clamp-4", "text-sm");
      expect(screen.queryByText(/Note added/)).toBeNull();
      await user.click(
        screen.getByRole("button", { name: /^Open note: Called the office/ }),
      );
      expect(onOpenNote).toHaveBeenCalledWith(note);
    });

    it("reads as since deleted once the Note is deleted, opening nothing", () => {
      render(
        <ActivityLog
          logs={[noteAdded]}
          threadNotes={[]}
          onOpenNote={vi.fn()}
        />,
      );

      expect(sentence("Note added, since deleted")).toHaveTextContent(
        "Note: Note added, since deleted",
      );
      expect(screen.queryByRole("button")).toBeNull();
    });

    it("leads a completion written with it, under a caption of the completion", async () => {
      const user = userEvent.setup();
      const onOpenNote = vi.fn();
      render(
        <ActivityLog
          logs={[completedWithNote]}
          threadNotes={[note]}
          onOpenNote={onOpenNote}
        />,
      );

      expect(
        screen.getAllByRole("listitem").map((item) => item.textContent),
      ).toEqual([
        expect.stringMatching(
          /^Task done: ?Completed Send the form\d+:\d\d [AP]MCalled the office twice\nThey need it signed$/,
        ),
      ]);
      await user.click(
        screen.getByRole("button", { name: /^Open note: Called the office/ }),
      );
      expect(onOpenNote).toHaveBeenCalledWith(note);
    });

    it("leaves a completion that says its Note was deleted", () => {
      render(
        <ActivityLog
          logs={[completedWithNote]}
          threadNotes={[]}
          onOpenNote={vi.fn()}
        />,
      );

      expect(
        sentence("Completed Send the form, with a note since deleted"),
      ).toBeVisible();
      expect(screen.queryByRole("button")).toBeNull();
    });

    it("begins the log as the Note the Thread was started from, with Started merged into it", async () => {
      const user = userEvent.setup();
      const onOpenNote = vi.fn();
      render(
        <ActivityLog
          logs={[{ ...noteAdded, content: NOTE_STARTED_THREAD }]}
          threadNotes={[note]}
          startedAt={now}
          onOpenNote={onOpenNote}
        />,
      );

      expect(
        screen.getAllByRole("listitem").map((item) => item.textContent),
      ).toEqual([
        expect.stringMatching(
          /^Started: ?Started the Thread from this note\d+:\d\d [AP]MCalled the office twice\nThey need it signed$/,
        ),
      ]);
      await user.click(
        screen.getByRole("button", { name: /^Open note: Called the office/ }),
      );
      expect(onOpenNote).toHaveBeenCalledWith(note);
    });

    it("reads Started from a note since deleted, once that Note is gone", () => {
      render(
        <ActivityLog
          logs={[{ ...noteAdded, content: NOTE_STARTED_THREAD }]}
          threadNotes={[]}
          startedAt={now}
        />,
      );

      expect(
        screen.getAllByRole("listitem").map((item) => item.textContent),
      ).toEqual([
        expect.stringMatching(
          /^Started: ?Started from a note, since deleted\d+:\d\d [AP]M$/,
        ),
      ]);
    });

    it("says a Note backfilled from before the Thread began was written before it, below Started", () => {
      const startedAt = new Date(2026, 4, 19, 9).getTime();
      render(
        <ActivityLog
          logs={[{ ...noteAdded, createdAt: startedAt - 86_400_000 }]}
          threadNotes={[note]}
          startedAt={startedAt}
        />,
      );

      expect(
        screen.getAllByRole("listitem").map((item) => item.textContent),
      ).toEqual([
        expect.stringMatching(/^Started: ?Started9:00 AM$/),
        expect.stringMatching(
          /^Written before the Thread started\d+:\d\d [AP]MCalled the office twice/,
        ),
      ]);
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
  describe("a beginning, and rhythms that fold", () => {
    const at = (day: number, hour = 20) =>
      new Date(2026, 4, day, hour).getTime();
    const completed = (id: string, createdAt: number, threadNoteId?: string) =>
      ({
        _id: id as ActivityLogEntryId,
        type: "move_completed",
        content: 'Completed "Evening check"',
        previousValue: "Evening check",
        ...(threadNoteId === undefined
          ? {}
          : { threadNoteId: threadNoteId as ThreadNoteId }),
        createdAt,
      }) satisfies ActivityLogEntry;
    const noted = {
      _id: "vet-note" as ThreadNoteId,
      body: "Vet said halve the dose",
      createdAt: at(11),
      updatedAt: at(11),
    } satisfies ThreadNote;

    it("reads a rhythm as stretches around a completion with a Note, and ends with Started", () => {
      render(
        <ActivityLog
          logs={[
            ...[18, 17, 16, 15, 14, 13, 12].map((day) =>
              completed(`late-${day}`, at(day)),
            ),
            completed("noted", at(11), noted._id),
            ...[10, 9, 8, 7, 6, 5, 4].map((day) =>
              completed(`early-${day}`, at(day)),
            ),
          ]}
          threadNotes={[noted]}
          startedAt={at(4, 9)}
        />,
      );

      expect(
        screen.getAllByRole("heading", { level: 3 }).map((h) => h.textContent),
      ).toEqual([
        "May 12 – May 18",
        "Monday, May 11",
        "May 4 – May 10",
        "Monday, May 4",
      ]);
      expect(
        screen.getAllByRole("listitem").map((item) => item.textContent),
      ).toEqual([
        "Task done: Completed Evening check 7 timesEvery day around 8:00 PM",
        expect.stringMatching(
          /^Task done: ?Completed Evening check8:00 PMVet said halve the dose$/,
        ),
        "Task done: Completed Evening check 7 timesEvery day around 8:00 PM",
        expect.stringMatching(/^Started: ?Started9:00 AM$/),
      ]);
    });

    it("opens a stretch to its days by month, a day with none dashed among them", async () => {
      const user = userEvent.setup();
      render(
        <ActivityLog
          logs={[29, 28, 27, 25, 24].map((day) =>
            completed(`c${day}`, at(day)),
          )}
        />,
      );

      const fold = screen.getByRole("button", {
        // jsdom drops the spaces around inline elements in a name.
        name: (name) =>
          name.replaceAll(" ", "") === "Taskdone:CompletedEveningcheck5times",
      });
      expect(
        screen.getByText("Every day around 8:00 PM · none on Tue, May 26"),
      ).toBeVisible();
      expect(fold).toHaveAttribute("aria-expanded", "false");
      expect(screen.queryByText("May")).toBeNull();

      await user.click(fold);
      expect(fold).toHaveAttribute("aria-expanded", "true");
      const days = document.getElementById(fold.getAttribute("aria-controls")!);
      expect(days).toHaveTextContent(
        "May24 at 8:00 PM25 at 8:00 PM26, none27 at 8:00 PM28 at 8:00 PM29 at 8:00 PM",
      );
      expect(
        [...days!.querySelectorAll("time")].map((day) =>
          day.className.includes("border-dashed"),
        ),
      ).toEqual([false, false, true, false, false, false]);

      fold.focus();
      await user.keyboard("{Enter}");
      expect(fold).toHaveAttribute("aria-expanded", "false");
      expect(days).not.toBeInTheDocument();
    });
  });

  describe("Tasks added on one day", () => {
    const added = (id: string, text: string, createdAt: number) =>
      ({
        _id: id as ActivityLogEntryId,
        type: "task_added",
        content: `Added "${text}"`,
        newValue: text,
        createdAt,
      }) satisfies ActivityLogEntry;

    it("opens to each Task, with no time of its own when they share a minute", async () => {
      const user = userEvent.setup();
      const minute = new Date(2026, 4, 19, 11, 30).getTime();
      render(
        <ActivityLog
          logs={[
            added("a3", "Book a slot", minute + 20_000),
            added("a2", "Ask about the deadline", minute + 10_000),
            added("a1", "Send the form", minute),
          ]}
        />,
      );

      const fold = screen.getByRole("button", { name: /Added 3 Tasks:/ });
      await user.click(fold);

      expect(fold).toHaveAccessibleName(/^Tasks added: ?Added 3 Tasks$/);
      const list = document.getElementById(fold.getAttribute("aria-controls")!);
      expect(
        [...list!.querySelectorAll("li")].map((item) => item.textContent),
      ).toEqual(["–Send the form", "–Ask about the deadline", "–Book a slot"]);
    });

    it("gives each Task its time when they were added at different minutes", async () => {
      const user = userEvent.setup();
      render(
        <ActivityLog
          logs={[
            added(
              "a2",
              "Ask about the deadline",
              new Date(2026, 4, 19, 11).getTime(),
            ),
            added("a1", "Send the form", new Date(2026, 4, 19, 9).getTime()),
          ]}
        />,
      );

      const fold = screen.getByRole("button", { name: /Added 2 Tasks:/ });
      await user.click(fold);

      const list = document.getElementById(fold.getAttribute("aria-controls")!);
      expect(
        [...list!.querySelectorAll("li")].map((item) => item.textContent),
      ).toEqual(["–Send the form9:00 AM", "–Ask about the deadline11:00 AM"]);
    });
  });

  describe("quiet", () => {
    const today = new Date(2026, 10, 4, 12).getTime();
    const note = (id: string, createdAt: number) =>
      ({
        _id: id as ActivityLogEntryId,
        type: "area_move",
        content: "Moved",
        previousValue: "Home",
        newValue: "Money",
        createdAt,
      }) satisfies ActivityLogEntry;
    const logs = [
      note("sep18", new Date(2026, 8, 18, 9).getTime()),
      note("aug29", new Date(2026, 7, 29, 9).getTime()),
      note("jun1", new Date(2026, 5, 1, 9).getTime()),
      note("2025", new Date(2025, 10, 20, 9).getTime()),
    ];

    beforeEach(() => clock.set(today));
    afterEach(() => clock.set(undefined));

    it("reads three weeks or more between days as quiet, and the time since on an Open Thread", () => {
      render(<ActivityLog logs={logs} />);

      const section = screen.getByLabelText("Activity log");
      expect(
        [...section.querySelectorAll("h3, p.italic")].map(
          (line) => line.textContent,
        ),
      ).toEqual([
        "Quiet for 7 weeks",
        "Friday, September 18",
        "Saturday, August 29",
        "3 months quiet",
        "Monday, June 1",
        "6 months quiet",
        "Thursday, November 20, 2025",
      ]);
    });

    it("tells no quiet since a Resolved Thread's ending", () => {
      render(<ActivityLog logs={logs} resolved />);

      expect(screen.queryByText(/^Quiet for/)).toBeNull();
      expect(screen.getByText("3 months quiet")).toBeVisible();
    });
  });

  describe("weights", () => {
    it("reads turning points at full size and every other change small", () => {
      render(
        <ActivityLog
          logs={[
            areaMove,
            resolution,
            {
              _id: "r" as ActivityLogEntryId,
              type: "task_removed",
              content: 'Removed "Wait"',
              previousValue: "Wait",
              createdAt: now - 180_000,
            },
          ]}
          startedAt={now - 240_000}
        />,
      );

      const size = (text: string) =>
        sentence(text).classList.contains("text-sm") ? "full" : "small";
      expect(size("Moved to Finances, from Health")).toBe("full");
      expect(size("Resolved the Thread")).toBe("full");
      expect(size("Removed Wait")).toBe("small");
      expect(size("Started")).toBe("full");
      expect(screen.getByText("Deposit is back in full.")).toHaveClass(
        "text-sm",
        "border-l-2",
      );
    });
  });
});
