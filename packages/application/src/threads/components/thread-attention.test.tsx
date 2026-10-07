import type { Task, TaskId } from "@vita-os/contracts";

import userEvent from "@testing-library/user-event";
import { addDays, subDays } from "date-fns";
import { useState } from "react";
import { describe, expect, it, vi } from "vitest";

import { deferred } from "../../test/fake-application-client";
import { act, render, screen, within } from "../../test/render-with-providers";
import { ThreadAttention } from "./thread-attention";

const now = new Date("2026-08-13T12:00:00").getTime();
/** Today as the picker stores a date alone: local midnight. */
const today = new Date(2026, 7, 13).getTime();

const callClinic: Task = { _id: "task-1" as TaskId, text: "Call the clinic" };
const bookScan: Task = { _id: "task-2" as TaskId, text: "Book the scan" };
const collect: Task = { _id: "task-3" as TaskId, text: "Collect the results" };

function renderAttention(
  props: Partial<Parameters<typeof ThreadAttention>[0]> = {},
) {
  const handlers = {
    onAddTask: vi.fn(),
    onEditTask: vi.fn(),
    onRemoveTask: vi.fn(),
    onCompleteTask: vi.fn(),
    onFocusTask: vi.fn(),
    onSetTaskDate: vi.fn(),
    onSetTaskRepeat: vi.fn(),
    onSkipTask: vi.fn(),
  };

  const onCompleteTaskWithNote = vi.fn<
    (taskId: TaskId, body: string) => unknown
  >(async () => "completed");

  const { unmount, rerender, feedback } = render(
    <ThreadAttention
      tasks={[]}
      now={now}
      {...handlers}
      onCompleteTaskWithNote={onCompleteTaskWithNote}
      {...props}
    />,
  );

  return {
    ...handlers,
    onCompleteTaskWithNote,
    feedback,
    unmount,
    /** Renders again with the same handlers and these props. */
    show: (next: Partial<Parameters<typeof ThreadAttention>[0]>) =>
      rerender(
        <ThreadAttention
          tasks={[]}
          now={now}
          {...handlers}
          onCompleteTaskWithNote={onCompleteTaskWithNote}
          {...props}
          {...next}
        />,
      ),
  };
}

function taskRows() {
  return within(screen.getByRole("list", { name: "Tasks" })).getAllByRole(
    "listitem",
  );
}

