import type { Task, TaskId } from "@vita-os/contracts";

import userEvent from "@testing-library/user-event";
import { addDays, subDays } from "date-fns";
import { describe, expect, it, vi } from "vitest";

import { render, screen, within } from "../../test/render-with-providers";
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
    onSetFollowUp: vi.fn(),
    onClearFollowUp: vi.fn(),
  };

  const { unmount } = render(
    <ThreadAttention
      tasks={[]}
      followUp={undefined}
      now={now}
      {...handlers}
      {...props}
    />,
  );

  return { ...handlers, unmount };
}

function taskRows() {
  return within(screen.getByRole("list", { name: "Tasks" })).getAllByRole(
    "listitem",
  );
}

describe("ThreadAttention", () => {
  it("lists every Task in capture order, highlighting the Focused Task where it sits", () => {
    renderAttention({
      tasks: [callClinic, bookScan, collect],
      focusedTaskId: bookScan._id,
      followUp: today,
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
    expect(
      screen.getByRole("button", { name: "Change follow-up date: Aug 13" }),
    ).toBeVisible();
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

  it("picks a follow-up date from the calendar and clears it", async () => {
    const user = userEvent.setup();
    const { onSetFollowUp, onClearFollowUp } = renderAttention({
      followUp: today,
    });

    await user.click(
      screen.getByRole("button", { name: "Change follow-up date: Aug 13" }),
    );
    expect(
      await screen.findByText("Bring this back into view around this date."),
    ).toBeVisible();
    // The time waits behind its button until asked for.
    expect(screen.queryByLabelText("Time")).not.toBeInTheDocument();
    // The calendar opens on the Follow-up's month.
    await user.click(within(await screen.findByRole("grid")).getByText("20"));
    expect(onSetFollowUp).toHaveBeenCalledWith(new Date(2026, 7, 20).getTime());

    await user.click(
      screen.getByRole("button", { name: "Clear follow-up date" }),
    );
    expect(onClearFollowUp).toHaveBeenCalled();
  });

  it("adds a time to the follow-up once, when the picker closes", async () => {
    const user = userEvent.setup();
    const { onSetFollowUp } = renderAttention({ followUp: today });

    await user.click(
      screen.getByRole("button", { name: "Change follow-up date: Aug 13" }),
    );
    await user.click(await screen.findByRole("button", { name: "Add time" }));
    const time = screen.getByLabelText("Time");
    expect(time).toHaveFocus();
    await user.type(time, "15:30");
    expect(onSetFollowUp).not.toHaveBeenCalled();

    await user.keyboard("{Enter}");
    expect(onSetFollowUp).toHaveBeenCalledExactlyOnceWith(
      new Date(2026, 7, 13, 15, 30).getTime(),
    );
  });

  it("shows a follow-up's time beside its date, and removes it", async () => {
    const user = userEvent.setup();
    const { onSetFollowUp } = renderAttention({
      followUp: new Date(2026, 7, 13, 9).getTime(),
    });

    await user.click(
      screen.getByRole("button", {
        name: "Change follow-up date: Aug 13 · 9 AM",
      }),
    );
    await user.click(
      await screen.findByRole("button", { name: "Remove time" }),
    );
    expect(screen.getByRole("button", { name: "Add time" })).toBeVisible();
    await user.keyboard("{Escape}");
    expect(onSetFollowUp).toHaveBeenCalledExactlyOnceWith(today);
  });

  it("tones a late follow-up the way the rest of the app does", () => {
    const { unmount } = renderAttention({
      followUp: subDays(new Date(today), 2).getTime(),
    });
    expect(screen.getByText("Aug 11")).toHaveClass("text-condition-attention");
    unmount();

    renderAttention({ followUp: addDays(new Date(today), 9).getTime() });
    expect(screen.getByText("Aug 22")).toHaveClass("text-muted-foreground");
  });
});
