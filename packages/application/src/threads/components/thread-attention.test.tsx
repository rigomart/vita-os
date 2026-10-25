import type { OperationResult, Task, TaskId, Thread } from "@vita-os/contracts";

import userEvent from "@testing-library/user-event";
import { addDays, subDays } from "date-fns";
import { useState } from "react";
import { describe, expect, it, vi } from "vitest";

import {
  createFakeApplicationClient,
  deferred,
  failure,
} from "../../test/fake-application-client";
import { aThread } from "../../test/fixtures";
import {
  act,
  render,
  screen,
  waitFor,
  within,
} from "../../test/render-with-providers";
import { pickCalendarDay } from "../../test/when-picker";
import { ThreadAttention } from "./thread-attention";
import { ThreadAttentionSection } from "./thread-attention-section";

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

describe("ThreadAttention Task capture", () => {
  it("queues A then B while A saves, keeping the input enabled and focused", async () => {
    const user = userEvent.setup();
    const first = deferred<void>();
    const second = deferred<void>();
    const onAddTask = vi
      .fn()
      .mockReturnValueOnce(first.promise)
      .mockReturnValueOnce(second.promise);
    renderAttention({ onAddTask });
    const input = screen.getByRole("textbox", { name: "Add a task" });

    await user.click(input);
    await user.keyboard("A{Enter}");
    expect(input).toHaveValue("");
    expect(input).toBeEnabled();
    expect(input).toHaveFocus();
    await user.keyboard("B{Enter}");
    expect(input).toHaveValue("");
    expect(input).toHaveFocus();
    expect(onAddTask.mock.calls).toEqual([["A"]]);

    await act(async () => first.resolve());
    expect(onAddTask.mock.calls).toEqual([["A"], ["B"]]);
    expect(input).toBeEnabled();
    expect(input).toHaveFocus();
    await act(async () => second.resolve());
    expect(onAddTask).toHaveBeenCalledTimes(2);
  });

  it("restores a failed add and surfaces its text through the existing feedback", async () => {
    const user = userEvent.setup();
    const pending = deferred<OperationResult<Thread>>();
    const { feedback } = render(<ThreadAttentionSection thread={aThread()} />, {
      applicationClient: createFakeApplicationClient({
        addTask: () => pending.promise,
      }),
    });
    const input = screen.getByRole("textbox", { name: "Add a task" });
    await user.click(input);
    await user.keyboard("Call clinic{Enter}");
    await act(async () =>
      pending.resolve(
        failure({ code: "unavailable", message: "offline", retryable: true }),
      ),
    );

    await waitFor(() => expect(input).toHaveValue("Call clinic"));
    expect(input).toHaveFocus();
    expect(feedback.error).toHaveBeenCalledExactlyOnceWith(
      "Could not save that change. Please try again.",
      expect.objectContaining({
        description: "Call clinic",
        action: expect.objectContaining({ label: "Copy task" }),
      }),
    );
  });

  it("preserves a newer draft while the failed text stays available in feedback", async () => {
    const user = userEvent.setup();
    const pending = deferred<OperationResult<Thread>>();
    const { feedback } = render(<ThreadAttentionSection thread={aThread()} />, {
      applicationClient: createFakeApplicationClient({
        addTask: () => pending.promise,
      }),
    });
    const input = screen.getByRole("textbox", { name: "Add a task" });
    await user.click(input);
    await user.keyboard("A{Enter}B");
    await act(async () =>
      pending.resolve(
        failure({ code: "unavailable", message: "offline", retryable: true }),
      ),
    );

    await waitFor(() => expect(feedback.error).toHaveBeenCalled());
    expect(input).toHaveValue("B");
    expect(feedback.error).toHaveBeenCalledWith(
      expect.any(String),
      expect.objectContaining({ description: "A" }),
    );
  });

  it("adds once when Enter is immediately followed by blur", async () => {
    const user = userEvent.setup();
    const pending = deferred<void>();
    const onAddTask = vi.fn(() => pending.promise);
    renderAttention({ onAddTask });
    await user.click(screen.getByRole("textbox", { name: "Add a task" }));
    await user.keyboard("A{Enter}{Tab}");
    await act(async () => pending.resolve());
    expect(onAddTask.mock.calls).toEqual([["A"]]);
  });

  it("continues saving queued Tasks after an earlier add fails", async () => {
    const user = userEvent.setup();
    const first = deferred<void>();
    const onAddTask = vi
      .fn()
      .mockReturnValueOnce(first.promise)
      .mockResolvedValue(undefined);
    renderAttention({ onAddTask });
    const input = screen.getByRole("textbox", { name: "Add a task" });
    await user.click(input);
    await user.keyboard("A{Enter}B{Enter}");
    await act(async () => first.reject(new Error("offline")));

    expect(onAddTask.mock.calls).toEqual([["A"], ["B"]]);
    expect(input).toHaveValue("A");
    expect(input).toHaveFocus();
  });
});

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

  it("offers Remove, Skip when a Task repeats, Complete with a note, and Complete last, one date control, and nothing to focus", () => {
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
      "Remove task",
      "Skip task",
      "Complete with a note",
      "Complete task",
    ]);
    expect(commands(taskRows()[1]!)).toEqual([
      "Remove task",
      "Complete with a note",
      "Complete task",
    ]);
    const dates = (row: HTMLElement) =>
      within(row)
        .getAllByRole("button", { name: /date/i })
        .map((button) => button.getAttribute("aria-label"));
    expect(dates(taskRows()[0]!)).toEqual(["Change date: Today"]);
    expect(dates(taskRows()[1]!)).toEqual(["Set date"]);
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
    ).toHaveClass("size-8", "xl:size-7");
    expect(screen.getByRole("textbox", { name: "Add a task" })).toHaveClass(
      "h-9",
      "xl:h-7",
    );
  });

  it("picks a Task's date from the calendar beside its time, and clears it", async () => {
    const user = userEvent.setup();
    const { onSetTaskDate } = renderAttention({
      tasks: [{ ...callClinic, date: today }],
    });

    await user.click(
      screen.getByRole("button", { name: "Change date: Today" }),
    );
    // The calendar is open at once, on the date's month.
    await user.click(within(await screen.findByRole("grid")).getByText("20"));
    expect(onSetTaskDate).toHaveBeenCalledWith(
      callClinic._id,
      new Date(2026, 7, 20).getTime(),
    );

    // A Task's picker stays open after a day is picked, so a Repeat can follow.
    await user.click(screen.getByRole("button", { name: "Clear date" }));
    expect(onSetTaskDate).toHaveBeenLastCalledWith(callClinic._id, null);
  });

  it("keeps the picker open when a day turns the undated Task's date command into its token", async () => {
    const user = userEvent.setup();
    const { onSetTaskDate, show } = renderAttention({ tasks: [callClinic] });

    await user.click(screen.getByRole("button", { name: "Set date" }));
    await user.click(within(await screen.findByRole("grid")).getByText("20"));
    expect(onSetTaskDate).toHaveBeenCalledOnce();
    const date = onSetTaskDate.mock.calls[0]![1] as number;
    show({ tasks: [{ ...callClinic, date }] });

    expect(screen.getByRole("grid")).toBeVisible();
    expect(
      screen.getByRole("button", { name: /^Change date: / }),
    ).toBeVisible();
    expect(screen.queryByRole("button", { name: "Set date" })).toBeNull();
  });

  it("moves a Task to another day, keeping its time", async () => {
    const user = userEvent.setup();
    const { onSetTaskDate } = renderAttention({
      tasks: [{ ...callClinic, date: new Date(2026, 7, 13, 9).getTime() }],
    });

    await user.click(
      screen.getByRole("button", { name: "Change date: Today · 9 AM" }),
    );
    await user.click(within(await screen.findByRole("grid")).getByText("14"));
    expect(onSetTaskDate).toHaveBeenCalledExactlyOnceWith(
      callClinic._id,
      new Date(2026, 7, 14, 9).getTime(),
    );
  });

  it("sets a Task's time from a preset in one click, once, and stays open", async () => {
    const user = userEvent.setup();
    const { onSetTaskDate } = renderAttention({
      tasks: [{ ...callClinic, date: today }],
    });

    await user.click(
      screen.getByRole("button", { name: "Change date: Today" }),
    );
    const presets = await screen.findByRole("group", { name: "Preset times" });
    await user.click(within(presets).getByRole("button", { name: "3 PM" }));
    expect(onSetTaskDate).toHaveBeenCalledExactlyOnceWith(
      callClinic._id,
      new Date(2026, 7, 13, 15).getTime(),
    );
    expect(screen.getByRole("grid")).toBeVisible();
  });

  it("removes a Task's time with Remove", async () => {
    const user = userEvent.setup();
    const { onSetTaskDate } = renderAttention({
      tasks: [{ ...callClinic, date: new Date(2026, 7, 13, 9).getTime() }],
    });

    await user.click(
      screen.getByRole("button", { name: "Change date: Today · 9 AM" }),
    );
    expect(
      within(
        await screen.findByRole("group", { name: "Preset times" }),
      ).getByRole("button", { name: "9 AM" }),
    ).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByLabelText("Time")).toHaveValue("09:00");
    await user.click(screen.getByRole("button", { name: "Remove time" }));
    expect(onSetTaskDate).toHaveBeenCalledExactlyOnceWith(
      callClinic._id,
      today,
    );
  });

  it("offers Remove only when there is a time, with the field empty", async () => {
    const user = userEvent.setup();
    renderAttention({ tasks: [{ ...callClinic, date: today }] });
    await user.click(
      screen.getByRole("button", { name: "Change date: Today" }),
    );
    expect(await screen.findByLabelText("Time")).toHaveValue("");
    expect(screen.queryByRole("button", { name: "Remove time" })).toBeNull();
  });

  it("saves a typed time on Enter, once", async () => {
    const user = userEvent.setup();
    const { onSetTaskDate } = renderAttention({
      tasks: [{ ...callClinic, date: today }],
    });

    await user.click(
      screen.getByRole("button", { name: "Change date: Today" }),
    );
    await user.type(await screen.findByLabelText("Time"), "19:45{Enter}");
    expect(onSetTaskDate).toHaveBeenCalledExactlyOnceWith(
      callClinic._id,
      new Date(2026, 7, 13, 19, 45).getTime(),
    );
  });

  it("saves a typed time when the picker closes before it would have", async () => {
    const user = userEvent.setup();
    const { onSetTaskDate } = renderAttention({
      tasks: [{ ...callClinic, date: today }],
    });

    await user.click(
      screen.getByRole("button", { name: "Change date: Today" }),
    );
    await user.type(await screen.findByLabelText("Time"), "07:30");
    await user.keyboard("{Escape}");
    await waitFor(() => expect(screen.queryByRole("grid")).toBeNull());
    expect(onSetTaskDate).toHaveBeenCalledExactlyOnceWith(
      callClinic._id,
      new Date(2026, 7, 13, 7, 30).getTime(),
    );
  });

  it("never saves midnight, which reads as no time, and says so", async () => {
    const user = userEvent.setup();
    const { onSetTaskDate } = renderAttention({
      tasks: [{ ...callClinic, date: today }],
    });

    await user.click(
      screen.getByRole("button", { name: "Change date: Today" }),
    );
    await user.type(await screen.findByLabelText("Time"), "00:00{Enter}");
    expect(screen.getByText(/^Midnight is no time\./)).toBeVisible();
    expect(onSetTaskDate).not.toHaveBeenCalled();
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

  it("marks a repeating Task with the repeat glyph, and offers skip on it alone", async () => {
    const user = userEvent.setup();
    const { onSkipTask } = renderAttention({ tasks: [checkIn, bookScan] });

    const [repeating, plain] = taskRows();
    const glyph = within(repeating!).getByRole("img", {
      name: "Repeats daily",
    });
    expect(glyph).toHaveAttribute("data-slot", "repeat-glyph");
    expect(within(plain!).queryByRole("img")).toBeNull();
    expect(
      within(plain!).queryByRole("button", { name: "Skip task" }),
    ).toBeNull();

    await user.click(
      within(repeating!).getByRole("button", { name: "Skip task" }),
    );
    expect(onSkipTask).toHaveBeenCalledExactlyOnceWith(checkIn._id);
  });

  it("shows the time and the Repeat, disabled, until the Task has a day", async () => {
    const user = userEvent.setup();
    renderAttention({ tasks: [bookScan] });

    await user.click(screen.getByRole("button", { name: "Set date" }));
    expect(await screen.findByLabelText("Time")).toBeDisabled();
    for (const control of [
      ...within(
        screen.getByRole("group", { name: "Preset times" }),
      ).getAllByRole("button"),
      ...within(screen.getByRole("group", { name: "Repeat" })).getAllByRole(
        "button",
      ),
    ]) {
      expect(control).toBeDisabled();
    }
    expect(
      within(screen.getByRole("group", { name: "Repeat" }))
        .getAllByRole("button")
        .map((button) => button.textContent),
    ).toEqual(["Daily", "Weekdays", "Weekly", "Biweekly", "Monthly", "Custom"]);
  });

  it("saves a preset Repeat in one click, and nothing else", async () => {
    const user = userEvent.setup();
    const { onSetTaskRepeat, onSetTaskDate } = renderAttention({
      tasks: [oneOff],
    });

    await user.click(screen.getByRole("button", { name: /^Change date:/ }));
    const daily = await screen.findByRole("button", { name: "Every day" });
    expect(daily).toHaveTextContent("Daily");
    expect(daily).toHaveAttribute("aria-pressed", "false");
    expect(screen.queryByRole("button", { name: "Stop repeating" })).toBeNull();
    await user.click(daily);

    expect(onSetTaskRepeat).toHaveBeenCalledExactlyOnceWith(oneOff._id, {
      kind: "days",
      every: 1,
    });
    expect(onSetTaskDate).not.toHaveBeenCalled();
    expect(screen.getByRole("group", { name: "Repeat" })).toBeVisible();
  });

  it("offers the date's own weekday, and says when a preset moves the date", async () => {
    const user = userEvent.setup();
    // Saturday, Aug 15.
    renderAttention({
      tasks: [{ ...oneOff, date: new Date(2026, 7, 15, 21).getTime() }],
    });

    await user.click(screen.getByRole("button", { name: /^Change date:/ }));
    expect(
      await screen.findByRole("button", { name: "Every Saturday" }),
    ).toHaveTextContent("Weekly");
    expect(
      screen.getByRole("button", { name: "Every weekday, from Mon" }),
    ).toHaveTextContent("Weekdays");
  });

  it("offers every month on the date's day, and marks a monthly Task with it", async () => {
    const user = userEvent.setup();
    const { onSetTaskRepeat } = renderAttention({ tasks: [oneOff] });

    await user.click(screen.getByRole("button", { name: /^Change date:/ }));
    await user.click(
      await screen.findByRole("button", { name: "Every month on the 13th" }),
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
    expect(
      await screen.findByRole("button", { name: "Every month on the 31st" }),
    ).toHaveAttribute("aria-pressed", "true");
  });

  it("steps a custom every N days and saves the rhythm", async () => {
    const user = userEvent.setup();
    const { onSetTaskRepeat } = renderAttention({ tasks: [checkIn] });

    await user.click(screen.getByRole("button", { name: /^Change date:/ }));
    await user.click(
      await screen.findByRole("button", { name: "Custom repeat" }),
    );
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
    // Back on the choices.
    expect(screen.getByRole("group", { name: "Repeat" })).toBeVisible();
  });

  it("says where a custom weekly choice moves the date before saving it", async () => {
    const user = userEvent.setup();
    const { onSetTaskRepeat } = renderAttention({ tasks: [checkIn] });

    await user.click(screen.getByRole("button", { name: /^Change date:/ }));
    await user.click(
      await screen.findByRole("button", { name: "Custom repeat" }),
    );
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

  it("goes back from Custom to the choices without saving", async () => {
    const user = userEvent.setup();
    const { onSetTaskRepeat } = renderAttention({ tasks: [checkIn] });

    await user.click(screen.getByRole("button", { name: /^Change date:/ }));
    await user.click(
      await screen.findByRole("button", { name: "Custom repeat" }),
    );
    expect(screen.queryByLabelText("Time")).toBeNull();
    await user.click(
      screen.getByRole("button", { name: "Back to repeat choices" }),
    );
    expect(screen.getByLabelText("Time")).toBeVisible();
    expect(screen.getByRole("button", { name: "Every day" })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
    expect(onSetTaskRepeat).not.toHaveBeenCalled();
  });

  it("stops the Repeat with Stop, with the chosen one again, and with the date", async () => {
    const user = userEvent.setup();
    const { onSetTaskRepeat, onSetTaskDate } = renderAttention({
      tasks: [checkIn],
    });

    await user.click(screen.getByRole("button", { name: /^Change date:/ }));
    await user.click(
      await screen.findByRole("button", { name: "Stop repeating" }),
    );
    expect(onSetTaskRepeat).toHaveBeenCalledExactlyOnceWith(checkIn._id, null);

    await user.click(screen.getByRole("button", { name: "Every day" }));
    expect(onSetTaskRepeat).toHaveBeenLastCalledWith(checkIn._id, null);

    await user.click(screen.getByRole("button", { name: "Clear date" }));
    // One command: clearing the date clears the Repeat with it.
    expect(onSetTaskDate).toHaveBeenCalledExactlyOnceWith(checkIn._id, null);
    expect(onSetTaskRepeat).toHaveBeenCalledTimes(2);
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

    const daily = await screen.findByRole("button", { name: "Every day" });
    expect(daily).toBeEnabled();
    await user.click(daily);
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

    expect(note(taskRows()[0]!)).toHaveAttribute("aria-disabled", "true");
    expect(note(taskRows()[1]!)).toBeEnabled();
  });
});

describe("ThreadAttention pending occurrence controls", () => {
  it("marks Complete and Skip unavailable without disabling them", () => {
    renderAttention({
      tasks: [
        { ...callClinic, date: today, repeat: { kind: "days", every: 1 } },
        bookScan,
      ],
      completingTaskIds: new Set([callClinic._id]),
    });
    expect(
      within(taskRows()[0]!).getByRole("button", { name: "Complete task" }),
    ).toHaveAttribute("aria-disabled", "true");
    expect(
      within(taskRows()[0]!).getByRole("button", { name: "Skip task" }),
    ).toHaveAttribute("aria-disabled", "true");
    expect(
      within(taskRows()[1]!).getByRole("button", { name: "Complete task" }),
    ).toBeEnabled();
  });
});

describe("ThreadAttention focus", () => {
  for (const command of ["Complete task", "Remove task"]) {
    for (const index of [1, 2, 0]) {
      it(`${command} focuses the neighbor of ${index === 1 ? "the middle" : index === 2 ? "the last" : "the only"} Task`, async () => {
        const user = userEvent.setup();
        const initial =
          index === 0 ? [callClinic] : [callClinic, bookScan, collect];
        function Tasks() {
          const [tasks, setTasks] = useState(initial);
          const remove = (id: TaskId) =>
            setTasks((tasks) => tasks.filter((task) => task._id !== id));
          return (
            <ThreadAttention
              tasks={tasks}
              now={now}
              onAddTask={vi.fn()}
              onEditTask={vi.fn()}
              onRemoveTask={remove}
              onCompleteTask={remove}
              onCompleteTaskWithNote={remove}
              onSetTaskDate={vi.fn()}
              onSetTaskRepeat={vi.fn()}
              onSkipTask={vi.fn()}
            />
          );
        }
        render(<Tasks />);
        const next =
          index === 0
            ? screen.getByRole("textbox", { name: "Add a task" })
            : within(taskRows()[index === 1 ? 2 : 1]!).getByRole("button", {
                name: command,
              });
        const button = within(taskRows()[index]!).getByRole("button", {
          name: command,
        });
        act(() => button.focus());
        await user.keyboard("{Enter}");
        expect(next).toHaveFocus();
      });
    }
  }

  for (const command of ["Complete task", "Skip task", "Remove task"]) {
    it(`${command} stays focused and ignores a second activation while busy`, async () => {
      const user = userEvent.setup();
      const answer = deferred<void>();
      const run = vi.fn(() => answer.promise);
      renderAttention({
        tasks: [
          { ...callClinic, date: today, repeat: { kind: "days", every: 1 } },
        ],
        onCompleteTask: run,
        onSkipTask: run,
        onRemoveTask: run,
      });
      const button = screen.getByRole("button", { name: command });
      act(() => button.focus());
      await user.keyboard("{Enter}{Enter}");
      expect(button).toHaveFocus();
      expect(button).not.toBeDisabled();
      expect(button).toHaveAttribute("aria-disabled", "true");
      expect(run).toHaveBeenCalledTimes(1);
      await act(async () => answer.resolve());
      expect(button).toHaveFocus();
    });
  }

  for (const key of ["{Enter}", "{Escape}", "{Tab}"]) {
    it(`Task text ${key} ${key === "{Tab}" ? "leaves focus on the next control" : "returns focus to its display"}`, async () => {
      const user = userEvent.setup();
      const { onEditTask } = renderAttention({ tasks: [callClinic] });
      await user.click(screen.getByRole("button", { name: callClinic.text }));
      await user.keyboard(` changed${key}`);
      const target = screen.getByRole("button", {
        name: key === "{Tab}" ? "Set date" : callClinic.text,
      });
      expect(target).toHaveFocus();
      expect(onEditTask).toHaveBeenCalledTimes(key === "{Escape}" ? 0 : 1);
    });
  }

  for (const cancel of ["escape", "cancel"]) {
    it(`note-line ${cancel} returns to its opener`, async () => {
      const user = userEvent.setup();
      renderAttention({ tasks: [callClinic] });
      const opener = screen.getByRole("button", {
        name: "Complete with a note",
      });
      await user.click(opener);
      if (cancel === "escape") await user.keyboard("{Escape}");
      else await user.click(screen.getByRole("button", { name: "Cancel" }));
      expect(opener).toHaveFocus();
    });
  }

  it("does not recover again when a removed Task rolls back", async () => {
    const user = userEvent.setup();
    const answer = deferred<void>();
    const view = renderAttention({
      tasks: [callClinic, bookScan],
      onCompleteTask: () => answer.promise,
    });
    const button = within(taskRows()[0]!).getByRole("button", {
      name: "Complete task",
    });
    act(() => button.focus());
    await user.keyboard("{Enter}");
    view.show({ tasks: [bookScan] });
    await act(async () => {});
    expect(screen.getByRole("button", { name: "Complete task" })).toHaveFocus();
    const add = screen.getByRole("textbox", { name: "Add a task" });
    await user.click(add);
    view.show({ tasks: [callClinic, bookScan] });
    expect(add).toHaveFocus();
    await act(async () => answer.resolve());
    expect(add).toHaveFocus();
  });

  it("leaves focus alone when the person moves before a Task disappears", async () => {
    const user = userEvent.setup();
    const answer = deferred<void>();
    const view = renderAttention({
      tasks: [callClinic, bookScan],
      onCompleteTask: () => answer.promise,
    });
    await user.click(
      within(taskRows()[0]!).getByRole("button", { name: "Complete task" }),
    );
    const add = screen.getByRole("textbox", { name: "Add a task" });
    await user.click(add);
    view.show({ tasks: [bookScan] });
    expect(add).toHaveFocus();
    await act(async () => answer.resolve());
  });
});
