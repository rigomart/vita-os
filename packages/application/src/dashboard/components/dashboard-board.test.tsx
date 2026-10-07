import type {
  Note,
  NoteId,
  OperationResult,
  TaskId,
  Thread,
} from "@vita-os/contracts";

import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import {
  createQuietApplicationClient,
  deferred,
  success,
} from "../../test/fake-application-client";
import {
  act,
  render,
  screen,
  waitFor,
  within,
} from "../../test/render-with-providers";
import { buildAttentionBoard } from "./attention-board-model";
import { DashboardBoard } from "./dashboard-board";

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
  await user.click(
    screen.getByRole("button", { name: new RegExp(`${month} ${day}`, "i") }),
  );
}

async function pickJuly(user: ReturnType<typeof userEvent.setup>, day: number) {
  await user.click(
    screen.getByRole("button", { name: new RegExp(`July ${day}`, "i") }),
  );
}

describe("DashboardBoard card date control", () => {
  it("sets the date of the Task the card shows", async () => {
    const user = userEvent.setup();
    const task = { _id: "task1" as TaskId, text: "Book the scan" };
    const thread = aThread({ tasks: [task] });
    const setTaskDate = vi.fn(async () => success(thread));
    render(
      <DashboardBoard
        areas={[]}
        board={buildAttentionBoard([thread], [], currentDate)}
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
      <DashboardBoard
        areas={[]}
        board={buildAttentionBoard([thread], [], currentDate)}
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
      <DashboardBoard
        areas={[]}
        board={buildAttentionBoard([thread], [], currentDate)}
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

describe("DashboardBoard repeating Task card", () => {
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
      <DashboardBoard
        areas={[]}
        board={buildAttentionBoard([thread], [], currentDate)}
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
      <DashboardBoard
        areas={[]}
        board={buildAttentionBoard([thread], [], currentDate)}
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
        <DashboardBoard
          areas={[]}
          board={buildAttentionBoard([thread], [], currentDate)}
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
      <DashboardBoard
        areas={[]}
        board={buildAttentionBoard([thread], [], currentDate)}
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

describe("DashboardBoard Note view", () => {
  it("keeps the Note view open when archiving removes its board card", async () => {
    const user = userEvent.setup();
    const markNoteDone = vi.fn(async () => {
      rerender(
        <DashboardBoard
          areas={[]}
          board={buildAttentionBoard([], [], currentDate)}
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
      <DashboardBoard
        areas={[]}
        board={buildAttentionBoard([], [saved], currentDate)}
        currentDate={currentDate}
      />,
      { applicationClient },
    );
    await user.click(
      screen.getByRole("button", { name: /Open note: Consultation/ }),
    );
    expect(screen.getByRole("link", { name: "Clinic" })).toBeVisible();
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

  it("keeps the Note view open when a Follow-up date moves its card to another lane", async () => {
    const user = userEvent.setup();
    const nextDate = new Date(2026, 6, 18).getTime();
    const datedNote = {
      ...saved,
      followUp: new Date(2026, 6, 17).getTime(),
    };
    const updateNoteFollowUp = vi.fn(async () => {
      const updated = { ...saved, followUp: nextDate };
      rerender(
        <DashboardBoard
          areas={[]}
          board={buildAttentionBoard([], [updated], currentDate)}
          currentDate={currentDate}
        />,
      );
      return success(updated);
    });
    const applicationClient = createQuietApplicationClient({
      updateNoteFollowUp,
    });
    const { rerender } = render(
      <DashboardBoard
        areas={[]}
        board={buildAttentionBoard([], [datedNote], currentDate)}
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
    await user.click(screen.getByRole("button", { name: /July 18/i }));
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
    });
  });
});
