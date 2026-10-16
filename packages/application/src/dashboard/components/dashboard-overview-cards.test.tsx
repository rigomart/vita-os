import type {
  Note,
  NoteId,
  OperationResult,
  TaskId,
  Thread,
} from "@vita-os/contracts";

import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { queryKeys } from "../../query-keys";
import {
  createQuietApplicationClient,
  deferred,
  success,
} from "../../test/fake-application-client";
import { findNoteEditor } from "../../test/note-editor";
import {
  act,
  createTestQueryClient,
  render,
  screen,
  waitFor,
  within,
} from "../../test/render-with-providers";
import { pickCalendarDay } from "../../test/when-picker";
import { useOpenThreads } from "../../threads/hooks";
import { DashboardOverview } from "./dashboard-overview";

const currentDate = new Date(2026, 6, 17, 12).getTime();
const saved: Note = {
  _id: "note1" as NoteId,
  body: "# Consultation\n[Clinic](https://example.com)",
  state: "open",
  createdAt: currentDate,
};

function aThread(fields: Partial<Thread>): Thread {
  return {
    _id: "thread1" as Thread["_id"],
    title: "Checkup",
    slug: "checkup",
    order: 0,
    state: "open",

    createdAt: currentDate,
    ...fields,
  } as Thread;
}

/** An empty picker opens on the real current month. */
function dayOfThisMonth(day: number) {
  const now = new Date();
  return new Date(now.getFullYear(), now.getMonth(), day).getTime();
}

async function pickThisMonth(
  user: ReturnType<typeof userEvent.setup>,
  day: number,
) {
  const month = new Date().toLocaleString("en-US", { month: "long" });
  await pickCalendarDay(user, new RegExp(`${month} ${day}`, "i"));
}

async function pickJuly(user: ReturnType<typeof userEvent.setup>, day: number) {
  await pickCalendarDay(user, new RegExp(`July ${day}`, "i"));
}

describe("a Dashboard card date control", () => {
  it("sets the date of the Task the card shows", async () => {
    const user = userEvent.setup();
    const task = { _id: "task1" as TaskId, text: "Book the scan" };
    const thread = aThread({ tasks: [task] });
    const setTaskDate = vi.fn(async () => success(thread));
    render(
      <DashboardOverview
        areas={[]}
        threads={[thread]}
        notes={[]}
        currentDate={currentDate}
      />,
      { applicationClient: createQuietApplicationClient({ setTaskDate }) },
    );

    await user.click(screen.getByRole("button", { name: "Set date" }));
    await pickThisMonth(user, 28);

    await waitFor(() =>
      expect(setTaskDate).toHaveBeenCalledExactlyOnceWith({
        threadId: "thread1",
        taskId: "task1",
        date: dayOfThisMonth(28),
        timeZone: expect.any(String),
      }),
    );
  });

  it("closes the card's picker on a time, as on a day", async () => {
    const user = userEvent.setup();
    const task = {
      _id: "task1" as TaskId,
      text: "Book the scan",
      date: new Date(2026, 6, 20).getTime(),
    };
    const thread = aThread({ tasks: [task] });
    const setTaskDate = vi.fn(async () => success(thread));
    render(
      <DashboardOverview
        areas={[]}
        threads={[thread]}
        notes={[]}
        currentDate={currentDate}
      />,
      { applicationClient: createQuietApplicationClient({ setTaskDate }) },
    );

    await user.click(screen.getByRole("button", { name: "Change date" }));
    await user.click(await screen.findByRole("button", { name: "9 AM" }));

    await waitFor(() =>
      expect(setTaskDate).toHaveBeenCalledExactlyOnceWith({
        threadId: "thread1",
        taskId: "task1",
        date: new Date(2026, 6, 20, 9).getTime(),
        timeZone: expect.any(String),
      }),
    );
    await waitFor(() =>
      expect(screen.queryByRole("button", { name: "Pick a date…" })).toBeNull(),
    );
  });

  it("reschedules from the dated Task's own token", async () => {
    const user = userEvent.setup();
    const task = {
      _id: "task1" as TaskId,
      text: "Book the scan",
      date: new Date(2026, 6, 20).getTime(),
    };
    const thread = aThread({ tasks: [task] });
    const setTaskDate = vi.fn(async () => success(thread));
    render(
      <DashboardOverview
        areas={[]}
        threads={[thread]}
        notes={[]}
        currentDate={currentDate}
      />,
      { applicationClient: createQuietApplicationClient({ setTaskDate }) },
    );

    await user.click(screen.getByRole("button", { name: "Change date" }));
    await pickJuly(user, 22);

    await waitFor(() =>
      expect(setTaskDate).toHaveBeenCalledExactlyOnceWith({
        threadId: "thread1",
        taskId: "task1",
        date: new Date(2026, 6, 22).getTime(),
        timeZone: expect.any(String),
      }),
    );
  });

  it("adds a Task named Follow up when the card shows no single Task", async () => {
    const user = userEvent.setup();
    const tasks = [
      { _id: "a" as TaskId, text: "A" },
      { _id: "b" as TaskId, text: "B" },
    ];
    const thread = aThread({ tasks });
    const addTask = vi.fn(async () => success(thread));
    render(
      <DashboardOverview
        areas={[]}
        threads={[thread]}
        notes={[]}
        currentDate={currentDate}
      />,
      { applicationClient: createQuietApplicationClient({ addTask }) },
    );

    await user.click(screen.getByRole("button", { name: "Set date" }));
    await pickThisMonth(user, 28);

    await waitFor(() => expect(addTask).toHaveBeenCalledTimes(1));
    expect(addTask).toHaveBeenCalledWith({
      threadId: "thread1",
      taskId: expect.any(String),
      text: "Follow up",
      date: dayOfThisMonth(28),
    });
  });
});

