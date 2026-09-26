import type { AreaId, ThreadId } from "@vita-os/contracts";

import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import {
  createQuietApplicationClient,
  success,
} from "../../test/fake-application-client";
import { anArea, aThread } from "../../test/fixtures";
import {
  render,
  screen,
  waitFor,
  within,
} from "../../test/render-with-providers";
import { ManageAreasDialog } from "./manage-areas-dialog";

const health = anArea();
const home = anArea({
  _id: "area-2" as AreaId,
  name: "Home",
  slug: "home-0011aabb",
  icon: "Home",
  order: 1,
});

function renderDialog(overrides = {}) {
  const client = createQuietApplicationClient({
    listAreas: async () => success([health, home]),
    listOpenThreads: async () =>
      success([
        aThread(),
        aThread({ _id: "thread-2" as ThreadId, slug: "dentist-0011aabb" }),
        aThread({
          _id: "thread-3" as ThreadId,
          slug: "gate-0011aabb",
          areaId: home._id,
        }),
      ]),
    ...overrides,
  });
  render(<ManageAreasDialog open onOpenChange={vi.fn()} />, {
    applicationClient: client,
  });
  return client;
}

describe("ManageAreasDialog", () => {
  it("renames an Area when its name is committed", async () => {
    const user = userEvent.setup();
    const updateArea = vi.fn(async () =>
      success({ ...health, name: "Wellbeing" }),
    );
    renderDialog({ updateArea });

    const name = await screen.findByRole("textbox", {
      name: `Name of ${health.name}`,
    });
    await user.clear(name);
    await user.type(name, "Wellbeing{Enter}");

    await waitFor(() =>
      expect(updateArea).toHaveBeenCalledWith({
        areaId: health._id,
        name: "Wellbeing",
      }),
    );
  });

  it("changes an Area's icon", async () => {
    const user = userEvent.setup();
    const updateArea = vi.fn(async () => success({ ...health, icon: "Leaf" }));
    renderDialog({ updateArea });

    await user.click(
      await screen.findByRole("button", {
        name: `Change icon for ${health.name}`,
      }),
    );
    // The Leaf icon is offered as "Nature".
    await user.click(await screen.findByRole("button", { name: "Nature" }));

    await waitFor(() =>
      expect(updateArea).toHaveBeenCalledWith({
        areaId: health._id,
        icon: "Leaf",
      }),
    );
  });

  it("moves an Area down the order", async () => {
    const user = userEvent.setup();
    const reorderAreas = vi.fn(async () =>
      success([
        { ...home, order: 0 },
        { ...health, order: 1 },
      ]),
    );
    renderDialog({ reorderAreas });

    await user.click(
      await screen.findByRole("button", { name: `Move ${health.name} down` }),
    );

    await waitFor(() =>
      expect(reorderAreas).toHaveBeenCalledWith({
        areaIds: [home._id, health._id],
      }),
    );
  });

  it("states how many open Threads will lose the label before deleting", async () => {
    const user = userEvent.setup();
    const removeArea = vi.fn(async () =>
      success({ acknowledged: true as const }),
    );
    renderDialog({ removeArea });

    await user.click(
      await screen.findByRole("button", { name: `Delete ${health.name}` }),
    );
    const confirmation = await screen.findByRole("alertdialog");

    expect(confirmation).toHaveTextContent(
      "2 open Threads will lose this label.",
    );
    await user.click(
      within(confirmation).getByRole("button", { name: "Delete area" }),
    );
    await waitFor(() =>
      expect(removeArea).toHaveBeenCalledWith({ areaId: health._id }),
    );
  });

  it("adds an Area by name", async () => {
    const user = userEvent.setup();
    const createArea = vi.fn(async () =>
      success(anArea({ _id: "area-3" as AreaId, name: "Career", order: 2 })),
    );
    renderDialog({ createArea });

    await user.type(
      await screen.findByRole("textbox", { name: "New area name" }),
      "Career{Enter}",
    );

    await waitFor(() =>
      expect(createArea).toHaveBeenCalledWith(
        expect.objectContaining({ name: "Career" }),
      ),
    );
  });
});
