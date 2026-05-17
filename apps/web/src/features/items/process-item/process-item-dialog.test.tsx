import type { Doc, Id } from "@convex/_generated/dataModel";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeAll, describe, expect, it, vi } from "vitest";
import { ProcessItemDialog } from "./process-item-dialog";

const item = {
  _id: "item1" as Id<"items">,
  _creationTime: 0,
  userId: "user1",
  text: "Schedule a physical",
  isCompleted: false,
  createdAt: 0,
} satisfies Doc<"items">;

const healthArea = {
  _id: "area1" as Id<"areas">,
  _creationTime: 0,
  userId: "user1",
  name: "Health",
  slug: "health",
  healthStatus: "healthy",
  order: 0,
  createdAt: 0,
} satisfies Doc<"areas">;

const adminArea = {
  _id: "area2" as Id<"areas">,
  _creationTime: 0,
  userId: "user1",
  name: "Admin",
  slug: "admin",
  healthStatus: "healthy",
  order: 1,
  createdAt: 0,
} satisfies Doc<"areas">;

const projects = [
  {
    _id: "project1" as Id<"projects">,
    _creationTime: 0,
    userId: "user1",
    name: "Book annual checkup",
    slug: "book-annual-checkup",
    areaId: healthArea._id,
    state: "active",
    order: 0,
    createdAt: 0,
  },
  {
    _id: "project2" as Id<"projects">,
    _creationTime: 0,
    userId: "user1",
    name: "Renew passport",
    slug: "renew-passport",
    areaId: adminArea._id,
    state: "active",
    order: 1,
    createdAt: 0,
  },
] satisfies Doc<"projects">[];

beforeAll(() => {
  window.matchMedia =
    window.matchMedia ??
    vi.fn().mockImplementation((query: string) => ({
      matches: false,
      media: query,
      onchange: null,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      addListener: vi.fn(),
      removeListener: vi.fn(),
      dispatchEvent: vi.fn(),
    }));
});

function renderDialog(onProcess = vi.fn()) {
  return render(
    <ProcessItemDialog
      open
      onOpenChange={vi.fn()}
      item={item}
      areas={[healthArea, adminArea]}
      projects={projects}
      onProcess={onProcess}
    />,
  );
}

describe("ProcessItemDialog", () => {
  it("shows the Item as context and filters Projects by search term", async () => {
    const user = userEvent.setup();
    renderDialog();

    expect(screen.getByText("Schedule a physical")).toBeInTheDocument();

    const combobox = screen.getByRole("combobox");
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

  it("reveals processing choices after Project selection and submits the selected action", async () => {
    const user = userEvent.setup();
    const onProcess = vi.fn();
    renderDialog(onProcess);

    await user.click(screen.getByRole("combobox"));
    await user.click(screen.getByRole("option", { name: /book annual/i }));

    expect(
      screen.getByRole("radio", { name: /add as note/i }),
    ).toBeInTheDocument();
    await user.click(
      screen.getByRole("radio", { name: /set as next action/i }),
    );
    await user.click(screen.getByRole("button", { name: /process/i }));

    expect(onProcess).toHaveBeenCalledWith(item._id, {
      type: "set_next_action",
      projectId: projects[0]._id,
    });
  });

  it("offers inline Project creation for a non-matching search", async () => {
    const user = userEvent.setup();
    renderDialog();

    await user.type(screen.getByRole("combobox"), "Schedule dentist");

    await user.click(
      screen.getByRole("option", { name: /create 'schedule dentist'/i }),
    );

    expect(
      screen.getByRole("textbox", { name: /^project name$/i }),
    ).toHaveValue("Schedule dentist");
    expect(
      screen.getByRole("textbox", { name: /definition of done/i }),
    ).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /^area$/i })).toBeInTheDocument();
  });

  it("submits inline Project creation with the selected Area", async () => {
    const user = userEvent.setup();
    const onProcess = vi.fn();
    renderDialog(onProcess);

    await user.type(screen.getByRole("combobox"), "Schedule dentist");
    await user.click(
      screen.getByRole("option", { name: /create 'schedule dentist'/i }),
    );
    await user.click(screen.getByRole("button", { name: /^area$/i }));
    await user.click(screen.getByRole("button", { name: "Health" }));
    await user.type(
      screen.getByRole("textbox", { name: /definition of done/i }),
      "Appointment is on the calendar",
    );
    await user.click(screen.getByRole("button", { name: /process/i }));

    expect(onProcess).toHaveBeenCalledWith(item._id, {
      type: "create_project",
      name: "Schedule dentist",
      areaId: healthArea._id,
      definitionOfDone: "Appointment is on the calendar",
    });
  });
});