describe("a Dashboard repeating Task card", () => {
  const checkIn = {
    _id: "check-in" as TaskId,
    text: "Evening check-in",
    // Two evenings ago: a missed run.
    date: new Date(2026, 6, 15, 21).getTime(),
    repeat: { kind: "days" as const, every: 1 },
  };

  it("shows one Late card with the repeat glyph, and skips from the card in the browser's zone", async () => {
    const user = userEvent.setup();
    const thread = aThread({ tasks: [checkIn] });
    const skipTask = vi.fn(async () => success(thread));
    render(
      <DashboardOverview
        areas={[]}
        threads={[thread]}
        notes={[]}
        currentDate={currentDate}
      />,
      { applicationClient: createQuietApplicationClient({ skipTask }) },
    );

    const late = screen.getByRole("region", { name: "Late" });
    expect(within(late).getAllByText("Evening check-in")).toHaveLength(1);
    expect(
      within(late).getByText(/repeats daily/i, { selector: ".sr-only" }),
    ).toBeInTheDocument();
    expect(
      late.querySelector('[data-slot="repeat-glyph"]'),
    ).toBeInTheDocument();

    await user.click(
      screen.getByRole("button", {
        name: "Skip “Evening check-in” to its next date",
      }),
    );
    await waitFor(() =>
      expect(skipTask).toHaveBeenCalledExactlyOnceWith({
        threadId: "thread1",
        taskId: "check-in",
        timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone,
        expectedOccurrence: checkIn.date,
      }),
    );
  });

  // The note on completing is offered in Thread detail only (ADR 0032).
  it("completes in one click with no note, and offers no note path", async () => {
    const user = userEvent.setup();
    const thread = aThread({ tasks: [checkIn] });
    const completeTask = vi.fn(async () => success(thread));
    render(
      <DashboardOverview
        areas={[]}
        threads={[thread]}
        notes={[]}
        currentDate={currentDate}
      />,
      { applicationClient: createQuietApplicationClient({ completeTask }) },
    );

    expect(screen.queryByRole("button", { name: /with a note/i })).toBeNull();
    await user.click(
      screen.getByRole("button", { name: "Complete “Evening check-in”" }),
    );
    await waitFor(() =>
      expect(completeTask).toHaveBeenCalledExactlyOnceWith({
        threadId: "thread1",
        taskId: "check-in",
        timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone,
        expectedOccurrence: checkIn.date,
      }),
    );
    expect(screen.queryByRole("textbox")).toBeNull();
  });

  it.each(["complete", "skip"] as const)(
    "disables the pending %s card control and accepts a double click once",
    async (command) => {
      const user = userEvent.setup();
      const thread = aThread({ tasks: [checkIn] });
      const answer = deferred<OperationResult<Thread>>();
      const send = vi.fn(() => answer.promise);
      render(
        <DashboardOverview
          areas={[]}
          threads={[thread]}
          notes={[]}
          currentDate={currentDate}
        />,
        {
          applicationClient: createQuietApplicationClient(
            command === "complete"
              ? { completeTask: send }
              : { skipTask: send },
          ),
        },
      );
      const button = screen.getByRole("button", {
        name:
          command === "complete"
            ? "Complete “Evening check-in”"
            : "Skip “Evening check-in” to its next date",
      });
      await user.dblClick(button);
      await waitFor(() => expect(button).toBeDisabled());
      expect(send).toHaveBeenCalledTimes(1);
      expect(send).toHaveBeenCalledWith(
        expect.objectContaining({ expectedOccurrence: checkIn.date }),
      );
      await act(async () => answer.resolve(success(thread)));
      await waitFor(() => expect(button).toBeEnabled());
    },
  );

  it("offers no skip and no glyph on a one-off Task", () => {
    const { repeat: _repeat, ...oneOff } = checkIn;
    const thread = aThread({ tasks: [oneOff] });
    render(
      <DashboardOverview
        areas={[]}
        threads={[thread]}
        notes={[]}
        currentDate={currentDate}
      />,
      { applicationClient: createQuietApplicationClient() },
    );

    expect(
      screen.getByRole("button", { name: "Complete “Evening check-in”" }),
    ).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /^Skip/ })).toBeNull();
    expect(document.querySelector('[data-slot="repeat-glyph"]')).toBeNull();
  });
});

