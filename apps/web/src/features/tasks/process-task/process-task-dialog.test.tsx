import type { Doc, Id } from "@convex/_generated/dataModel";

import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { ProcessTaskDialog } from "./process-task-dialog";

const task = {
  _id: "task1" as Id<"tasks">,
  _creationTime: 0,
  userId: "user1",
  text: "Schedule a physical",
  state: "open",
  createdAt: 0,
} satisfies Doc<"tasks">;

const healthArea = {
  _id: "area1" as Id<"areas">,
  _creationTime: 0,
  userId: "user1",
  name: "Health",
  slug: "health",
  condition: "healthy",
  order: 0,
  createdAt: 0,
} satisfies Doc<"areas">;

const adminArea = {
  _id: "area2" as Id<"areas">,
  _creationTime: 0,
  userId: "user1",
  name: "Admin",
  slug: "admin",
  condition: "healthy",
  order: 1,
  createdAt: 0,
} satisfies Doc<"areas">;

const threads = [
  {
    _id: "thread1" as Id<"threads">,
    _creationTime: 0,
    userId: "user1",
    title: "Book annual checkup",
    slug: "book-annual-checkup",
    areaId: healthArea._id,
    state: "open",
    order: 0,
    createdAt: 0,
  },
  {
    _id: "thread2" as Id<"threads">,
    _creationTime: 0,
    userId: "user1",
    title: "Renew passport",
    slug: "renew-passport",
    areaId: adminArea._id,
    state: "open",
    order: 1,
    createdAt: 0,
  },
] satisfies Doc<"threads">[];

function renderDialog(
  onProcess = vi.fn(),
  options: { isLoading?: boolean; threads?: Doc<"threads">[] } = {},
) {
  return render(
    <ProcessTaskDialog
      open
      onOpenChange={vi.fn()}
      task={task}
      areas={[healthArea, adminArea]}
      threads={options.threads ?? threads}
      isLoading={options.isLoading}
      onProcess={onProcess}
    />,
  );
}

describe("ProcessTaskDialog", () => {
  it("shows loading state instead of empty search results while destination data loads", async () => {
    const user = userEvent.setup();
    renderDialog(vi.fn(), { isLoading: true, threads: [] });

    await user.click(screen.getByRole("combobox"));

    expect(screen.getByText("Loading…")).toBeVisible();
    expect(screen.queryByText("No threads yet")).not.toBeInTheDocument();
  });

  it("shows the Task as context and filters Threads by search term", async () => {
    const user = userEvent.setup();
    renderDialog();

    expect(screen.getByText("Schedule a physical")).toBeInTheDocument();

    const combobox = screen.getByRole("combobox");
    expect(combobox).toHaveAttribute(
      "placeholder",
      "Search or type a new thread...",
    );
    await user.type(combobox, "heal");

    const option = screen.getByRole("option", {
      name: /book annual checkup/i,
    });
    expect(option).toBeInTheDocument();
    expect(within(option).getByText("Health")).toBeInTheDocument();
    expect(
      screen.queryByRole("option", { name: /renew passport/i }),
    ).not.toBeInTheDocument();
  });

  it("reveals explicit Thread destinations after Thread selection and submits the selected Next Move choice", async () => {
    const user = userEvent.setup();
    const onProcess = vi.fn();
    renderDialog(onProcess);

    await user.click(screen.getByRole("combobox"));
    await user.click(screen.getByRole("option", { name: /book annual/i }));

    expect(
      screen.getByRole("radio", { name: /activity log entry/i }),
    ).toBeInTheDocument();
    await user.click(screen.getByRole("radio", { name: /next move/i }));
    await user.click(screen.getByRole("button", { name: /process/i }));

    expect(onProcess).toHaveBeenCalledWith(task._id, {
      type: "set_next_move",
      threadId: threads[0]._id,
    });
  });

  it("offers inline Thread creation for a non-matching title", async () => {
    const user = userEvent.setup();
    renderDialog();

    const combobox = screen.getByRole("combobox");
    await user.type(combobox, "Schedule dentist");

    await user.click(
      screen.getByRole("option", { name: /create 'schedule dentist'/i }),
    );

    expect(combobox).toHaveValue("Schedule dentist");
    expect(
      screen.queryByRole("textbox", { name: /summary/i }),
    ).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Health" })).toBeInTheDocument();
  });

  it("submits new Thread creation with a separate title and selected Area", async () => {
    const user = userEvent.setup();
    const onProcess = vi.fn();
    renderDialog(onProcess);

    const combobox = screen.getByRole("combobox");
    await user.type(combobox, "Schedule dentist");
    await user.click(
      screen.getByRole("option", { name: /create 'schedule dentist'/i }),
    );
    expect(combobox).toHaveValue("Schedule dentist");
    await user.click(screen.getByRole("button", { name: "Health" }));
    await user.click(screen.getByRole("button", { name: /process/i }));

    expect(onProcess).toHaveBeenCalledWith(task._id, {
      type: "create_thread",
      title: "Schedule dentist",
      areaId: healthArea._id,
    });
  });

  it("keeps create details when the Thread title is edited after selecting Create", async () => {
    const user = userEvent.setup();
    const onProcess = vi.fn();
    renderDialog(onProcess);

    const combobox = screen.getByRole("combobox");
    await user.type(combobox, "Schedule dentist");
    await user.click(
      screen.getByRole("option", { name: /create 'schedule dentist'/i }),
    );
    await user.click(screen.getByRole("button", { name: "Health" }));
    expect(screen.getByRole("button", { name: /process/i })).toBeEnabled();

    await user.clear(combobox);
    await user.type(combobox, "Schedule dentist visit");

    expect(combobox).toHaveValue("Schedule dentist visit");
    await user.keyboard("{Escape}");
    const processButton = screen.getByRole("button", { name: /process/i });
    expect(processButton).toBeEnabled();
    await user.click(processButton);

    expect(onProcess).toHaveBeenCalledWith(task._id, {
      type: "create_thread",
      title: "Schedule dentist visit",
      areaId: healthArea._id,
    });
  });
});
