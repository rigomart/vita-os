import type { Task, TaskId } from "@vita-os/contracts";

import userEvent from "@testing-library/user-event";
import { addDays, subDays } from "date-fns";
import { useState } from "react";
import { describe, expect, it, vi } from "vitest";

import { deferred } from "../../test/fake-application-client";
import { act, render, screen, within } from "../../test/render-with-providers";
import { pickCalendarDay } from "../../test/when-picker";
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

  it("keeps dated and undated Tasks in one list, in capture order, with no divider", () => {
    renderAttention({ tasks: [loose, afternoon, sooner, dateOnly] });

    expect(taskRows().map((row) => row.textContent)).toEqual([
      expect.stringContaining("Think about it"),
      expect.stringContaining("Book the scan"),
      expect.stringContaining("Call the clinic"),
      expect.stringContaining("Collect the results"),
    ]);
    expect(screen.queryByText("No date")).toBeNull();
  });

  it("names a near day in words and a far one by its date", () => {
    const at = (day: number, hour = 0) =>
      new Date(2026, 7, day, hour).getTime();
    renderAttention({
      tasks: [
        { ...callClinic, date: at(13, 15) },
        { ...bookScan, date: at(14) },
        { ...collect, date: at(12) },
        { ...loose, date: at(18) },
        { _id: "task-5" as TaskId, text: "Renew", date: at(20) },
      ],
    });

    expect(
      taskRows().map((row) =>
        within(row)
          .getByRole("button", { name: /^Change date:/ })
          .getAttribute("aria-label"),
      ),
    ).toEqual([
      "Change date: Today · 3 PM",
      "Change date: Tomorrow",
      "Change date: Yesterday",
      "Change date: Tue",
      "Change date: Aug 20",
    ]);
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
      within(taskRows()[0]!).getByRole("button", { name: "Set date" }),
    );
    // An empty picker opens on the real current month.
    const month = new Date().toLocaleString("en-US", { month: "long" });
    await pickCalendarDay(user, new RegExp(`${month} 28`));

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
      within(taskRows()[0]!).getByRole("button", { name: /^Change date:/ }),
    );
    await user.click(screen.getByRole("button", { name: "Clear date" }));

    expect(onSetTaskDate).toHaveBeenCalledExactlyOnceWith(afternoon._id, null);
  });
});