describe("copies of one Thread", () => {
  /** The board as the Dashboard draws it, from the cached open Threads. */
  function Board() {
    const threads = useOpenThreads().data ?? [];
    return (
      <DashboardOverview
        areas={[]}
        threads={threads}
        notes={[]}
        currentDate={currentDate}
      />
    );
  }

  it("completes only the copy's own Task: that copy leaves, the others stay and stay usable", async () => {
    const user = userEvent.setup();
    const pickup = {
      _id: "pickup" as TaskId,
      text: "Pickup",
      date: new Date(2026, 6, 18).getTime(),
    };
    const call = {
      _id: "call" as TaskId,
      text: "Call the school",
      date: new Date(2026, 6, 21).getTime(),
    };
    const thread = aThread({ tasks: [pickup, call] });
    const answer = deferred<OperationResult<Thread>>();
    const completeTask = vi.fn(() => answer.promise);
    const queryClient = createTestQueryClient();
    queryClient.setQueryData(queryKeys.threads.open(), [thread]);
    render(<Board />, {
      queryClient,
      applicationClient: createQuietApplicationClient({
        completeTask,
        listOpenThreads: async () => success([{ ...thread, tasks: [call] }]),
      }),
    });

    expect(screen.getAllByRole("link", { name: "Checkup" })).toHaveLength(2);
    await user.click(screen.getByRole("button", { name: "Complete “Pickup”" }));

    await waitFor(() =>
      expect(screen.queryByText("Pickup")).not.toBeInTheDocument(),
    );
    expect(completeTask).toHaveBeenCalledExactlyOnceWith(
      expect.objectContaining({ taskId: "pickup" }),
    );
    const tuesday = screen.getByRole("region", { name: "Tuesday" });
    expect(
      within(tuesday).getByRole("button", {
        name: "Complete “Call the school”",
      }),
    ).toBeEnabled();
    expect(screen.getAllByRole("link", { name: "Checkup" })).toHaveLength(1);

    await act(async () =>
      answer.resolve(success({ ...thread, tasks: [call] })),
    );
    expect(within(tuesday).getByText("Call the school")).toBeVisible();
  });
});