describe("ThreadAttention dated Tasks", () => {
  const afternoon: Task = {
    ...bookScan,
    date: new Date(2026, 7, 20, 15).getTime(),
  };
  const dateOnly: Task = {
    ...collect,
    date: new Date(2026, 7, 20).getTime(),
  };
  const sooner: Task = { ...callClinic, date: new Date(2026, 7, 14).getTime() };
  const loose: Task = { _id: "task-4" as TaskId, text: "Think about it" };

  it("lists dated Tasks soonest first, then a No date divider, then undated Tasks in capture order", () => {
    renderAttention({ tasks: [loose, afternoon, sooner, dateOnly] });

    const rows = taskRows();
    expect(rows.map((row) => row.textContent)).toEqual([
      expect.stringContaining("Call the clinic"),
      expect.stringContaining("Collect the results"),
      expect.stringContaining("Book the scan"),
      expect.stringContaining("Think about it"),
    ]);
    const divider = screen.getByText("No date");
    expect(screen.getAllByText("No date")).toHaveLength(1);
    expect(
      rows[2]!.compareDocumentPosition(divider) &
        Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();
    expect(
      divider.compareDocumentPosition(rows[3]!) &
        Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();
  });

  it("shows the divider only when both groups exist", () => {
    const { unmount } = renderAttention({ tasks: [sooner, afternoon] });
    expect(screen.queryByText("No date")).toBeNull();
    unmount();

    renderAttention({ tasks: [loose, { ...loose, _id: "task-5" as TaskId }] });
    expect(screen.queryByText("No date")).toBeNull();
  });

  it("shows each dated row's date and time, and an undated row only a Set date button", () => {
    renderAttention({ tasks: [afternoon, loose] });

    expect(
      within(taskRows()[0]!).getByRole("button", {
        name: "Change date: Aug 20 · 3 PM",
      }),
    ).toBeVisible();
    expect(
      within(taskRows().at(-1)!).getByRole("button", { name: "Set date" }),
    ).toBeInTheDocument();
  });

  it("sets a Task's date from its row without touching the others", async () => {
    const user = userEvent.setup();
    const { onSetTaskDate } = renderAttention({
      tasks: [loose, afternoon],
    });

    await user.click(
      within(taskRows().at(-1)!).getByRole("button", { name: "Set date" }),
    );
    // The picker keeps its explanation.
    expect(
      screen.getByText("Bring this back into view around this date."),
    ).toBeVisible();
    // An empty picker opens on the real current month.
    const month = new Date().toLocaleString("en-US", { month: "long" });
    await user.click(
      screen.getByRole("button", { name: new RegExp(`${month} 28`) }),
    );

    const real = new Date();
    expect(onSetTaskDate).toHaveBeenCalledExactlyOnceWith(
      loose._id,
      new Date(real.getFullYear(), real.getMonth(), 28).getTime(),
    );
  });

  it("clears a Task's date with Clear date", async () => {
    const user = userEvent.setup();
    const { onSetTaskDate } = renderAttention({ tasks: [afternoon] });

    await user.click(
      within(taskRows()[0]!).getByRole("button", { name: /^Change date/ }),
    );
    await user.click(screen.getByRole("button", { name: "Clear date" }));

    expect(onSetTaskDate).toHaveBeenCalledExactlyOnceWith(afternoon._id, null);
  });

  it("lets a dated Task be the Focused Task", () => {
    renderAttention({
      tasks: [afternoon, loose],
      focusedTaskId: afternoon._id,
    });

    expect(taskRows()[0]).toHaveAttribute("data-focused", "true");
  });
});

describe("ThreadAttention", () => {
  it("lists every Task in capture order, highlighting the Focused Task where it sits", () => {
    renderAttention({
      tasks: [callClinic, bookScan, collect],
      focusedTaskId: bookScan._id,
    });

    const rows = taskRows();
    expect(rows.map((row) => row.textContent)).toEqual([
      expect.stringContaining("Call the clinic"),
      expect.stringContaining("Book the scan"),
      expect.stringContaining("Collect the results"),
    ]);
    expect(rows[1]).toHaveAttribute("data-focused", "true");
    expect(rows[0]).not.toHaveAttribute("data-focused");
    expect(
      within(rows[1]!).getByRole("button", { name: "Unfocus this task" }),
    ).toHaveAttribute("aria-pressed", "true");
    expect(
      within(rows[0]!).getByRole("button", { name: "Focus this task" }),
    ).toHaveAttribute("aria-pressed", "false");
    expect(screen.getByText("3")).toBeVisible();
  });

  it("toggles focus from the radio: focusing another replaces it, focusing the focused one unfocuses", async () => {
    const user = userEvent.setup();
    const { onFocusTask } = renderAttention({
      tasks: [callClinic, bookScan],
      focusedTaskId: callClinic._id,
    });

    await user.click(
      within(taskRows()[1]!).getByRole("button", { name: "Focus this task" }),
    );
    expect(onFocusTask).toHaveBeenLastCalledWith(bookScan._id);

    await user.click(
      within(taskRows()[0]!).getByRole("button", { name: "Unfocus this task" }),
    );
    expect(onFocusTask).toHaveBeenLastCalledWith(null);
  });

  it("highlights nothing when nothing is focused", () => {
    renderAttention({ tasks: [callClinic, bookScan] });

    expect(
      taskRows().filter((row) => row.hasAttribute("data-focused")),
    ).toEqual([]);
    expect(
      screen.getByText(
        "Focus one when you know it, or leave them all unfocused.",
      ),
    ).toBeVisible();
  });

  it("completes and removes any Task, focused or not", async () => {
    const user = userEvent.setup();
    const { onCompleteTask, onRemoveTask } = renderAttention({
      tasks: [callClinic, bookScan],
      focusedTaskId: callClinic._id,
    });

    await user.click(
      within(taskRows()[1]!).getByRole("button", { name: "Complete task" }),
    );
    expect(onCompleteTask).toHaveBeenCalledWith(bookScan._id);

    await user.click(
      within(taskRows()[0]!).getByRole("button", { name: "Remove task" }),
    );
    expect(onRemoveTask).toHaveBeenCalledWith(callClinic._id);
  });

  it("edits a Task in place", async () => {
    const user = userEvent.setup();
    const { onEditTask } = renderAttention({ tasks: [callClinic] });

    await user.click(screen.getByText("Call the clinic"));
    const editor = screen.getByDisplayValue("Call the clinic");
    await user.clear(editor);
    await user.type(editor, "Book appointment{Enter}");

    expect(onEditTask).toHaveBeenCalledWith(callClinic._id, "Book appointment");
  });

  it("captures a Task on Enter and on blur, never asking about focus", async () => {
    const user = userEvent.setup();
    const { onAddTask, onFocusTask } = renderAttention();

    expect(screen.queryByRole("list", { name: "Tasks" })).toBeNull();
    const field = screen.getByRole("textbox", { name: "Add a task" });
    await user.type(field, "Call the clinic{Enter}");
    expect(onAddTask).toHaveBeenCalledWith("Call the clinic");

    await user.type(field, "  Book the scan  ");
    await user.tab();
    expect(onAddTask).toHaveBeenLastCalledWith("Book the scan");
    expect(onAddTask).toHaveBeenCalledTimes(2);
    expect(onFocusTask).not.toHaveBeenCalled();

    await user.type(field, "   {Enter}");
    expect(onAddTask).toHaveBeenCalledTimes(2);
  });

  it("keeps the row controls reachable on touch", () => {
    renderAttention({ tasks: [callClinic] });

    // `xl` is THREAD_PANE_BREAKPOINT: the rail hides removal until the row is
    // hovered or focused, the drawer never does.
    expect(
      within(taskRows()[0]!).getByRole("button", { name: "Remove task" }),
    ).toHaveClass("xl:opacity-0");
    expect(
      within(taskRows()[0]!).getByRole("button", { name: "Complete task" }),
    ).toHaveClass("size-8", "xl:size-6");
    expect(screen.getByRole("textbox", { name: "Add a task" })).toHaveClass(
      "h-9",
      "xl:h-7",
    );
  });

  it("picks a Task's date from the calendar and clears it", async () => {
    const user = userEvent.setup();
    const { onSetTaskDate } = renderAttention({
      tasks: [{ ...callClinic, date: today }],
    });

    await user.click(
      screen.getByRole("button", { name: "Change date: Aug 13" }),
    );
    expect(
      await screen.findByText("Bring this back into view around this date."),
    ).toBeVisible();
    // The time waits behind its button until asked for.
    expect(screen.queryByLabelText("Time")).not.toBeInTheDocument();
    // The calendar opens on the date's month.
    await user.click(within(await screen.findByRole("grid")).getByText("20"));
    expect(onSetTaskDate).toHaveBeenCalledWith(
      callClinic._id,
      new Date(2026, 7, 20).getTime(),
    );

    // A Task's picker stays open after a day is picked, so a Repeat can
    // follow; Clear date is still in it.
    await user.click(screen.getByRole("button", { name: "Clear date" }));
    expect(onSetTaskDate).toHaveBeenLastCalledWith(callClinic._id, null);
  });

  it("adds a time to a Task's date once, when the picker closes", async () => {
    const user = userEvent.setup();
    const { onSetTaskDate } = renderAttention({
      tasks: [{ ...callClinic, date: today }],
    });

    await user.click(
      screen.getByRole("button", { name: "Change date: Aug 13" }),
    );
    await user.click(await screen.findByRole("button", { name: "Add time" }));
    const time = screen.getByLabelText("Time");
    expect(time).toHaveFocus();
    await user.type(time, "15:30");
    expect(onSetTaskDate).not.toHaveBeenCalled();

    await user.keyboard("{Enter}");
    expect(onSetTaskDate).toHaveBeenCalledExactlyOnceWith(
      callClinic._id,
      new Date(2026, 7, 13, 15, 30).getTime(),
    );
  });

  it("shows a Task's time beside its date, and removes it", async () => {
    const user = userEvent.setup();
    const { onSetTaskDate } = renderAttention({
      tasks: [{ ...callClinic, date: new Date(2026, 7, 13, 9).getTime() }],
    });

    await user.click(
      screen.getByRole("button", { name: "Change date: Aug 13 · 9 AM" }),
    );
    await user.click(
      await screen.findByRole("button", { name: "Remove time" }),
    );
    expect(screen.getByRole("button", { name: "Add time" })).toBeVisible();
    await user.keyboard("{Escape}");
    expect(onSetTaskDate).toHaveBeenCalledExactlyOnceWith(
      callClinic._id,
      today,
    );
  });

  it("tones a late date the way the rest of the app does", () => {
    const { unmount } = renderAttention({
      tasks: [{ ...callClinic, date: subDays(new Date(today), 2).getTime() }],
    });
    expect(screen.getByText("Aug 11")).toHaveClass("text-condition-attention");
    unmount();

    renderAttention({
      tasks: [{ ...callClinic, date: addDays(new Date(today), 9).getTime() }],
    });
    expect(screen.getByText("Aug 22")).toHaveClass("text-muted-foreground");
  });

  it("has no Thread-level Follow-up control any more", () => {
    renderAttention({ tasks: [callClinic] });

    expect(screen.queryByRole("button", { name: /follow-up/i })).toBeNull();
  });
});

describe("ThreadAttention repeating Tasks", () => {
  /** Thursday, Aug 13 at 9 PM. */
  const evening = new Date(2026, 7, 13, 21).getTime();
  const checkIn: Task = {
    ...callClinic,
    text: "Evening check-in",
    date: evening,
    repeat: { kind: "days", every: 1 },
  };
  const { repeat: _repeat, ...oneOff } = checkIn;

  it("marks a repeating Task with the repeat glyph before its text, and offers skip on it alone", async () => {
    const user = userEvent.setup();
    const { onSkipTask } = renderAttention({ tasks: [checkIn, bookScan] });

    const [repeating, plain] = taskRows();
    const glyph = within(repeating!).getByRole("img", {
      name: "Repeats daily",
    });
    // The glyph reads before the text.
    expect(
      glyph.compareDocumentPosition(
        within(repeating!).getByText(checkIn.text),
      ) & Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();
    expect(within(plain!).queryByRole("img")).toBeNull();
    expect(
      within(plain!).queryByRole("button", { name: "Skip task" }),
    ).toBeNull();

    await user.click(
      within(repeating!).getByRole("button", { name: "Skip task" }),
    );
    expect(onSkipTask).toHaveBeenCalledExactlyOnceWith(checkIn._id);
  });

  it("keeps the Repeat choices disabled until the Task has a day", async () => {
    const user = userEvent.setup();
    renderAttention({ tasks: [bookScan] });

    await user.click(screen.getByRole("button", { name: "Set date" }));
    const repeat = await screen.findByRole("group", { name: "Repeat" });
    for (const choice of ["Never", "Daily", "Every N days", "Weekly"]) {
      expect(
        within(repeat).getByRole("button", { name: choice }),
      ).toBeDisabled();
    }
    expect(repeat).toHaveTextContent("a repeat needs a date");
  });

  it("saves a Daily choice once, when the picker closes, and says what it will do", async () => {
    const user = userEvent.setup();
    const { onSetTaskRepeat, onSetTaskDate } = renderAttention({
      tasks: [oneOff],
    });

    await user.click(screen.getByRole("button", { name: /^Change date/ }));
    const repeat = await screen.findByRole("group", { name: "Repeat" });
    expect(repeat).toHaveTextContent("Once, on Thu, Aug 13 at 9 PM.");
    await user.click(within(repeat).getByRole("button", { name: "Daily" }));
    expect(
      within(repeat).getByRole("button", { name: "Daily" }),
    ).toHaveAttribute("aria-pressed", "true");
    expect(repeat).toHaveTextContent("Every day at 9 PM, from Thu, Aug 13.");
    expect(onSetTaskRepeat).not.toHaveBeenCalled();

    await user.click(screen.getByRole("button", { name: "Done" }));
    expect(onSetTaskRepeat).toHaveBeenCalledExactlyOnceWith(oneOff._id, {
      kind: "days",
      every: 1,
    });
    expect(onSetTaskDate).not.toHaveBeenCalled();
  });

  it("steps every N days and saves the rhythm", async () => {
    const user = userEvent.setup();
    const { onSetTaskRepeat } = renderAttention({ tasks: [checkIn] });

    await user.click(screen.getByRole("button", { name: /^Change date/ }));
    const repeat = await screen.findByRole("group", { name: "Repeat" });
    await user.click(
      within(repeat).getByRole("button", { name: "Every N days" }),
    );
    await user.click(within(repeat).getByRole("button", { name: "More days" }));
    expect(repeat).toHaveTextContent("Every 3 days at 9 PM, from Thu, Aug 13.");
    await user.keyboard("{Escape}");

    expect(onSetTaskRepeat).toHaveBeenCalledExactlyOnceWith(checkIn._id, {
      kind: "days",
      every: 3,
    });
  });

  it("says where a weekly choice moves the date before saving it", async () => {
    const user = userEvent.setup();
    const { onSetTaskRepeat } = renderAttention({ tasks: [checkIn] });

    await user.click(screen.getByRole("button", { name: /^Change date/ }));
    const repeat = await screen.findByRole("group", { name: "Repeat" });
    await user.click(within(repeat).getByRole("button", { name: "Weekly" }));
    // It starts from the date's own weekday, so nothing moves yet.
    expect(
      within(repeat).getByRole("button", { name: "Thursday" }),
    ).toHaveAttribute("aria-pressed", "true");
    expect(repeat).toHaveTextContent(
      "Weekly on Thu at 9 PM, from Thu, Aug 13.",
    );

    await user.click(within(repeat).getByRole("button", { name: "Thursday" }));
    expect(repeat).toHaveTextContent("Choose at least one day.");
    await user.click(within(repeat).getByRole("button", { name: "Monday" }));
    expect(repeat).toHaveTextContent(
      "Weekly on Mon at 9 PM. The date moves to Mon, Aug 17, the first chosen day.",
    );
    await user.click(screen.getByRole("button", { name: "Done" }));

    expect(onSetTaskRepeat).toHaveBeenCalledExactlyOnceWith(checkIn._id, {
      kind: "weekly",
      weekdays: [1],
    });
  });

  it("clears the Repeat with Never, and with the date", async () => {
    const user = userEvent.setup();
    const { onSetTaskRepeat, onSetTaskDate } = renderAttention({
      tasks: [checkIn],
    });

    await user.click(screen.getByRole("button", { name: /^Change date/ }));
    await user.click(
      within(await screen.findByRole("group", { name: "Repeat" })).getByRole(
        "button",
        { name: "Never" },
      ),
    );
    await user.click(screen.getByRole("button", { name: "Done" }));
    expect(onSetTaskRepeat).toHaveBeenCalledExactlyOnceWith(checkIn._id, null);

    await user.click(screen.getByRole("button", { name: /^Change date/ }));
    await user.click(await screen.findByRole("button", { name: "Clear date" }));
    // One command: clearing the date clears the Repeat with it.
    expect(onSetTaskDate).toHaveBeenCalledExactlyOnceWith(checkIn._id, null);
    expect(onSetTaskRepeat).toHaveBeenCalledTimes(1);
  });

  it("saves a Repeat chosen before a new day first, so the day is judged by it", async () => {
    const user = userEvent.setup();
    const { onSetTaskRepeat, onSetTaskDate } = renderAttention({
      tasks: [oneOff],
    });

    await user.click(screen.getByRole("button", { name: /^Change date/ }));
    await user.click(
      within(await screen.findByRole("group", { name: "Repeat" })).getByRole(
        "button",
        { name: "Daily" },
      ),
    );
    await user.click(within(screen.getByRole("grid")).getByText("20"));

    expect(onSetTaskRepeat).toHaveBeenCalledExactlyOnceWith(oneOff._id, {
      kind: "days",
      every: 1,
    });
    expect(onSetTaskDate).toHaveBeenCalledExactlyOnceWith(
      oneOff._id,
      new Date(2026, 7, 20, 21).getTime(),
    );
    expect(onSetTaskRepeat.mock.invocationCallOrder[0]!).toBeLessThan(
      onSetTaskDate.mock.invocationCallOrder[0]!,
    );
  });

  it("keeps the picker open when an undated Task gets its day, so a Repeat can follow", async () => {
    const user = userEvent.setup();
    const onSetTaskRepeat = vi.fn();
    function Stateful() {
      const [tasks, setTasks] = useState<Task[]>([callClinic, bookScan]);
      return (
        <ThreadAttention
          tasks={tasks}
          now={now}
          onAddTask={vi.fn()}
          onEditTask={vi.fn()}
          onRemoveTask={vi.fn()}
          onCompleteTask={vi.fn()}
          onCompleteTaskWithNote={vi.fn()}
          onFocusTask={vi.fn()}
          onSkipTask={vi.fn()}
          onSetTaskRepeat={onSetTaskRepeat}
          onSetTaskDate={(taskId, date) =>
            setTasks((current) =>
              current.map((task) =>
                task._id === taskId && date !== null ? { ...task, date } : task,
              ),
            )
          }
        />
      );
    }
    render(<Stateful />);

    // The second Task moves above the first once dated.
    await user.click(
      within(taskRows()[1]!).getByRole("button", { name: "Set date" }),
    );
    const month = new Date().toLocaleString("en-US", { month: "long" });
    await user.click(
      screen.getByRole("button", { name: new RegExp(`${month} 28`) }),
    );

    const repeat = await screen.findByRole("group", { name: "Repeat" });
    expect(within(repeat).getByRole("button", { name: "Daily" })).toBeEnabled();
    await user.click(within(repeat).getByRole("button", { name: "Daily" }));
    await user.click(screen.getByRole("button", { name: "Done" }));
    expect(onSetTaskRepeat).toHaveBeenCalledExactlyOnceWith(bookScan._id, {
      kind: "days",
      every: 1,
    });
  });

  it("discards an unsaved choice when the surface goes away with the picker open", async () => {
    const user = userEvent.setup();
    const { onSetTaskRepeat, onSetTaskDate, unmount } = renderAttention({
      tasks: [oneOff],
    });

    await user.click(screen.getByRole("button", { name: /^Change date/ }));
    await user.click(
      within(await screen.findByRole("group", { name: "Repeat" })).getByRole(
        "button",
        { name: "Daily" },
      ),
    );
    const time = screen.getByLabelText("Time");
    await user.clear(time);
    await user.type(time, "08:30");
    unmount();

    expect(onSetTaskRepeat).not.toHaveBeenCalled();
    expect(onSetTaskDate).not.toHaveBeenCalled();
  });

  it("never asks for a Repeat when a Task is captured", async () => {
    const user = userEvent.setup();
    const { onAddTask } = renderAttention();

    await user.type(
      screen.getByRole("textbox", { name: "Add a task" }),
      "Evening check-in{Enter}",
    );
    expect(onAddTask).toHaveBeenCalledExactlyOnceWith("Evening check-in");
    expect(screen.queryByRole("group", { name: "Repeat" })).toBeNull();
  });
});

describe("ThreadAttention completing with a note", () => {
  const note = (row: HTMLElement) =>
    within(row).getByRole("button", { name: "Complete with a note" });
  const composer = () => screen.queryByRole("group", { name: /with a note$/ });

  it("offers a note on every Task, while Complete itself stays one click", async () => {
    const user = userEvent.setup();
    const { onCompleteTask, onCompleteTaskWithNote } = renderAttention({
      tasks: [callClinic, bookScan],
    });

    for (const row of taskRows()) expect(note(row)).toBeInTheDocument();
    await user.click(
      within(taskRows()[0]!).getByRole("button", { name: "Complete task" }),
    );
    expect(onCompleteTask).toHaveBeenCalledExactlyOnceWith(callClinic._id);
    expect(composer()).toBeNull();
    expect(onCompleteTaskWithNote).not.toHaveBeenCalled();
  });

  it("completes with the note on Enter from a line under the row", async () => {
    const user = userEvent.setup();
    const { onCompleteTask, onCompleteTaskWithNote } = renderAttention({
      tasks: [callClinic, bookScan],
    });

    await user.click(note(taskRows()[1]!));
    const group = composer()!;
    expect(group).toHaveAccessibleName("Complete “Book the scan” with a note");
    const field = within(group).getByRole("textbox", { name: "Note" });
    expect(field).toHaveFocus();
    await user.type(field, "Booked for Friday{Enter}");

    expect(onCompleteTaskWithNote).toHaveBeenCalledExactlyOnceWith(
      bookScan._id,
      "Booked for Friday",
    );
    expect(onCompleteTask).not.toHaveBeenCalled();
    expect(composer()).toBeNull();
  });

  it("keeps Shift+Enter as a new line, and completes from its button", async () => {
    const user = userEvent.setup();
    const { onCompleteTaskWithNote } = renderAttention({ tasks: [callClinic] });

    await user.click(note(taskRows()[0]!));
    await user.type(
      screen.getByRole("textbox", { name: "Note" }),
      "Called{Shift>}{Enter}{/Shift}No answer",
    );
    await user.click(
      within(composer()!).getByRole("button", { name: "Complete" }),
    );

    expect(onCompleteTaskWithNote).toHaveBeenCalledExactlyOnceWith(
      callClinic._id,
      "Called\nNo answer",
    );
  });

  it("completes plainly when the line is left blank", async () => {
    const user = userEvent.setup();
    const { onCompleteTask, onCompleteTaskWithNote } = renderAttention({
      tasks: [callClinic],
    });

    await user.click(note(taskRows()[0]!));
    await user.type(screen.getByRole("textbox", { name: "Note" }), "  {Enter}");

    expect(onCompleteTask).toHaveBeenCalledExactlyOnceWith(callClinic._id);
    expect(onCompleteTaskWithNote).not.toHaveBeenCalled();
  });

  it("cancels with Escape, from the field or a button, or with Cancel, keeping nothing", async () => {
    const user = userEvent.setup();
    const { onCompleteTask, onCompleteTaskWithNote } = renderAttention({
      tasks: [callClinic],
    });

    await user.click(note(taskRows()[0]!));
    await user.type(screen.getByRole("textbox", { name: "Note" }), "Draft");
    await user.keyboard("{Escape}");
    expect(composer()).toBeNull();

    await user.click(note(taskRows()[0]!));
    expect(screen.getByRole("textbox", { name: "Note" })).toHaveValue("");
    within(composer()!).getByRole("button", { name: "Cancel" }).focus();
    await user.keyboard("{Escape}");
    expect(composer()).toBeNull();

    await user.click(note(taskRows()[0]!));
    await user.click(
      within(composer()!).getByRole("button", { name: "Cancel" }),
    );
    expect(composer()).toBeNull();
    expect(onCompleteTask).not.toHaveBeenCalled();
    expect(onCompleteTaskWithNote).not.toHaveBeenCalled();
  });

  it("lets the text go once sent: the line stays closed and opens empty, whatever comes back", async () => {
    const user = userEvent.setup();
    const answer = deferred<unknown>();
    const { onCompleteTaskWithNote } = renderAttention({ tasks: [callClinic] });
    onCompleteTaskWithNote.mockReturnValueOnce(answer.promise);

    await user.click(note(taskRows()[0]!));
    await user.type(
      screen.getByRole("textbox", { name: "Note" }),
      "Clinic closed today{Enter}",
    );
    // A failure is reported by the caller, with the text; nothing comes back here.
    await act(async () => {
      answer.resolve({ status: "kept", message: "Not saved." });
      await answer.promise;
    });

    expect(composer()).toBeNull();
    await user.click(note(taskRows()[0]!));
    expect(screen.getByRole("textbox", { name: "Note" })).toHaveValue("");
    expect(screen.queryByRole("status")).toBeNull();
  });

  it("takes no note while a plain complete or skip of the Task is pending", () => {
    renderAttention({
      tasks: [callClinic, bookScan],
      completingTaskIds: new Set([callClinic._id]),
    });

    expect(note(taskRows()[0]!)).toBeDisabled();
    expect(note(taskRows()[1]!)).toBeEnabled();
  });
});

describe("ThreadAttention pending occurrence controls", () => {
  it("disables Complete and Skip for the pending Task while another Task stays usable", () => {
    renderAttention({
      tasks: [
        { ...callClinic, date: today, repeat: { kind: "days", every: 1 } },
        bookScan,
      ],
      completingTaskIds: new Set([callClinic._id]),
    });
    expect(
      within(taskRows()[0]!).getByRole("button", { name: "Complete task" }),
    ).toBeDisabled();
    expect(
      within(taskRows()[0]!).getByRole("button", { name: "Skip task" }),
    ).toBeDisabled();
    expect(
      within(taskRows()[1]!).getByRole("button", { name: "Complete task" }),
    ).toBeEnabled();
  });
});