describe("ThreadAttention", () => {
  it("lists every Task in capture order", () => {
    renderAttention({ tasks: [callClinic, bookScan, collect] });

    const rows = taskRows();
    expect(rows.map((row) => row.textContent)).toEqual([
      expect.stringContaining("Call the clinic"),
      expect.stringContaining("Book the scan"),
      expect.stringContaining("Collect the results"),
    ]);
    expect(screen.getByText("3")).toBeVisible();
  });

  it("offers Skip when a Task repeats, the date, Complete with a note, and Remove, and nothing to focus", () => {
    const daily: Task = {
      ...callClinic,
      date: today,
      repeat: { kind: "days", every: 1 },
    };
    renderAttention({ tasks: [daily, bookScan] });

    const commands = (row: HTMLElement) =>
      within(within(row).getByRole("toolbar", { name: "Task commands" }))
        .getAllByRole("button")
        .map((button) => button.getAttribute("aria-label"));
    expect(commands(taskRows()[0]!)).toEqual([
      "Skip task",
      "Change date",
      "Complete with a note",
      "Remove task",
    ]);
    expect(commands(taskRows()[1]!)).toEqual([
      "Set date",
      "Complete with a note",
      "Remove task",
    ]);
    expect(screen.queryByRole("button", { name: /focus/i })).toBeNull();
  });

  it("completes and removes any Task", async () => {
    const user = userEvent.setup();
    const { onCompleteTask, onRemoveTask } = renderAttention({
      tasks: [callClinic, bookScan],
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

  it("shows two lines of a Task at rest and all of it while edited", async () => {
    const user = userEvent.setup();
    renderAttention({ tasks: [callClinic] });

    expect(screen.getByText("Call the clinic")).toHaveClass("line-clamp-2");
    await user.click(screen.getByText("Call the clinic"));
    // A field that grows with the text, not a one-line input.
    expect(screen.getByRole("textbox", { name: "Task" }).tagName).toBe(
      "TEXTAREA",
    );
  });

  it("keeps a Task one line: Enter saves, a line break becomes a space, blank text is never saved", async () => {
    const user = userEvent.setup();
    const { onEditTask } = renderAttention({ tasks: [callClinic] });

    await user.click(screen.getByText("Call the clinic"));
    const editor = screen.getByRole("textbox", { name: "Task" });
    await user.clear(editor);
    await user.click(editor);
    await user.paste("Call the\nclinic again");
    expect(editor).toHaveValue("Call the clinic again");
    await user.keyboard("{Enter}");
    expect(onEditTask).toHaveBeenCalledExactlyOnceWith(
      callClinic._id,
      "Call the clinic again",
    );

    await user.click(screen.getByText("Call the clinic"));
    await user.clear(screen.getByRole("textbox", { name: "Task" }));
    await user.keyboard("{Enter}");
    expect(onEditTask).toHaveBeenCalledTimes(1);
  });

  it("puts the text back on Escape", async () => {
    const user = userEvent.setup();
    const { onEditTask } = renderAttention({ tasks: [callClinic] });

    await user.click(screen.getByText("Call the clinic"));
    await user.type(
      screen.getByRole("textbox", { name: "Task" }),
      " tomorrow{Escape}",
    );

    expect(screen.queryByRole("textbox", { name: "Task" })).toBeNull();
    expect(screen.getByText("Call the clinic")).toBeVisible();
    expect(onEditTask).not.toHaveBeenCalled();
  });

  it("captures a Task on Enter and on blur", async () => {
    const user = userEvent.setup();
    const { onAddTask } = renderAttention();

    expect(screen.queryByRole("list", { name: "Tasks" })).toBeNull();
    const field = screen.getByRole("textbox", { name: "Add a task" });
    await user.type(field, "Call the clinic{Enter}");
    expect(onAddTask).toHaveBeenCalledWith("Call the clinic");

    await user.type(field, "  Book the scan  ");
    await user.tab();
    expect(onAddTask).toHaveBeenLastCalledWith("Book the scan");
    expect(onAddTask).toHaveBeenCalledTimes(2);

    await user.type(field, "   {Enter}");
    expect(onAddTask).toHaveBeenCalledTimes(2);
  });

  it("keeps the row controls reachable on touch", () => {
    renderAttention({ tasks: [callClinic] });

    // `xl` is THREAD_PANE_BREAKPOINT: the rail hides the commands until the row
    // is hovered or focused, the drawer never does.
    expect(
      within(taskRows()[0]!).getByRole("toolbar", { name: "Task commands" }),
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
      screen.getByRole("button", { name: "Change date: Today" }),
    );
    await user.click(
      await screen.findByRole("button", { name: "Pick a date…" }),
    );
    // The calendar opens on the date's month.
    await user.click(within(await screen.findByRole("grid")).getByText("20"));
    expect(onSetTaskDate).toHaveBeenCalledWith(
      callClinic._id,
      new Date(2026, 7, 20).getTime(),
    );

    // A Task's picker stays open after a day is picked, so a Repeat can
    // follow, and goes back to its menu, where Clear date is.
    await user.click(screen.getByRole("button", { name: "Clear date" }));
    expect(onSetTaskDate).toHaveBeenLastCalledWith(callClinic._id, null);
  });

  it("moves a Task to a quick pick, keeping its time", async () => {
    const user = userEvent.setup();
    const { onSetTaskDate } = renderAttention({
      tasks: [{ ...callClinic, date: new Date(2026, 7, 13, 9).getTime() }],
    });

    await user.click(
      screen.getByRole("button", { name: "Change date: Today · 9 AM" }),
    );
    // The quick picks count from the real today.
    await user.click(
      await screen.findByRole("button", { name: /^Tomorrow, / }),
    );
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    tomorrow.setHours(9, 0, 0, 0);
    expect(onSetTaskDate).toHaveBeenCalledExactlyOnceWith(
      callClinic._id,
      tomorrow.getTime(),
    );
  });

  it("sets a Task's time from a chip in one click, once", async () => {
    const user = userEvent.setup();
    const { onSetTaskDate } = renderAttention({
      tasks: [{ ...callClinic, date: today }],
    });

    await user.click(
      screen.getByRole("button", { name: "Change date: Today" }),
    );
    const time = await screen.findByRole("group", { name: "Time" });
    await user.click(within(time).getByRole("button", { name: "3 PM" }));
    expect(onSetTaskDate).toHaveBeenCalledExactlyOnceWith(
      callClinic._id,
      new Date(2026, 7, 13, 15).getTime(),
    );
    // A row's picker stays open on its menu, for a Repeat to follow.
    expect(screen.getByRole("button", { name: "Pick a date…" })).toBeVisible();
  });

  it("removes a Task's time with its chip again", async () => {
    const user = userEvent.setup();
    const { onSetTaskDate } = renderAttention({
      tasks: [{ ...callClinic, date: new Date(2026, 7, 13, 9).getTime() }],
    });

    await user.click(
      screen.getByRole("button", { name: "Change date: Today · 9 AM" }),
    );
    const chip = within(
      await screen.findByRole("group", { name: "Time" }),
    ).getByRole("button", { name: "9 AM" });
    expect(chip).toHaveAttribute("aria-pressed", "true");
    await user.click(chip);
    expect(onSetTaskDate).toHaveBeenCalledExactlyOnceWith(
      callClinic._id,
      today,
    );
  });

  it("types a time no chip offers, choosing between AM and PM", async () => {
    const user = userEvent.setup();
    const { onSetTaskDate } = renderAttention({
      tasks: [{ ...callClinic, date: today }],
    });

    await user.click(
      screen.getByRole("button", { name: "Change date: Today" }),
    );
    await user.click(await screen.findByRole("button", { name: "Other time" }));
    const field = screen.getByRole("textbox", { name: "Time" });
    expect(field).toHaveFocus();
    await user.type(field, "7");
    expect(screen.getByRole("button", { name: "7 AM" })).toBeVisible();
    expect(screen.getByRole("button", { name: "7 PM" })).toBeVisible();
    expect(onSetTaskDate).not.toHaveBeenCalled();

    await user.type(field, "45p{Enter}");
    expect(onSetTaskDate).toHaveBeenCalledExactlyOnceWith(
      callClinic._id,
      new Date(2026, 7, 13, 19, 45).getTime(),
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

  it("marks a repeating Task with the repeat glyph on its date, and offers skip on it alone", async () => {
    const user = userEvent.setup();
    const { onSkipTask } = renderAttention({ tasks: [checkIn, bookScan] });

    const [repeating, plain] = taskRows();
    const glyph = within(repeating!).getByRole("img", {
      name: "Repeats daily",
    });
    expect(
      within(repeating!).getByRole("button", { name: /^Change date:/ }),
    ).toContainElement(glyph);
    expect(within(plain!).queryByRole("img")).toBeNull();
    expect(
      within(plain!).queryByRole("button", { name: "Skip task" }),
    ).toBeNull();

    await user.click(
      within(repeating!).getByRole("button", { name: "Skip task" }),
    );
    expect(onSkipTask).toHaveBeenCalledExactlyOnceWith(checkIn._id);
  });

  it("keeps the time and the Repeat disabled until the Task has a day", async () => {
    const user = userEvent.setup();
    renderAttention({ tasks: [bookScan] });

    await user.click(screen.getByRole("button", { name: "Set date" }));
    expect(
      await screen.findByRole("button", { name: "Repeat, Never" }),
    ).toBeDisabled();
    for (const chip of within(
      screen.getByRole("group", { name: "Time" }),
    ).getAllByRole("button")) {
      expect(chip).toBeDisabled();
    }
  });

  it("saves a preset Repeat in one click, and nothing else", async () => {
    const user = userEvent.setup();
    const { onSetTaskRepeat, onSetTaskDate } = renderAttention({
      tasks: [oneOff],
    });

    await user.click(screen.getByRole("button", { name: /^Change date:/ }));
    await user.click(
      await screen.findByRole("button", { name: "Repeat, Never" }),
    );
    expect(
      screen.getByRole("button", { name: "Doesn't repeat" }),
    ).toHaveAttribute("aria-pressed", "true");
    await user.click(screen.getByRole("button", { name: "Every day" }));

    expect(onSetTaskRepeat).toHaveBeenCalledExactlyOnceWith(oneOff._id, {
      kind: "days",
      every: 1,
    });
    expect(onSetTaskDate).not.toHaveBeenCalled();
    // Back on the menu.
    expect(screen.getByRole("button", { name: "Pick a date…" })).toBeVisible();
  });

  it("offers the date's own weekday, and says when a preset moves the date", async () => {
    const user = userEvent.setup();
    // Saturday, Aug 15.
    renderAttention({
      tasks: [{ ...oneOff, date: new Date(2026, 7, 15, 21).getTime() }],
    });

    await user.click(screen.getByRole("button", { name: /^Change date:/ }));
    await user.click(
      await screen.findByRole("button", { name: "Repeat, Never" }),
    );
    expect(
      screen.getByRole("button", { name: "Every Saturday" }),
    ).toBeVisible();
    expect(
      screen.getByRole("button", { name: "Every weekday, from Mon" }),
    ).toBeVisible();
  });

  it("offers every month on the date's day, and marks a monthly Task with it", async () => {
    const user = userEvent.setup();
    const { onSetTaskRepeat } = renderAttention({ tasks: [oneOff] });

    await user.click(screen.getByRole("button", { name: /^Change date:/ }));
    await user.click(
      await screen.findByRole("button", { name: "Repeat, Never" }),
    );
    await user.click(
      screen.getByRole("button", { name: "Every month on the 13th" }),
    );
    expect(onSetTaskRepeat).toHaveBeenCalledExactlyOnceWith(oneOff._id, {
      kind: "monthly",
      day: 13,
    });
  });

  it("shows a monthly Task's own day where a short month stands in for it", async () => {
    const user = userEvent.setup();
    renderAttention({
      tasks: [
        {
          ...oneOff,
          date: new Date(2026, 8, 30, 21).getTime(),
          repeat: { kind: "monthly", day: 31 },
        },
      ],
    });

    expect(
      within(taskRows()[0]!).getByRole("img", {
        name: "Repeats monthly on the 31st",
      }),
    ).toBeVisible();
    await user.click(screen.getByRole("button", { name: /^Change date:/ }));
    await user.click(
      await screen.findByRole("button", {
        name: "Repeat, Monthly on the 31st",
      }),
    );
    expect(
      screen.getByRole("button", { name: "Every month on the 31st" }),
    ).toHaveAttribute("aria-pressed", "true");
  });

  it("steps a custom every N days and saves the rhythm", async () => {
    const user = userEvent.setup();
    const { onSetTaskRepeat } = renderAttention({ tasks: [checkIn] });

    await user.click(screen.getByRole("button", { name: /^Change date:/ }));
    await user.click(
      await screen.findByRole("button", { name: "Repeat, Daily" }),
    );
    await user.click(screen.getByRole("button", { name: "Custom…" }));
    const custom = screen.getByRole("group", { name: "Custom repeat" });
    expect(
      within(custom).getByRole("button", { name: "Every N days" }),
    ).toHaveAttribute("aria-pressed", "true");
    await user.click(within(custom).getByRole("button", { name: "More days" }));
    await user.click(within(custom).getByRole("button", { name: "More days" }));
    expect(custom).toHaveTextContent("Every 3 days at 9 PM, from Thu, Aug 13.");
    expect(onSetTaskRepeat).not.toHaveBeenCalled();

    await user.click(
      within(custom).getByRole("button", { name: "Save repeat" }),
    );
    expect(onSetTaskRepeat).toHaveBeenCalledExactlyOnceWith(checkIn._id, {
      kind: "days",
      every: 3,
    });
  });

  it("says where a custom weekly choice moves the date before saving it", async () => {
    const user = userEvent.setup();
    const { onSetTaskRepeat } = renderAttention({ tasks: [checkIn] });

    await user.click(screen.getByRole("button", { name: /^Change date:/ }));
    await user.click(
      await screen.findByRole("button", { name: "Repeat, Daily" }),
    );
    await user.click(screen.getByRole("button", { name: "Custom…" }));
    const custom = screen.getByRole("group", { name: "Custom repeat" });
    await user.click(within(custom).getByRole("button", { name: "Weekly" }));
    // It starts from the date's own weekday, so nothing moves yet.
    expect(
      within(custom).getByRole("button", { name: "Thursday" }),
    ).toHaveAttribute("aria-pressed", "true");
    expect(custom).toHaveTextContent(
      "Weekly on Thu at 9 PM, from Thu, Aug 13.",
    );

    await user.click(within(custom).getByRole("button", { name: "Thursday" }));
    expect(custom).toHaveTextContent("Choose at least one day.");
    expect(
      within(custom).getByRole("button", { name: "Save repeat" }),
    ).toBeDisabled();
    await user.click(within(custom).getByRole("button", { name: "Monday" }));
    expect(custom).toHaveTextContent(
      "Weekly on Mon at 9 PM. The date moves to Mon, Aug 17, the first chosen day.",
    );
    await user.click(
      within(custom).getByRole("button", { name: "Save repeat" }),
    );

    expect(onSetTaskRepeat).toHaveBeenCalledExactlyOnceWith(checkIn._id, {
      kind: "weekly",
      weekdays: [1],
    });
  });

  it("clears the Repeat with Doesn't repeat, and with the date", async () => {
    const user = userEvent.setup();
    const { onSetTaskRepeat, onSetTaskDate } = renderAttention({
      tasks: [checkIn],
    });

    await user.click(screen.getByRole("button", { name: /^Change date:/ }));
    await user.click(
      await screen.findByRole("button", { name: "Repeat, Daily" }),
    );
    await user.click(screen.getByRole("button", { name: "Doesn't repeat" }));
    expect(onSetTaskRepeat).toHaveBeenCalledExactlyOnceWith(checkIn._id, null);

    await user.click(screen.getByRole("button", { name: "Clear date" }));
    // One command: clearing the date clears the Repeat with it.
    expect(onSetTaskDate).toHaveBeenCalledExactlyOnceWith(checkIn._id, null);
    expect(onSetTaskRepeat).toHaveBeenCalledTimes(1);
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

    // Dated, the second Task stays where it was captured.
    await user.click(
      within(taskRows()[1]!).getByRole("button", { name: "Set date" }),
    );
    const month = new Date().toLocaleString("en-US", { month: "long" });
    await pickCalendarDay(user, new RegExp(`${month} 28`));

    const repeat = await screen.findByRole("button", { name: "Repeat, Never" });
    expect(repeat).toBeEnabled();
    await user.click(repeat);
    await user.click(screen.getByRole("button", { name: "Every day" }));
    expect(onSetTaskRepeat).toHaveBeenCalledExactlyOnceWith(bookScan._id, {
      kind: "days",
      every: 1,
    });
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