describe("a Dashboard Note view", () => {
  it("keeps the Note view open when archiving removes its board card", async () => {
    const user = userEvent.setup();
    const markNoteDone = vi.fn(async () => {
      rerender(
        <DashboardOverview
          areas={[]}
          threads={[]}
          notes={[]}
          currentDate={currentDate}
        />,
      );
      return success<Note>({
        ...saved,
        state: "done",
        completedAt: currentDate,
      });
    });
    const applicationClient = createQuietApplicationClient({ markNoteDone });
    const { rerender } = render(
      <DashboardOverview
        areas={[]}
        threads={[]}
        notes={[saved]}
        currentDate={currentDate}
      />,
      { applicationClient },
    );
    await user.click(
      screen.getByRole("button", { name: /Open note: Consultation/ }),
    );
    expect(await findNoteEditor()).toHaveTextContent("Clinic");
    await user.click(
      within(screen.getByRole("dialog")).getByRole("button", {
        name: "Archive",
      }),
    );
    await waitFor(() =>
      expect(screen.getByRole("button", { name: "Unarchive" })).toBeVisible(),
    );
    expect(screen.getByRole("dialog")).toBeVisible();
    expect(markNoteDone).toHaveBeenCalledExactlyOnceWith({ noteId: "note1" });
  });

  it("keeps the Note view open when a Follow-up date moves its card to another day", async () => {
    const user = userEvent.setup();
    const nextDate = new Date(2026, 6, 18).getTime();
    const datedNote = {
      ...saved,
      followUp: new Date(2026, 6, 17).getTime(),
    };
    const updateNoteFollowUp = vi.fn(async () => {
      const updated = { ...saved, followUp: nextDate };
      rerender(
        <DashboardOverview
          areas={[]}
          threads={[]}
          notes={[updated]}
          currentDate={currentDate}
        />,
      );
      return success(updated);
    });
    const applicationClient = createQuietApplicationClient({
      updateNoteFollowUp,
    });
    const { rerender } = render(
      <DashboardOverview
        areas={[]}
        threads={[]}
        notes={[datedNote]}
        currentDate={currentDate}
      />,
      { applicationClient },
    );
    await user.click(
      screen.getByRole("button", { name: /Open note: Consultation/ }),
    );
    await user.click(
      within(screen.getByRole("dialog")).getByRole("button", {
        name: "Change follow-up date",
      }),
    );
    await pickCalendarDay(user, /July 18/i);
    await waitFor(() =>
      expect(
        within(screen.getByRole("dialog")).getByRole("button", {
          name: "Change follow-up date",
        }),
      ).toBeVisible(),
    );
    expect(screen.getByRole("dialog")).toBeVisible();
    expect(updateNoteFollowUp).toHaveBeenCalledExactlyOnceWith({
      noteId: "note1",
      followUp: nextDate,
      timeZone: expect.any(String),
    });
  });

  it("completes a repeating Note from its view, which stays open beside Archive", async () => {
    const user = userEvent.setup();
    const occurrence = new Date(2026, 6, 17).getTime();
    const next = new Date(2026, 7, 17).getTime();
    const repeating: Note = {
      ...saved,
      followUp: occurrence,
      repeat: { kind: "monthly", day: 17 },
    };
    const completeNote = vi.fn(async () =>
      success({ ...repeating, followUp: next }),
    );
    render(
      <DashboardOverview
        areas={[]}
        threads={[]}
        notes={[repeating]}
        currentDate={currentDate}
      />,
      { applicationClient: createQuietApplicationClient({ completeNote }) },
    );
    await user.click(
      screen.getByRole("button", { name: /Open note: Consultation/ }),
    );
    const view = within(screen.getByRole("dialog"));
    expect(view.getByRole("button", { name: "Archive" })).toBeVisible();
    await user.click(view.getByRole("button", { name: /^Complete · back / }));

    await waitFor(() =>
      expect(
        view.getByRole("button", { name: "Change follow-up date" }),
      ).toHaveTextContent("Aug 17"),
    );
    expect(screen.getByRole("dialog")).toBeVisible();
    expect(completeNote).toHaveBeenCalledExactlyOnceWith({
      noteId: "note1",
      expectedOccurrence: occurrence,
      timeZone: expect.any(String),
    });
  });

  it("shows a Note completed elsewhere as it now is, and completes that one next", async () => {
    const user = userEvent.setup();
    const shown = new Date(2026, 6, 17).getTime();
    const current = new Date(2026, 7, 17).getTime();
    const repeat = { kind: "monthly", day: 17 } as const;
    const stale: Note = { ...saved, followUp: shown, repeat };
    const moved: Note = { ...stale, followUp: current };
    const completeNote = vi
      .fn<() => Promise<OperationResult<Note>>>()
      .mockResolvedValueOnce({
        ok: false,
        error: { code: "conflict", message: "Moved.", retryable: false },
      })
      .mockResolvedValueOnce(
        success({ ...moved, followUp: new Date(2026, 8, 17).getTime() }),
      );
    const { feedback } = render(
      <DashboardOverview
        areas={[]}
        threads={[]}
        notes={[stale]}
        currentDate={currentDate}
      />,
      {
        applicationClient: createQuietApplicationClient({
          completeNote,
          listOpenNotes: async () => success([moved]),
        }),
      },
    );
    await user.click(
      screen.getByRole("button", { name: /Open note: Consultation/ }),
    );
    const view = within(screen.getByRole("dialog"));
    await user.click(view.getByRole("button", { name: /^Complete · back / }));

    await waitFor(() =>
      expect(feedback.error).toHaveBeenCalledWith(
        "This note changed elsewhere. It has been refreshed.",
      ),
    );
    expect(
      view.getByRole("button", { name: "Change follow-up date" }),
    ).toHaveTextContent("Aug 17");

    await user.click(view.getByRole("button", { name: /^Complete · back / }));
    await waitFor(() => expect(completeNote).toHaveBeenCalledTimes(2));
    expect(completeNote).toHaveBeenLastCalledWith({
      noteId: "note1",
      expectedOccurrence: current,
      timeZone: expect.any(String),
    });
  });

  it("says a Note whose Repeat was removed elsewhere no longer repeats", async () => {
    const user = userEvent.setup();
    const followUp = new Date(2026, 6, 17).getTime();
    const repeating: Note = {
      ...saved,
      followUp,
      repeat: { kind: "monthly", day: 17 },
    };
    const { feedback } = render(
      <DashboardOverview
        areas={[]}
        threads={[]}
        notes={[repeating]}
        currentDate={currentDate}
      />,
      {
        applicationClient: createQuietApplicationClient({
          completeNote: async () => ({
            ok: false,
            error: {
              code: "validation",
              message: "Only a repeating Note can be completed",
              retryable: false,
            },
          }),
          listOpenNotes: async () => success([{ ...saved, followUp }]),
        }),
      },
    );
    await user.click(
      screen.getByRole("button", { name: /Open note: Consultation/ }),
    );
    const view = within(screen.getByRole("dialog"));
    await user.click(view.getByRole("button", { name: /^Complete · back / }));

    await waitFor(() =>
      expect(feedback.error).toHaveBeenCalledWith(
        "This note no longer repeats.",
      ),
    );
    expect(view.queryByRole("button", { name: /^Complete/ })).toBeNull();
    expect(view.getByRole("button", { name: "Archive" })).toBeVisible();
  });
});
